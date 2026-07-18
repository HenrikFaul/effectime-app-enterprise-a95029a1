-- Multi-tenant backend split for Syncfolk products.
-- - syncfolk schema: consumer app objects
-- - plannermaster schema: enterprise app objects
--
-- The migration is additive and data-safe: it keeps existing public objects in place,
-- then creates schema-scoped clones + copies all current data.

CREATE SCHEMA IF NOT EXISTS syncfolk;
CREATE SCHEMA IF NOT EXISTS plannermaster;

DO $$
DECLARE
  syncfolk_tables text[] := ARRAY[
    'profiles',
    'user_roles',
    'events',
    'event_participants',
    'votes',
    'personal_availability',
    'friendships',
    'favorites',
    'event_share_tokens',
    'account_deletions'
  ];
  enterprise_tables text[] := ARRAY[
    'leave_requests',
    'approval_decisions',
    'leave_request_substitutes',
    'leave_request_attachments',
    'tenant_calendar_settings'
  ];
  rec record;
  table_name text;
BEGIN
  -- Every enterprise_* table goes to plannermaster.
  FOR rec IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'enterprise\_%' ESCAPE E'\\'
    ORDER BY tablename
  LOOP
    enterprise_tables := array_append(enterprise_tables, rec.tablename);
  END LOOP;

  -- Build and copy syncfolk table clones.
  FOREACH table_name IN ARRAY syncfolk_tables LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS syncfolk.%I (LIKE public.%I INCLUDING ALL)', table_name, table_name);
    EXECUTE format('INSERT INTO syncfolk.%I SELECT * FROM public.%I ON CONFLICT DO NOTHING', table_name, table_name);
  END LOOP;

  -- Build and copy plannermaster table clones.
  FOREACH table_name IN ARRAY enterprise_tables LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS plannermaster.%I (LIKE public.%I INCLUDING ALL)', table_name, table_name);
    EXECUTE format('INSERT INTO plannermaster.%I SELECT * FROM public.%I ON CONFLICT DO NOTHING', table_name, table_name);
  END LOOP;
END;
$$;

-- Recreate RLS on cloned tables to preserve access model.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE (schemaname = 'syncfolk' AND tablename = ANY(ARRAY[
      'profiles','user_roles','events','event_participants','votes','personal_availability','friendships','favorites','event_share_tokens','account_deletions'
    ]))
       OR (schemaname = 'plannermaster')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
  END LOOP;
END;
$$;

-- Helpful aliases for edge-function-safe search_path isolation.
CREATE OR REPLACE FUNCTION syncfolk.set_search_path()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('search_path', 'syncfolk,public,extensions', true);
END;
$$;

CREATE OR REPLACE FUNCTION plannermaster.set_search_path()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('search_path', 'plannermaster,public,extensions', true);
END;
$$;
