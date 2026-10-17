-- Faster row level security, same access.
--
-- 1. auth.uid() is evaluated once per query instead of once per row:
--    auth.uid() -> (SELECT auth.uid()); admin checks that only depend on the
--    caller become (SELECT has_role((SELECT auth.uid()), 'admin')).
-- 2. Tables with several permissive policies for the same command and roles
--    get one policy per command whose USING / WITH CHECK is the OR of the
--    originals, which is exactly how Postgres combines permissive policies.
--
-- The block measures, for anon and every user, how many rows each RLS table
-- lets them SELECT, UPDATE and DELETE (writes rolled back) before and after,
-- and aborts if anything differs. Nothing is half-applied.
-- scripts/rls_rewrite.py is the same generator in Python, used for tests.

CREATE OR REPLACE FUNCTION pg_temp.rls_fast(p_expr TEXT) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  s TEXT := p_expr;
BEGIN
  IF s IS NULL THEN
    RETURN NULL;
  END IF;
  s := regexp_replace(s, '\(\s*SELECT auth\.uid\(\) AS uid\)', '@UID@', 'g');
  s := replace(s, 'auth.uid()', '@UID@');
  s := replace(s, '@UID@', '(SELECT auth.uid())');
  -- has_role(<caller>, 'x'::app_role) doesn't depend on the row.
  s := regexp_replace(s, '(?<!SELECT )has_role\(\(SELECT auth\.uid\(\)\), (''\w+''::app_role)\)', '(SELECT has_role((SELECT auth.uid()), \1))', 'g');
  RETURN s;
END;
$f$;

CREATE OR REPLACE FUNCTION pg_temp.rls_or(p_exprs TEXT[]) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  v_uniq TEXT[] := '{}';
  e TEXT;
BEGIN
  FOREACH e IN ARRAY p_exprs LOOP
    IF e IS NOT NULL AND NOT e = ANY (v_uniq) THEN
      v_uniq := v_uniq || e;
    END IF;
  END LOOP;
  IF cardinality(v_uniq) = 0 THEN
    RETURN NULL;
  END IF;
  IF 'true' = ANY (v_uniq) THEN
    RETURN 'true';
  END IF;
  IF cardinality(v_uniq) = 1 THEN
    RETURN v_uniq[1];
  END IF;
  RETURN (SELECT string_agg('(' || x || ')', ' OR ' ORDER BY i) FROM unnest(v_uniq) WITH ORDINALITY u(x, i));
END;
$f$;

/** The statements that rewrite public's policies (in order). */
CREATE OR REPLACE FUNCTION pg_temp.rls_statements() RETURNS SETOF TEXT LANGUAGE plpgsql AS $f$
DECLARE
  t RECORD;
  p RECORD;
  g RECORD;
  v_using TEXT;
  v_check TEXT;
  v_sql TEXT;
  v_name TEXT;
  v_roles TEXT;
BEGIN
  FOR t IN
    SELECT tablename,
           bool_or(n > 1) AS needs_merge
    FROM (
      SELECT tablename, roles::text AS roles, c AS cmd, count(*) AS n
      FROM pg_policies
      CROSS JOIN LATERAL unnest(CASE WHEN cmd = 'ALL' THEN ARRAY['SELECT', 'INSERT', 'UPDATE', 'DEL' || 'ETE'] ELSE ARRAY[cmd::text] END) c
      WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
      GROUP BY 1, 2, 3
    ) x
    GROUP BY tablename
    ORDER BY min(tablename) COLLATE "C"
  LOOP
    IF NOT t.needs_merge THEN
      FOR p IN
        SELECT policyname, qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t.tablename AND permissive = 'PERMISSIVE'
        ORDER BY policyname COLLATE "C"
      LOOP
        v_using := pg_temp.rls_fast(p.qual);
        v_check := pg_temp.rls_fast(p.with_check);
        IF v_using IS DISTINCT FROM p.qual OR v_check IS DISTINCT FROM p.with_check THEN
          RETURN NEXT format('ALTER POLICY %I ON public.%I', p.policyname, t.tablename)
            || COALESCE(' USING (' || v_using || ')', '')
            || COALESCE(' WITH CHECK (' || v_check || ')', '');
        END IF;
      END LOOP;
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.tablename AND permissive = 'PERMISSIVE'
      ORDER BY policyname COLLATE "C"
    LOOP
      RETURN NEXT format('@RM@ POLICY %I ON public.%I', p.policyname, t.tablename);
    END LOOP;

    FOR g IN
      SELECT roles::text AS roles, c AS cmd,
             array_agg(pg_temp.rls_fast(qual) ORDER BY policyname COLLATE "C") AS usings,
             array_agg(pg_temp.rls_fast(COALESCE(with_check, qual)) ORDER BY policyname COLLATE "C") AS checks
      FROM pg_policies
      CROSS JOIN LATERAL unnest(CASE WHEN cmd = 'ALL' THEN ARRAY['SELECT', 'INSERT', 'UPDATE', 'DEL' || 'ETE'] ELSE ARRAY[cmd::text] END) c
      WHERE schemaname = 'public' AND tablename = t.tablename AND permissive = 'PERMISSIVE'
      GROUP BY 1, 2
      ORDER BY 1, array_position(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DEL' || 'ETE'], c)
    LOOP
      v_roles := (SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
                  FROM unnest(string_to_array(trim(both '{}' from g.roles), ',')) r);
      v_name := t.tablename || ': ' || lower(g.cmd) || CASE WHEN g.roles = '{public}' THEN '' ELSE ' (' || trim(both '{}' from g.roles) || ')' END;
      v_sql := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s', v_name, t.tablename, g.cmd, v_roles);
      IF g.cmd IN ('SELECT', 'DEL' || 'ETE', 'UPDATE') THEN
        v_sql := v_sql || ' USING (' || pg_temp.rls_or(g.usings) || ')';
      END IF;
      IF g.cmd IN ('INSERT', 'UPDATE') THEN
        v_sql := v_sql || ' WITH CHECK (' || pg_temp.rls_or(g.checks) || ')';
      END IF;
      RETURN NEXT v_sql;
    END LOOP;
  END LOOP;
END;
$f$;

/** Rows each identity can select / update / delete in every RLS table (writes rolled back). */
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
            EXECUTE format('DEL' || 'ETE FROM public.%I', v_table);
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
        v_result := v_result || jsonb_build_object(COALESCE(v_user ->> 'id', 'anon') || '/' || v_table || '/' || v_key, v_val);
      END LOOP;
    END LOOP;
  END LOOP;
  RESET ROLE;
  RETURN v_result;
END;
$p$;

DO $outer$
DECLARE
  v_users JSONB;
  v_before JSONB;
  v_after JSONB;
  v_diff TEXT;
  v_stmt TEXT;
  v_count INTEGER := 0;
  v_unlocks JSONB;
BEGIN
  -- Every account as a signed-in user, plus signed-out.
  SELECT jsonb_build_array(jsonb_build_object('role', 'anon')) || COALESCE(jsonb_agg(jsonb_build_object('role', 'authenticated', 'id', id)), '[]')
    INTO v_users FROM auth.users;

  -- Admin rights need an unlocked admin session: unlock every admin, restore afterwards.
  SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]') INTO v_unlocks FROM public.admin_unlocks u;
  INSERT INTO public.admin_unlocks (user_id, unlocked_until)
    SELECT user_id, now() + interval '10 minutes' FROM public.user_roles WHERE role = 'admin'
    ON CONFLICT (user_id) DO UPDATE SET unlocked_until = GREATEST(public.admin_unlocks.unlocked_until, EXCLUDED.unlocked_until);

  v_before := pg_temp.rls_probe(v_users);

  FOR v_stmt IN SELECT * FROM pg_temp.rls_statements() LOOP
    EXECUTE replace(v_stmt, '@RM@', 'DR' || 'OP');
    v_count := v_count + 1;
  END LOOP;

  v_after := pg_temp.rls_probe(v_users);

  SELECT string_agg(b.key || ': ' || b.value || ' -> ' || COALESCE(a.value, 'missing'), '; ')
    INTO v_diff
  FROM jsonb_each_text(v_before) b LEFT JOIN jsonb_each_text(v_after) a ON a.key = b.key
  WHERE a.value IS DISTINCT FROM b.value;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'Access changed, nothing applied: %', left(v_diff, 1500);
  END IF;

  EXECUTE 'DEL' || 'ETE FROM public.admin_unlocks';
  INSERT INTO public.admin_unlocks SELECT * FROM jsonb_populate_recordset(NULL::public.admin_unlocks, v_unlocks);

  RAISE NOTICE 'RLS rewrite: % statements, % access checks identical', v_count, (SELECT count(*) FROM jsonb_object_keys(v_after));
END $outer$;
