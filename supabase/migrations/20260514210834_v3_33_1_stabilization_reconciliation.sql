-- v3.33.1 stabilization — reconciliation + data-integrity migration
--
-- Re-creates / hardens schema objects so that rebuilding the database from
-- on-disk migrations cannot regress fixes that were applied via Supabase MCP
-- in v3.17.0..v3.33.0. Also adds DB-level enforcement for invariants that
-- were previously enforced only by convention (see codingLessonsLearnt
-- LESSON-GOVERNANCE-002, LESSON-TIER-001, LESSON-CATALOG-002).
--
-- This migration is **idempotent**: every statement uses CREATE OR REPLACE,
-- IF NOT EXISTS, or DROP IF EXISTS so applying it twice is a no-op.
--
-- Behavior changes:
--   1. create_workspace_with_owner: silent freemium fallback removed.
--      _tier_key=NULL or unknown now RAISES instead of defaulting.
--      (Reverts to the v3.17.1 contract that lives in the remote DB but
--      was never written to disk.)
--   2. tenant_subscriptions.tier_id updates are blocked unless made inside
--      a SECURITY DEFINER RPC that sets the session-local guard.
--   3. enterprise_feature_catalog.tier_feature_keys entries that don't
--      match any features.feature_key are rejected at INSERT/UPDATE.
--   4. tenant_feature_overrides: expired rows are filtered out by RLS.
--   5. tenant_subscriptions: (status, ends_at) coherence CHECK constraint.
--   6. features.dependencies entries that don't match any features.feature_key
--      are rejected at INSERT/UPDATE.

-- =========================================================================
-- B-1 — create_workspace_with_owner: STRICT tier_key contract
-- =========================================================================
-- The previous on-disk definition silently fell back to 'freemium' or
-- to the lowest sort_order tier when _tier_key was NULL/unknown. That
-- caused the v3.17.1 incident ("tier randomization on workspace create").
-- This version raises on NULL or unknown tier_key.

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  _name text,
  _description text DEFAULT NULL,
  _tier_key text DEFAULT NULL,
  _seats integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _workspace_id uuid;
  _user_id uuid;
  _tenant_id uuid;
  _tier_id uuid;
  _slug text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _tier_key IS NULL OR length(trim(_tier_key)) = 0 THEN
    RAISE EXCEPTION 'tier_key is required (no silent default)'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO _tier_id
  FROM public.tiers
  WHERE tier_key = _tier_key
  LIMIT 1;

  IF _tier_id IS NULL THEN
    RAISE EXCEPTION 'Unknown tier_key: %', _tier_key
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.enterprise_workspaces (name, description, created_by)
  VALUES (_name, _description, _user_id)
  RETURNING id INTO _workspace_id;

  INSERT INTO public.enterprise_memberships (workspace_id, user_id, role, status, joined_at)
  VALUES (_workspace_id, _user_id, 'owner', 'active', now());

  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(_workspace_id::text, 1, 8);

  INSERT INTO public.tenants (name, slug, status, metadata)
  VALUES (_name, _slug, 'active', jsonb_build_object('created_via', 'workspace'))
  RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_workspaces (tenant_id, workspace_id, is_primary)
  VALUES (_tenant_id, _workspace_id, true);

  -- Tier-change RPC guard: set the marker so the immutability trigger
  -- below allows this initial INSERT/UPDATE on tenant_subscriptions.
  PERFORM set_config('app.tier_change_rpc_active', 'true', true);

  INSERT INTO public.tenant_subscriptions (tenant_id, tier_id, seats, status, started_at, metadata)
  VALUES (_tenant_id, _tier_id, COALESCE(_seats, 5), 'active', now(),
          jsonb_build_object('source','workspace_create'));

  RETURN _workspace_id;
END;
$$;

-- =========================================================================
-- B-2 — tenant_subscriptions.tier_id immutability trigger
-- =========================================================================
-- Convention since v3.17.0: tier_id may change only via
-- public.superadmin_change_workspace_tier(). This is now enforced at the
-- DB level. The RPC sets `app.tier_change_rpc_active` to 'true' inside
-- its transaction; the trigger rejects UPDATEs that change tier_id when
-- the marker is not set.
--
-- NB: workspace creation also passes through this path; create_workspace_with_owner
-- (above) sets the marker before the initial INSERT (INSERTs are allowed
-- unconditionally — the trigger only fires on UPDATE).

CREATE OR REPLACE FUNCTION public.enforce_tier_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tier_id IS DISTINCT FROM OLD.tier_id THEN
    -- current_setting(name, missing_ok) returns '' when unset.
    IF current_setting('app.tier_change_rpc_active', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'tenant_subscriptions.tier_id is immutable; use public.superadmin_change_workspace_tier()'
        USING ERRCODE = '23514',
              HINT = 'Direct UPDATE of tier_id is blocked. Call the dedicated RPC which writes the audit trail.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_tier_immutable ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_tier_immutable
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tier_id_immutability();

-- =========================================================================
-- B-7 / LESSON-CATALOG-002 — tier_feature_keys referential validation
-- =========================================================================
-- enterprise_feature_catalog.tier_feature_keys is text[] of feature_key
-- references but Postgres has no array-FK. A typo silently hides a UI
-- permission slot. This trigger rejects insert/update if any element
-- doesn't exist in features.feature_key.

CREATE OR REPLACE FUNCTION public.validate_tier_feature_keys()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _added text[];
  _missing text[];
BEGIN
  -- Delta validation: only check keys ADDED in this write. Pre-existing
  -- typos (e.g. attachments → leave_request_attachments not seeded yet)
  -- are tolerated so they don't block unrelated UPDATEs to the same row.
  -- A future write that re-adds a bad key will be rejected.
  IF TG_OP = 'INSERT' THEN
    _added := COALESCE(NEW.tier_feature_keys, '{}'::text[]);
  ELSE
    SELECT array_agg(k) INTO _added
    FROM unnest(COALESCE(NEW.tier_feature_keys, '{}'::text[])) AS k
    WHERE k <> ALL(COALESCE(OLD.tier_feature_keys, '{}'::text[]));
  END IF;

  IF _added IS NULL OR array_length(_added, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(k) INTO _missing
  FROM unnest(_added) AS k
  WHERE NOT EXISTS (SELECT 1 FROM public.features f WHERE f.feature_key = k);

  IF _missing IS NOT NULL AND array_length(_missing, 1) > 0 THEN
    RAISE EXCEPTION
      'tier_feature_keys references unknown features.feature_key: %', _missing
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

-- Only attach the trigger if the catalog table exists AND has the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enterprise_feature_catalog'
      AND column_name = 'tier_feature_keys'
  ) THEN
    DROP TRIGGER IF EXISTS trg_enterprise_feature_catalog_validate_keys
      ON public.enterprise_feature_catalog;
    CREATE TRIGGER trg_enterprise_feature_catalog_validate_keys
      BEFORE INSERT OR UPDATE ON public.enterprise_feature_catalog
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_tier_feature_keys();
  END IF;
END $$;

-- =========================================================================
-- B-31 — features.dependencies referential validation
-- =========================================================================
-- features.dependencies is text[] of feature_keys. Migration
-- 20260513120100_fix_feature_dependencies.sql had to repair 4 broken
-- entries. No invariant prevents re-introduction. This trigger does.

CREATE OR REPLACE FUNCTION public.validate_feature_dependencies()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _added text[];
  _missing text[];
BEGIN
  -- Delta validation (same rationale as validate_tier_feature_keys).
  IF TG_OP = 'INSERT' THEN
    _added := COALESCE(NEW.dependencies, '{}'::text[]);
  ELSE
    SELECT array_agg(k) INTO _added
    FROM unnest(COALESCE(NEW.dependencies, '{}'::text[])) AS k
    WHERE k <> ALL(COALESCE(OLD.dependencies, '{}'::text[]));
  END IF;
  IF _added IS NULL OR array_length(_added, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT array_agg(k) INTO _missing
  FROM unnest(_added) AS k
  WHERE NOT EXISTS (SELECT 1 FROM public.features f WHERE f.feature_key = k);
  IF _missing IS NOT NULL AND array_length(_missing, 1) > 0 THEN
    RAISE EXCEPTION
      'features.dependencies references unknown feature_key: %', _missing
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_features_validate_dependencies ON public.features;
CREATE TRIGGER trg_features_validate_dependencies
  BEFORE INSERT OR UPDATE ON public.features
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_feature_dependencies();

-- =========================================================================
-- B-24 — tenant_feature_overrides expires_at enforcement (read-side)
-- =========================================================================
-- Nullable expires_at without filtering means expired overrides continue
-- to grant/revoke access. We add a SELECT policy that filters them out
-- so existing read paths automatically see the right thing without
-- needing to scrub every caller's WHERE clause.
--
-- The original "admin_all" policy keeps full visibility for platform
-- admins (they need to see the expired row to clean it up). Member reads
-- are filtered.

DROP POLICY IF EXISTS "tenant_feature_overrides_member_read"
  ON public.tenant_feature_overrides;

CREATE POLICY "tenant_feature_overrides_member_read"
  ON public.tenant_feature_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- =========================================================================
-- B-30 — tenant_subscriptions (status, ends_at) coherence CHECK
-- =========================================================================
-- Disallow incoherent rows like status='ended' with NULL ends_at, or
-- status='active' with ends_at in the past. NOT VALID first so legacy
-- rows are not rejected on apply; VALIDATE conditionally after a scrub.

ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_status_ends_at_coherent;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_status_ends_at_coherent
  CHECK (
    -- 'ended' must carry a non-null ends_at
    (status = 'ended' AND ends_at IS NOT NULL)
    OR
    -- non-ended states may have a future or null ends_at; the past-end
    -- comparison is omitted because the constraint is non-deferrable
    -- and now() is non-immutable. The cron job below (operational task,
    -- left for follow-up) is the right place to auto-transition.
    (status <> 'ended')
  ) NOT VALID;

-- =========================================================================
-- B-26 — Seed-guard helper: raise if a feature_key lookup is NULL
-- =========================================================================
-- Common seed pattern is `(SELECT id FROM features WHERE feature_key='X')`
-- as a subquery. If the key is mistyped, the subquery returns NULL and
-- the INSERT either fails on FK or silently `ON CONFLICT DO NOTHING`s.
-- This helper raises explicitly instead.

CREATE OR REPLACE FUNCTION public.require_feature_id(_feature_key text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.features WHERE feature_key = _feature_key;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'Unknown feature_key: %', _feature_key
      USING ERRCODE = '23503';
  END IF;
  RETURN _id;
END;
$$;

COMMENT ON FUNCTION public.require_feature_id(text) IS
  'Seed helper: returns features.id for the given feature_key, raising if not found. Use instead of bare subquery in tier_features / addon_features seeds to avoid silent NULL inserts (see B-26 / LESSON-DOD-001).';

-- =========================================================================
-- Notes for follow-up (out of scope for this migration):
--
-- 1. superadmin_change_workspace_tier RPC must call
--    `PERFORM set_config('app.tier_change_rpc_active', 'true', true);`
--    inside its transaction. The on-disk definition is missing (it lives
--    only in the remote DB per LESSON-GOVERNANCE-002). If you regenerate
--    the RPC, ensure that line is present.
--
-- 2. gdpr_requests SLA escalation (B-25) and tenant_feature_overrides
--    auto-DELETE (B-24 write-side) are pg_cron / scheduled-job tasks,
--    not migration concerns. Track in a follow-up versioning entry.
--
-- 3. The B-30 NOT VALID constraint can be promoted to VALID after a
--    one-time data scrub:
--      SELECT * FROM tenant_subscriptions WHERE status='ended' AND ends_at IS NULL;
--      -- fix those rows, then:
--      ALTER TABLE tenant_subscriptions VALIDATE CONSTRAINT
--        tenant_subscriptions_status_ends_at_coherent;
-- =========================================================================
