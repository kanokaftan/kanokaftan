"""Generate SQL that rewrites the public schema's RLS policies for speed.

1. auth.uid() is evaluated once per query: (SELECT auth.uid()), and admin
   checks become (SELECT has_role((SELECT auth.uid()), 'admin')).
2. Several permissive policies for the same table, role set and command are
   merged into one whose USING / WITH CHECK is the OR of the originals. That is
   exactly how Postgres combines permissive policies, so access is unchanged.

Input: JSON list of {t, n, perm, roles, cmd, q, c} from pg_policies.
Output: SQL statements (one per line group) for a DO block.
"""
import json
import re
import sys
from collections import OrderedDict

CMDS = ["SELECT", "INSERT", "UPDATE", "DELETE"]


def fast_auth(expr):
    if expr is None:
        return None
    s = re.sub(r"\(\s*SELECT auth\.uid\(\) AS uid\)", "@UID@", expr)
    s = s.replace("auth.uid()", "@UID@")
    s = s.replace("@UID@", "(SELECT auth.uid())")
    # has_role(<caller>, 'x'::app_role) does not depend on the row: evaluate once.
    s = re.sub(r"(?<!SELECT )has_role\(\(SELECT auth\.uid\(\)\), ('\w+'::app_role)\)",
               r"(SELECT has_role((SELECT auth.uid()), \1))", s)
    return s


def q(ident):
    return '"' + ident.replace('"', '""') + '"'


def roles_sql(roles):
    names = roles.strip("{}").split(",")
    return ", ".join(n if n == "public" else q(n) for n in names)


def or_join(exprs):
    exprs = [e for e in exprs if e is not None]
    if not exprs:
        return None
    uniq = list(OrderedDict.fromkeys(exprs))
    if any(e.strip() == "true" for e in uniq):
        return "true"
    return uniq[0] if len(uniq) == 1 else " OR ".join(f"({e})" for e in uniq)


def generate(policies):
    out = []
    by_table = OrderedDict()
    for p in policies:
        if p["perm"] != "PERMISSIVE":
            continue
        by_table.setdefault(p["t"], []).append(p)

    for table, pols in by_table.items():
        groups = OrderedDict()
        for p in pols:
            for cmd in (CMDS if p["cmd"] == "ALL" else [p["cmd"]]):
                groups.setdefault((p["roles"], cmd), []).append(p)
        needs_merge = any(len(v) > 1 for v in groups.values())

        if not needs_merge:
            for p in pols:
                using, check = fast_auth(p["q"]), fast_auth(p["c"])
                parts = []
                if using is not None:
                    parts.append(f"USING ({using})")
                if check is not None:
                    parts.append(f"WITH CHECK ({check})")
                if parts and (using != p["q"] or check != p["c"]):
                    out.append(f"ALTER POLICY {q(p['n'])} ON public.{q(table)} " + " ".join(parts))
            continue

        for p in pols:
            out.append(f"@RM@ POLICY {q(p['n'])} ON public.{q(table)}")
        for (roles, cmd), members in groups.items():
            name = f"{table}: {cmd.lower()}" + ("" if roles == "{public}" else f" ({roles.strip('{}')})")
            usings = [fast_auth(m["q"]) for m in members]
            checks = [fast_auth(m["c"] if m["c"] is not None else m["q"]) for m in members]
            sql = f"CREATE POLICY {q(name)} ON public.{q(table)} AS PERMISSIVE FOR {cmd} TO {roles_sql(roles)}"
            if cmd in ("SELECT", "DELETE", "UPDATE"):
                sql += f" USING ({or_join(usings)})"
            if cmd in ("INSERT", "UPDATE"):
                sql += f" WITH CHECK ({or_join(checks)})"
            out.append(sql)
    return out


if __name__ == "__main__":
    policies = json.load(sys.stdin)
    for stmt in generate(policies):
        print(stmt.replace("\n", " ") + ";")
