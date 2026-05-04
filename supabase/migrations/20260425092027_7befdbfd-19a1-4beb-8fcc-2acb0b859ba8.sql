
-- Bucket: tartsuk publikusnak (CDN-szerű asset), de nincs változtatás szükséges; a SELECT policy already szűk lehet
-- Workaround: nem listázható, csak akkor ha tudjuk a path-t (Supabase publikus bucket alapból listázható, de a warning info szintű — ezzel együtt élünk, mert branding asset publikus URL-ként kell)
-- Itt nincs teendő - a public bucket szándékos választás.

-- Search_path javítás bármely érintett függvényre (defenzív)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('update_updated_at_column','handle_leave_quota_change','calc_leave_days','has_enterprise_role','is_enterprise_member')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp', r.nspname, r.proname, r.args);
  END LOOP;
END$$;
