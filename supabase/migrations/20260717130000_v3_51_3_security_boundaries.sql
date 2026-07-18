-- v3.51.3 — privileged RPC and cron security boundaries
--
-- 1. auth.users lookup must only be callable by service_role.
-- 2. retention deletion must not be callable by anon/authenticated clients.
-- 3. replace the public-anon M365 cron invocation with a Vault-backed,
--    environment-specific endpoint + service-role request. If either secret is
--    absent, no job is installed instead of falling back to another project.

DO $security$
BEGIN
  -- This RPC exists on the linked project but is missing from the historical
  -- migration corpus. Keep fresh installs reproducible by making the hardening
  -- conditional until the schema-reconciliation migration restores its DDL.
  IF to_regprocedure('public.get_user_ids_by_emails(text[])') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_user_ids_by_emails(text[]) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_ids_by_emails(text[]) TO service_role';
  END IF;
END
$security$;

REVOKE ALL ON FUNCTION public.enforce_data_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_data_retention() TO service_role;

-- RLS limits rows, not columns. These credentials were previously readable by
-- every client allowed to SELECT the row even though the application UI only
-- requested metadata. Keep service_role access intact and expose only the
-- non-secret columns through PostgREST to authenticated users.
REVOKE SELECT ON TABLE public.enterprise_workspace_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, provider, is_active, base_url, account_email, project_key,
  default_issue_type, selected_field_ids, auto_create_on_approval, created_by,
  created_at, updated_at
) ON TABLE public.enterprise_workspace_integrations TO authenticated;

REVOKE SELECT ON TABLE public.enterprise_user_calendar_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, user_id, provider, provider_user_email, provider_user_id,
  token_expires_at, scopes, tenant_id, is_active, last_sync_at,
  last_sync_status, last_sync_error, sync_events_in, sync_events_out,
  created_at, updated_at
) ON TABLE public.enterprise_user_calendar_integrations TO authenticated;

REVOKE SELECT ON TABLE public.enterprise_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, created_by, name, key_prefix, scopes, last_used_at,
  expires_at, revoked_at, created_at
) ON TABLE public.enterprise_api_keys TO authenticated;

REVOKE SELECT ON TABLE public.enterprise_webhook_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, created_by, url, events, is_active, last_fired_at,
  last_error, created_at, updated_at
) ON TABLE public.enterprise_webhook_subscriptions TO authenticated;

DO $cron_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ms365-sync-every-15min') THEN
    PERFORM cron.unschedule('ms365-sync-every-15min');
  END IF;
END
$cron_guard$;

DO $cron_install$
DECLARE
  v_base_url text;
  v_has_service_key boolean;
BEGIN
  SELECT decrypted_secret
  INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_function_base_url'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
      AND decrypted_secret IS NOT NULL
      AND decrypted_secret <> ''
  ) INTO v_has_service_key;

  IF v_base_url IS NULL OR v_base_url = '' OR NOT v_has_service_key THEN
    RAISE NOTICE 'M365 cron not installed: configure supabase_function_base_url and email_queue_service_role_key in Vault';
    RETURN;
  END IF;

  IF v_base_url !~ '^https://[a-z0-9-]+[.]supabase[.]co/?$' THEN
    RAISE EXCEPTION 'Invalid supabase_function_base_url Vault secret';
  END IF;

  PERFORM cron.schedule(
    'ms365-sync-every-15min',
    '*/15 * * * *',
    $job$
    SELECT net.http_post(
      url := rtrim(endpoint.decrypted_secret, '/') || '/functions/v1/ms365-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || credential.decrypted_secret
      ),
      body := '{"action":"cron_sync_all"}'::jsonb
    ) AS request_id
    FROM vault.decrypted_secrets AS endpoint
    CROSS JOIN vault.decrypted_secrets AS credential
    WHERE endpoint.name = 'supabase_function_base_url'
      AND credential.name = 'email_queue_service_role_key'
      AND endpoint.decrypted_secret ~ '^https://[a-z0-9-]+[.]supabase[.]co/?$';
    $job$
  );
END
$cron_install$;
