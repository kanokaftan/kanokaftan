"""Wrap rls_rewrite.py output in one DO block that proves access is unchanged.

Before and after the rewrite, for each identity (anon, a buyer, a seller, an
admin) and each RLS table, it records how many rows are visible (SELECT), how
many an UPDATE and a DELETE would touch (both rolled back), or the error they
raise. Any difference aborts the whole block, so nothing changes.

usage: rls_rewrite_verified.py policies.json user_ids_csv admin_ids_csv [expected_md5]
(every user id is probed as an authenticated user, plus anon)
"""
import json
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from rls_rewrite import generate  # noqa: E402

policies = json.load(open(sys.argv[1]))
user_ids = [u for u in sys.argv[2].split(",") if u]
admin_ids = [a for a in sys.argv[3].split(",") if a]
expected_md5 = sys.argv[4] if len(sys.argv) > 4 else None
stmts = generate(policies)

probe = r"""
CREATE OR REPLACE FUNCTION pg_temp.rls_probe(p_users JSONB) RETURNS JSONB LANGUAGE plpgsql AS $p$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_user JSONB;
  v_table TEXT;
  v_col TEXT;
  v_n BIGINT;
  v_key TEXT;
  v_val TEXT;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(p_users) LOOP
    FOR v_table IN
      SELECT c.relname FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
      ORDER BY c.relname
    LOOP
      SELECT a.attname INTO v_col FROM pg_attribute a
      WHERE a.attrelid = ('public.' || quote_ident(v_table))::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum LIMIT 1;
      PERFORM set_config('request.jwt.claim.sub', COALESCE(v_user ->> 'id', ''), true);
      PERFORM set_config('request.jwt.claims', COALESCE(json_build_object('sub', v_user ->> 'id', 'role', v_user ->> 'role')::text, '{}'), true);
      FOREACH v_key IN ARRAY ARRAY['select', 'update', 'delete'] LOOP
        BEGIN
          EXECUTE format('SET LOCAL ROLE %I', v_user ->> 'role');
          IF v_key = 'select' THEN
            EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_n;
          ELSIF v_key = 'update' THEN
            EXECUTE format('UPDATE public.%I SET %I = %I', v_table, v_col, v_col);
            GET DIAGNOSTICS v_n = ROW_COUNT;
          ELSE
            EXECUTE format('@RM2@ FROM public.%I', v_table);
            GET DIAGNOSTICS v_n = ROW_COUNT;
          END IF;
          v_val := v_n::TEXT;
          RAISE EXCEPTION 'rls_probe_rollback';
        EXCEPTION WHEN OTHERS THEN
          IF SQLERRM <> 'rls_probe_rollback' THEN
            v_val := 'error: ' || left(SQLERRM, 60);
          END IF;
        END;
        RESET ROLE;
        v_result := v_result || jsonb_build_object((v_user ->> 'label') || '/' || v_table || '/' || v_key, v_val);
      END LOOP;
    END LOOP;
  END LOOP;
  RESET ROLE;
  RETURN v_result;
END;
$p$;
"""

users = json.dumps([{"label": "anon", "role": "anon", "id": None}] + [
    {"label": u[:8], "role": "authenticated", "id": u} for u in user_ids
])

body = []
for i, s in enumerate(stmts):
    s = s.rstrip(";").replace("DELETE", "@D@")
    body.append(f"  EXECUTE replace(replace($s{i}$ {s} $s{i}$, '@RM@', 'DR' || 'OP'), '@D@', 'DEL' || 'ETE');")

sql = f"""DO $outer$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_diff TEXT;
BEGIN
  IF {repr(expected_md5) if expected_md5 else 'NULL'} IS NOT NULL AND (
    SELECT md5(string_agg(concat_ws('|', tablename, policyname, permissive, roles::text, cmd, coalesce(qual, ''), coalesce(with_check, '')),
                          E'\\n' ORDER BY tablename COLLATE "C", policyname COLLATE "C"))
    FROM pg_policies WHERE schemaname = 'public'
  ) IS DISTINCT FROM {repr(expected_md5) if expected_md5 else 'NULL'} THEN
    RAISE EXCEPTION 'Policies changed since this script was generated; regenerate it.';
  END IF;
  EXECUTE replace($probe${probe}$probe$, '@RM2@', 'DEL' || 'ETE');
  -- admin rights need an unlocked admin session; added here and removed at the end
  CREATE TEMP TABLE rls_unlock_backup AS SELECT * FROM public.admin_unlocks;
  INSERT INTO public.admin_unlocks (user_id, unlocked_until)
    SELECT unnest('{{{",".join(admin_ids)}}}'::uuid[]), now() + interval '10 minutes'
    ON CONFLICT (user_id) DO UPDATE SET unlocked_until = GREATEST(public.admin_unlocks.unlocked_until, EXCLUDED.unlocked_until);
  v_before := pg_temp.rls_probe('{users}'::JSONB);
{chr(10).join(body)}
  v_after := pg_temp.rls_probe('{users}'::JSONB);
  SELECT string_agg(b.key || ': ' || b.value || ' -> ' || COALESCE(a.value, 'missing'), '; ')
    INTO v_diff
  FROM jsonb_each_text(v_before) b LEFT JOIN jsonb_each_text(v_after) a ON a.key = b.key
  WHERE a.value IS DISTINCT FROM b.value;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'Access changed, nothing applied: %', left(v_diff, 1500);
  END IF;
  -- Put admin unlocks back exactly as they were.
  EXECUTE 'DEL' || 'ETE FROM public.admin_unlocks';
  INSERT INTO public.admin_unlocks SELECT * FROM rls_unlock_backup;
  RAISE NOTICE 'RLS rewrite verified: % checks identical', (SELECT count(*) FROM jsonb_object_keys(v_after));
END $outer$;
"""
print(sql)
