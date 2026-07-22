-- v3.51.7: durable provisioning saga and database-first compensation for
-- enterprise instant identities.
--
-- The saga row is committed before the Auth request. A crashed writer therefore
-- leaves a durable `provisioning` intent which the privileged worker can bind to
-- the exact server-controlled Auth app_metadata, retry the database cleanup,
-- and only then remove Auth. Successful provisioning is also acknowledged by a
-- server-side postcondition before a writer may return success.

DO $created_identity_cleanup_preflight$
BEGIN
  IF pg_catalog.to_regnamespace('effectime_private') IS NULL
     OR pg_catalog.to_regclass('public.enterprise_memberships') IS NULL
     OR pg_catalog.to_regclass('public.enterprise_member_role_allocations') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('auth.users') IS NULL
     OR pg_catalog.to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'Created identity cleanup prerequisites are missing'
      USING ERRCODE = '55000';
  END IF;
END;
$created_identity_cleanup_preflight$;

CREATE TABLE effectime_private.created_identity_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  cleanup_intent_id uuid NOT NULL UNIQUE,
  workspace_id uuid NOT NULL,
  user_id uuid UNIQUE,
  membership_id uuid,
  status text NOT NULL DEFAULT 'provisioning',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT pg_catalog.now() + interval '5 minutes',
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  completed_at timestamptz,
  CONSTRAINT created_identity_cleanup_jobs_identity_unique
    UNIQUE (workspace_id, user_id),
  CONSTRAINT created_identity_cleanup_jobs_status_check
    CHECK (status IN ('provisioning', 'pending_auth', 'provisioned', 'completed')),
  CONSTRAINT created_identity_cleanup_jobs_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT created_identity_cleanup_jobs_error_code_check
    CHECK (
      last_error_code IS NULL
      OR last_error_code IN (
        'identity_not_visible',
        'database_cleanup_failed',
        'auth_lookup_failed',
        'auth_delete_failed'
      )
    ),
  CONSTRAINT created_identity_cleanup_jobs_completion_check
    CHECK (
      (status IN ('provisioning', 'pending_auth') AND completed_at IS NULL)
      OR (status IN ('provisioned', 'completed') AND completed_at IS NOT NULL)
    ),
  CONSTRAINT created_identity_cleanup_jobs_bound_state_check
    CHECK (
      status = 'provisioning'
      OR (status IN ('pending_auth', 'completed') AND user_id IS NOT NULL)
      OR (status = 'provisioned' AND user_id IS NOT NULL AND membership_id IS NOT NULL)
    )
);

ALTER TABLE effectime_private.created_identity_cleanup_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX created_identity_cleanup_jobs_pending_retry_idx
  ON effectime_private.created_identity_cleanup_jobs(next_attempt_at, created_at, id)
  WHERE status IN ('provisioning', 'pending_auth');

-- Every membership/profile writer joins a per-user cleanup gate before it can
-- create or mutate tenant-visible data. Once database-first cleanup has entered
-- pending_auth (or completed), a delayed writer cannot resurrect that identity.
CREATE OR REPLACE FUNCTION effectime_private.guard_created_identity_cleanup_write_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':created-identity-cleanup-write',
      734560
    )
  );

  IF EXISTS (
    SELECT 1
    FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
    WHERE cleanup_job.user_id = v_user_id
      AND cleanup_job.status IN ('pending_auth', 'completed')
  ) THEN
    RAISE EXCEPTION 'Identity cleanup state rejects tenant-visible writes'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION effectime_private.guard_created_identity_cleanup_write_v1()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION effectime_private.guard_created_identity_cleanup_write_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS zz_guard_created_identity_cleanup_membership_write
  ON public.enterprise_memberships;
CREATE TRIGGER zz_guard_created_identity_cleanup_membership_write
BEFORE INSERT OR UPDATE ON public.enterprise_memberships
FOR EACH ROW
EXECUTE FUNCTION effectime_private.guard_created_identity_cleanup_write_v1();

DROP TRIGGER IF EXISTS zz_guard_created_identity_cleanup_profile_write
  ON public.profiles;
CREATE TRIGGER zz_guard_created_identity_cleanup_profile_write
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION effectime_private.guard_created_identity_cleanup_write_v1();

CREATE OR REPLACE FUNCTION public.register_created_enterprise_identity_provisioning_v1(
  p_workspace_id uuid,
  p_cleanup_intent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_job record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_workspace_id IS NULL OR p_cleanup_intent_id IS NULL THEN
    RAISE EXCEPTION 'Workspace and cleanup intent are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_cleanup_intent_id::text || ':created-identity-provisioning',
      734558
    )
  );

  INSERT INTO effectime_private.created_identity_cleanup_jobs (
    cleanup_intent_id,
    workspace_id,
    status,
    next_attempt_at
  ) VALUES (
    p_cleanup_intent_id,
    p_workspace_id,
    'provisioning',
    pg_catalog.now() + interval '5 minutes'
  )
  ON CONFLICT (cleanup_intent_id) DO NOTHING;

  SELECT cleanup_job.id,
         cleanup_job.cleanup_intent_id,
         cleanup_job.workspace_id,
         cleanup_job.status
  INTO v_job
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.cleanup_intent_id = p_cleanup_intent_id
  FOR UPDATE;

  IF v_job.id IS NULL
     OR v_job.workspace_id IS DISTINCT FROM p_workspace_id
     OR v_job.status IS DISTINCT FROM 'provisioning' THEN
    RAISE EXCEPTION 'Cleanup intent is not an available provisioning saga'
      USING ERRCODE = '22023';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', v_job.id,
    'cleanup_intent_id', v_job.cleanup_intent_id,
    'workspace_id', v_job.workspace_id,
    'status', v_job.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(
  p_cleanup_job_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_membership_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_job record;
  v_candidate_user_ids uuid[];
  v_resolved_user_id uuid;
  v_auth_metadata jsonb;
  v_membership_ids uuid[];
  v_resolved_membership_id uuid;
  v_existing_membership record;
  v_deleted_membership_count integer := 0;
  v_deleted_profile_count integer := 0;
  v_remaining_membership_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL THEN
    RAISE EXCEPTION 'Cleanup job is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_cleanup_job_id::text || ':created-identity-provisioning',
      734558
    )
  );

  SELECT cleanup_job.id,
         cleanup_job.cleanup_intent_id,
         cleanup_job.workspace_id,
         cleanup_job.user_id,
         cleanup_job.membership_id,
         cleanup_job.status
  INTO v_job
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup job was not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.status = 'provisioned' THEN
    RAISE EXCEPTION 'Provisioned identity cannot enter cleanup'
      USING ERRCODE = '55000';
  END IF;

  IF v_job.status = 'completed' THEN
    IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_job.user_id THEN
      RAISE EXCEPTION 'Cleanup job identity is immutable' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.user_id = v_job.user_id
    ) OR EXISTS (
      SELECT 1 FROM public.profiles AS profile WHERE profile.user_id = v_job.user_id
    ) THEN
      RAISE EXCEPTION 'Completed cleanup postcondition is no longer true'
        USING ERRCODE = '55000';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'cleanup_job_id', v_job.id,
      'status', 'pending_auth',
      'user_id', v_job.user_id,
      'deleted_membership_count', 0,
      'deleted_profile_count', 0,
      'remaining_membership_count', 0
    );
  END IF;

  IF v_job.status = 'pending_auth' THEN
    v_resolved_user_id := v_job.user_id;
    IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_resolved_user_id THEN
      RAISE EXCEPTION 'Cleanup job identity is immutable' USING ERRCODE = '22023';
    END IF;
    IF p_membership_id IS NOT NULL
       AND p_membership_id IS DISTINCT FROM v_job.membership_id THEN
      RAISE EXCEPTION 'Cleanup membership identity is immutable' USING ERRCODE = '22023';
    END IF;
    v_resolved_membership_id := v_job.membership_id;
  ELSE
    IF p_user_id IS NULL THEN
      SELECT pg_catalog.array_agg(auth_user.id ORDER BY auth_user.id)
      INTO v_candidate_user_ids
      FROM auth.users AS auth_user
      WHERE auth_user.raw_app_meta_data ->> 'effectime_identity_kind'
              = 'enterprise_instant_member'
        AND auth_user.raw_app_meta_data ->> 'effectime_workspace_id'
              = v_job.workspace_id::text
        AND auth_user.raw_app_meta_data ->> 'effectime_cleanup_intent_id'
              = v_job.cleanup_intent_id::text;

      IF coalesce(pg_catalog.cardinality(v_candidate_user_ids), 0) = 0 THEN
        RAISE EXCEPTION 'Created Auth identity is not visible yet'
          USING ERRCODE = 'P0002';
      END IF;
      IF pg_catalog.cardinality(v_candidate_user_ids) <> 1 THEN
        RAISE EXCEPTION 'Cleanup intent matched multiple Auth identities'
          USING ERRCODE = '21000';
      END IF;
      v_resolved_user_id := v_candidate_user_ids[1];
    ELSE
      v_resolved_user_id := p_user_id;
    END IF;

    SELECT auth_user.raw_app_meta_data
    INTO v_auth_metadata
    FROM auth.users AS auth_user
    WHERE auth_user.id = v_resolved_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_auth_metadata ->> 'effectime_identity_kind'
            IS DISTINCT FROM 'enterprise_instant_member'
       OR v_auth_metadata ->> 'effectime_workspace_id'
            IS DISTINCT FROM v_job.workspace_id::text
       OR v_auth_metadata ->> 'effectime_cleanup_intent_id'
            IS DISTINCT FROM v_job.cleanup_intent_id::text THEN
      RAISE EXCEPTION 'Identity is not the registered enterprise instant-user candidate'
        USING ERRCODE = '42501';
    END IF;

    IF v_job.user_id IS NOT NULL
       AND v_job.user_id IS DISTINCT FROM v_resolved_user_id THEN
      RAISE EXCEPTION 'Cleanup job identity is immutable' USING ERRCODE = '22023';
    END IF;

    SELECT pg_catalog.array_agg(membership.id ORDER BY membership.id)
    INTO v_membership_ids
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = v_job.workspace_id
      AND membership.user_id = v_resolved_user_id;

    IF coalesce(pg_catalog.cardinality(v_membership_ids), 0) > 1 THEN
      RAISE EXCEPTION 'Created identity has multiple workspace memberships'
        USING ERRCODE = '55000';
    END IF;

    v_resolved_membership_id := coalesce(
      p_membership_id,
      CASE
        WHEN pg_catalog.cardinality(v_membership_ids) = 1 THEN v_membership_ids[1]
        ELSE NULL
      END
    );

    IF p_membership_id IS NOT NULL THEN
      SELECT membership.id,
             membership.workspace_id,
             membership.user_id,
             membership.role,
             membership.status
      INTO v_existing_membership
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = p_membership_id
      FOR UPDATE;

      IF FOUND AND (
        v_existing_membership.workspace_id IS DISTINCT FROM v_job.workspace_id
        OR v_existing_membership.user_id IS DISTINCT FROM v_resolved_user_id
        OR v_existing_membership.role IS DISTINCT FROM 'member'::public.enterprise_role
        OR v_existing_membership.status
             IS DISTINCT FROM 'active'::public.enterprise_membership_status
      ) THEN
        RAISE EXCEPTION 'Membership does not belong to the cleanup identity'
          USING ERRCODE = '22023';
      END IF;

      IF NOT FOUND
         AND coalesce(pg_catalog.cardinality(v_membership_ids), 0) <> 0 THEN
        RAISE EXCEPTION 'Membership identity is stale' USING ERRCODE = '40001';
      END IF;
    END IF;
  END IF;

  IF v_resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'Cleanup identity is not bound' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.user_id = v_resolved_user_id
      AND membership.workspace_id <> v_job.workspace_id
  ) THEN
    RAISE EXCEPTION 'Identity has a membership outside the cleanup workspace'
      USING ERRCODE = '23503';
  END IF;

  -- Join the same workspace-scoped gate as every business-role writer. If a
  -- role deletion currently owns the gate, lock_timeout aborts this attempt and
  -- the already-committed provisioning saga remains retryable.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_job.workspace_id::text || ':business-role-mutation',
      734559
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_resolved_user_id::text || ':created-identity-cleanup-write',
      734560
    )
  );

  DELETE FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = v_job.workspace_id
    AND membership.user_id = v_resolved_user_id;
  GET DIAGNOSTICS v_deleted_membership_count = ROW_COUNT;

  SELECT pg_catalog.count(*)::integer
  INTO v_remaining_membership_count
  FROM public.enterprise_memberships AS membership
  WHERE membership.user_id = v_resolved_user_id;

  IF v_remaining_membership_count <> 0 THEN
    RAISE EXCEPTION 'Created identity membership cleanup is incomplete'
      USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.profiles AS profile
  WHERE profile.user_id = v_resolved_user_id;
  GET DIAGNOSTICS v_deleted_profile_count = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.user_id = v_resolved_user_id
  ) THEN
    RAISE EXCEPTION 'Created identity profile cleanup is incomplete'
      USING ERRCODE = '55000';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET user_id = v_resolved_user_id,
      membership_id = v_resolved_membership_id,
      status = 'pending_auth',
      next_attempt_at = pg_catalog.now(),
      lease_expires_at = NULL,
      last_error_code = NULL,
      updated_at = pg_catalog.now()
  WHERE cleanup_job.id = v_job.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', v_job.id,
    'status', 'pending_auth',
    'user_id', v_resolved_user_id,
    'deleted_membership_count', v_deleted_membership_count,
    'deleted_profile_count', v_deleted_profile_count,
    'remaining_membership_count', v_remaining_membership_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_created_enterprise_identity_provisioning_v1(
  p_cleanup_job_id uuid,
  p_user_id uuid,
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_job record;
  v_auth_metadata jsonb;
  v_membership record;
  v_allocation_count integer;
  v_allocation_total numeric;
  v_priority_count integer;
  v_priority_role text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL OR p_user_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Provisioning receipt identity is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT cleanup_job.id,
         cleanup_job.cleanup_intent_id,
         cleanup_job.workspace_id,
         cleanup_job.user_id,
         cleanup_job.membership_id,
         cleanup_job.status
  INTO v_job
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisioning saga was not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.status NOT IN ('provisioning', 'provisioned')
     OR (v_job.user_id IS NOT NULL AND v_job.user_id IS DISTINCT FROM p_user_id)
     OR (v_job.membership_id IS NOT NULL
         AND v_job.membership_id IS DISTINCT FROM p_membership_id) THEN
    RAISE EXCEPTION 'Provisioning saga state or identity is invalid'
      USING ERRCODE = '55000';
  END IF;

  SELECT auth_user.raw_app_meta_data
  INTO v_auth_metadata
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_auth_metadata ->> 'effectime_identity_kind'
          IS DISTINCT FROM 'enterprise_instant_member'
     OR v_auth_metadata ->> 'effectime_workspace_id'
          IS DISTINCT FROM v_job.workspace_id::text
     OR v_auth_metadata ->> 'effectime_cleanup_intent_id'
          IS DISTINCT FROM v_job.cleanup_intent_id::text THEN
    RAISE EXCEPTION 'Provisioned Auth identity proof is invalid'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_job.workspace_id::text || ':business-role-mutation',
      734559
    )
  );

  SELECT membership.id,
         membership.user_id,
         membership.workspace_id,
         membership.role,
         membership.status,
         membership.business_role
  INTO v_membership
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_membership.user_id IS DISTINCT FROM p_user_id
     OR v_membership.workspace_id IS DISTINCT FROM v_job.workspace_id
     OR v_membership.role IS DISTINCT FROM 'member'::public.enterprise_role
     OR v_membership.status IS DISTINCT FROM 'active'::public.enterprise_membership_status
     OR EXISTS (
       SELECT 1
       FROM public.enterprise_memberships AS other_membership
       WHERE other_membership.user_id = p_user_id
         AND other_membership.workspace_id <> v_job.workspace_id
     ) THEN
    RAISE EXCEPTION 'Provisioned membership postcondition is invalid'
      USING ERRCODE = '55000';
  END IF;

  PERFORM 1
  FROM public.profiles AS profile
  WHERE profile.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisioned profile postcondition is invalid'
      USING ERRCODE = '55000';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         coalesce(pg_catalog.sum(allocation.percentage), 0),
         pg_catalog.count(*) FILTER (WHERE allocation.is_priority),
         pg_catalog.max(allocation.business_role) FILTER (WHERE allocation.is_priority)
  INTO v_allocation_count,
       v_allocation_total,
       v_priority_count,
       v_priority_role
  FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.workspace_id = v_job.workspace_id
    AND allocation.membership_id = p_membership_id;

  IF (
    v_membership.business_role IS NULL
    AND v_allocation_count <> 0
  ) OR (
    v_membership.business_role IS NOT NULL
    AND (
      v_allocation_count < 1
      OR v_allocation_count > 20
      OR v_allocation_total <> 100
      OR v_priority_count <> 1
      OR v_priority_role IS DISTINCT FROM v_membership.business_role
    )
  ) THEN
    RAISE EXCEPTION 'Provisioned role-allocation postcondition is invalid'
      USING ERRCODE = '55000';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET user_id = p_user_id,
      membership_id = p_membership_id,
      status = 'provisioned',
      lease_expires_at = NULL,
      last_error_code = NULL,
      completed_at = coalesce(cleanup_job.completed_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE cleanup_job.id = v_job.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', v_job.id,
    'status', 'provisioned',
    'user_id', p_user_id,
    'membership_id', p_membership_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(
  p_limit integer DEFAULT 25
)
RETURNS TABLE(cleanup_job_id uuid, status text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Cleanup claim limit is invalid' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT cleanup_job.id
    FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
    WHERE cleanup_job.status IN ('provisioning', 'pending_auth')
      AND cleanup_job.next_attempt_at <= pg_catalog.now()
      AND (
        cleanup_job.lease_expires_at IS NULL
        OR cleanup_job.lease_expires_at <= pg_catalog.now()
      )
    ORDER BY cleanup_job.next_attempt_at, cleanup_job.created_at, cleanup_job.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET attempt_count = cleanup_job.attempt_count + 1,
      lease_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  FROM candidates
  WHERE cleanup_job.id = candidates.id
  RETURNING cleanup_job.id, cleanup_job.status, cleanup_job.user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_created_enterprise_identity_cleanup_v1(
  p_cleanup_job_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_job record;
  v_remaining_membership_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Cleanup job and user are required' USING ERRCODE = '22023';
  END IF;

  SELECT cleanup_job.id,
         cleanup_job.workspace_id,
         cleanup_job.user_id,
         cleanup_job.status
  INTO v_job
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_job.user_id IS DISTINCT FROM p_user_id
     OR v_job.status NOT IN ('pending_auth', 'completed') THEN
    RAISE EXCEPTION 'Pending cleanup job identity was not found'
     USING ERRCODE = 'P0002';
  END IF;

  -- Rejoin both mutation gates after the Edge worker has proven exact Auth
  -- absence. This makes finalization a second idempotent DB cleanup, not a
  -- check-then-state race.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_job.workspace_id::text || ':business-role-mutation',
      734559
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text || ':created-identity-cleanup-write',
      734560
    )
  );

  IF EXISTS (
    SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cleanup Auth postcondition is not complete'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.user_id = p_user_id
      AND membership.workspace_id <> v_job.workspace_id
  ) THEN
    RAISE EXCEPTION 'Cleanup identity has a membership outside its workspace'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = v_job.workspace_id
    AND membership.user_id = p_user_id;

  SELECT pg_catalog.count(*)::integer
  INTO v_remaining_membership_count
  FROM public.enterprise_memberships AS membership
  WHERE membership.user_id = p_user_id;

  IF v_remaining_membership_count <> 0 THEN
    RAISE EXCEPTION 'Cleanup membership postcondition is not complete'
      USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.profiles AS profile
  WHERE profile.user_id = p_user_id;

  IF EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cleanup profile postcondition is not complete'
      USING ERRCODE = '55000';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET status = 'completed',
      lease_expires_at = NULL,
      last_error_code = NULL,
      completed_at = coalesce(cleanup_job.completed_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE cleanup_job.id = p_cleanup_job_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', p_cleanup_job_id,
    'status', 'completed'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_created_enterprise_identity_cleanup_v1(
  p_cleanup_job_id uuid,
  p_user_id uuid,
  p_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_attempt_count integer;
  v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL
     OR p_error_code NOT IN (
       'identity_not_visible',
       'database_cleanup_failed',
       'auth_lookup_failed',
       'auth_delete_failed'
     ) THEN
    RAISE EXCEPTION 'Cleanup failure receipt is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET lease_expires_at = NULL,
      last_error_code = p_error_code,
      next_attempt_at = pg_catalog.now()
        + pg_catalog.make_interval(
          secs => LEAST(
            3600,
            30 * pg_catalog.power(2::numeric, LEAST(cleanup_job.attempt_count, 7))::integer
          )
        ),
      updated_at = pg_catalog.now()
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.status IN ('provisioning', 'pending_auth')
    AND (
      (cleanup_job.user_id IS NULL AND p_user_id IS NULL)
      OR cleanup_job.user_id = p_user_id
    )
    AND (
      (cleanup_job.status = 'provisioning'
       AND p_error_code IN ('identity_not_visible', 'database_cleanup_failed'))
      OR (cleanup_job.status = 'pending_auth'
          AND p_error_code IN (
            'database_cleanup_failed',
            'auth_lookup_failed',
            'auth_delete_failed'
          ))
    )
  RETURNING cleanup_job.attempt_count, cleanup_job.status
  INTO v_attempt_count, v_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending cleanup job state was not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', p_cleanup_job_id,
    'status', v_status,
    'attempt_count', v_attempt_count,
    'error_code', p_error_code
  );
END;
$function$;

ALTER FUNCTION public.register_created_enterprise_identity_provisioning_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.complete_created_enterprise_identity_provisioning_v1(uuid, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)
  OWNER TO postgres;
ALTER FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  OWNER TO postgres;

REVOKE ALL ON TABLE effectime_private.created_identity_cleanup_jobs
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_created_enterprise_identity_provisioning_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_created_enterprise_identity_provisioning_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_created_enterprise_identity_provisioning_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_created_enterprise_identity_provisioning_v1(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
