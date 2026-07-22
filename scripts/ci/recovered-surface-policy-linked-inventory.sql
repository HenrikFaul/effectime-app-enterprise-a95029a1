-- Read-only exact RLS inventory for the recovered clock and marketplace
-- surfaces. Keep this separate from the ACL inventory because `supabase db
-- query` returns the final result set only. Run with `--linked --file` and
-- archive the output before applying the forward-only hardening migration.

SELECT
  relation.relname AS table_name,
  policy.polname AS policy_name,
  policy.polpermissive AS permissive,
  policy.polcmd AS command,
  ARRAY(
    SELECT pg_catalog.pg_get_userbyid(role_oid)
    FROM pg_catalog.unnest(policy.polroles) AS role_oid
    ORDER BY pg_catalog.pg_get_userbyid(role_oid)
  ) AS roles,
  pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) AS using_expression,
  pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid) AS check_expression
FROM pg_catalog.pg_policy AS policy
JOIN pg_catalog.pg_class AS relation
  ON relation.oid = policy.polrelid
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN (
    'clock_events',
    'qr_clock_sessions',
    'marketplace_plugins',
    'workspace_installed_plugins',
    'plugin_webhook_events'
  )
ORDER BY relation.relname, policy.polname;
