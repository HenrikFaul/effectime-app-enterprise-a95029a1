-- v3.51.8: fenced created-identity cleanup worker and dormant scheduler.
--
-- This migration deliberately does not create a cron job. Operators install the
-- scheduler only after the Edge function, Vault values and target project have
-- been independently verified. The cron command resolves all credentials from
-- Vault at execution time; no credential or project URL is persisted in
-- cron.job.command.

DO $created_identity_cleanup_scheduler_preflight$
DECLARE
  v_profile_user_attnum smallint;
  v_profile_event_attnum smallint;
  v_event_id_attnum smallint;
  v_event_creator_attnum smallint;
  v_auth_user_id_attnum smallint;
  v_vote_user_attnum smallint;
  v_vote_event_attnum smallint;
  v_participant_user_attnum smallint;
  v_participant_event_attnum smallint;
BEGIN
  IF pg_catalog.to_regnamespace('effectime_private') IS NULL
     OR pg_catalog.to_regclass(
          'effectime_private.created_identity_cleanup_jobs'
        ) IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('public.events') IS NULL
     OR pg_catalog.to_regclass('public.votes') IS NULL
     OR pg_catalog.to_regclass('public.event_participants') IS NULL
     OR pg_catalog.to_regclass('auth.users') IS NULL
     OR pg_catalog.to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'Created identity cleanup scheduler prerequisites are missing'
      USING ERRCODE = '55000';
  END IF;

  -- The legacy-profile lease is deliberately installed only on the schema it
  -- was reviewed against. In particular, the profile/Auth cascade is what lets
  -- the guard distinguish a real GoTrue deletion from a direct profile delete.
  -- Keep this preflight before every DDL statement so an incompatible database
  -- fails with one explicit 55000 and no partially installed lease contract.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
      AND attribute_record.attname = 'user_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
      AND attribute_record.attname = 'is_temporary'
      AND attribute_record.atttypid = 'boolean'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
      AND attribute_record.attname = 'linked_event_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
      AND attribute_record.attname = 'created_at'
      AND attribute_record.atttypid = 'timestamp with time zone'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) THEN
    RAISE EXCEPTION 'Temporary profile cleanup profile-column contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.events'::pg_catalog.regclass
      AND attribute_record.attname = 'id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.events'::pg_catalog.regclass
      AND attribute_record.attname = 'created_by'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.events'::pg_catalog.regclass
      AND attribute_record.attname = 'end_date'
      AND attribute_record.atttypid = 'date'::pg_catalog.regtype
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.votes'::pg_catalog.regclass
      AND attribute_record.attname = 'event_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.votes'::pg_catalog.regclass
      AND attribute_record.attname = 'user_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.event_participants'::pg_catalog.regclass
      AND attribute_record.attname = 'event_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'public.event_participants'::pg_catalog.regclass
      AND attribute_record.attname = 'user_id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute_record
    WHERE attribute_record.attrelid = 'auth.users'::pg_catalog.regclass
      AND attribute_record.attname = 'id'
      AND attribute_record.atttypid = 'uuid'::pg_catalog.regtype
      AND attribute_record.attnotnull
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) THEN
    RAISE EXCEPTION 'Temporary profile cleanup related-column contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  SELECT attribute_record.attnum
  INTO v_profile_user_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
    AND attribute_record.attname = 'user_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_profile_event_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.profiles'::pg_catalog.regclass
    AND attribute_record.attname = 'linked_event_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_event_id_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.events'::pg_catalog.regclass
    AND attribute_record.attname = 'id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_event_creator_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.events'::pg_catalog.regclass
    AND attribute_record.attname = 'created_by'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_auth_user_id_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'auth.users'::pg_catalog.regclass
    AND attribute_record.attname = 'id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_vote_user_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.votes'::pg_catalog.regclass
    AND attribute_record.attname = 'user_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_vote_event_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.votes'::pg_catalog.regclass
    AND attribute_record.attname = 'event_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_participant_user_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.event_participants'::pg_catalog.regclass
    AND attribute_record.attname = 'user_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  SELECT attribute_record.attnum
  INTO v_participant_event_attnum
  FROM pg_catalog.pg_attribute AS attribute_record
  WHERE attribute_record.attrelid = 'public.event_participants'::pg_catalog.regclass
    AND attribute_record.attname = 'event_id'
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.contype IN ('p', 'u')
      AND constraint_record.conkey = ARRAY[v_profile_user_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.events'::pg_catalog.regclass
      AND constraint_record.contype IN ('p', 'u')
      AND constraint_record.conkey = ARRAY[v_event_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.confrelid = 'auth.users'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_profile_user_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_auth_user_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.confrelid = 'public.events'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_profile_event_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_event_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.events'::pg_catalog.regclass
      AND constraint_record.confrelid = 'auth.users'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_event_creator_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_auth_user_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.votes'::pg_catalog.regclass
      AND constraint_record.confrelid = 'auth.users'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_vote_user_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_auth_user_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.event_participants'::pg_catalog.regclass
      AND constraint_record.confrelid = 'auth.users'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_participant_user_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_auth_user_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.votes'::pg_catalog.regclass
      AND constraint_record.confrelid = 'public.events'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_vote_event_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_event_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.event_participants'::pg_catalog.regclass
      AND constraint_record.confrelid = 'public.events'::pg_catalog.regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conkey = ARRAY[v_participant_event_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_event_id_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Temporary profile cleanup key and cascade contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$created_identity_cleanup_scheduler_preflight$;

ALTER TABLE effectime_private.created_identity_cleanup_jobs
  ADD COLUMN lease_token uuid;

-- v3.51.7 leases had no fencing token and therefore cannot safely survive the
-- contract upgrade. Releasing only those legacy leases is safe: the first v2
-- claimant receives a new opaque token before it may mutate a job.
UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
SET lease_expires_at = NULL,
    updated_at = pg_catalog.now()
WHERE cleanup_job.lease_expires_at IS NOT NULL;

ALTER TABLE effectime_private.created_identity_cleanup_jobs
  ADD CONSTRAINT created_identity_cleanup_jobs_lease_pair_check
  CHECK (
    (lease_token IS NULL AND lease_expires_at IS NULL)
    OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
  );

CREATE TABLE effectime_private.created_identity_cleanup_worker_state (
  singleton boolean PRIMARY KEY DEFAULT true,
  active_run_id uuid,
  lease_expires_at timestamptz,
  active_started_at timestamptz,
  last_run_id uuid,
  last_status text,
  last_claimed integer,
  last_completed integer,
  last_pending integer,
  last_receipt_failures integer,
  last_error_code text,
  last_finished_at timestamptz,
  overlap_count bigint NOT NULL DEFAULT 0,
  scheduler_job_id bigint,
  scheduler_project_ref text,
  scheduler_installed_at timestamptz,
  CONSTRAINT created_identity_cleanup_worker_singleton_check
    CHECK (singleton),
  CONSTRAINT created_identity_cleanup_worker_active_lease_check
    CHECK (
      (active_run_id IS NULL
       AND lease_expires_at IS NULL
       AND active_started_at IS NULL)
      OR (active_run_id IS NOT NULL
          AND lease_expires_at IS NOT NULL
          AND active_started_at IS NOT NULL)
    ),
  CONSTRAINT created_identity_cleanup_worker_status_check
    CHECK (last_status IS NULL OR last_status IN ('succeeded', 'failed')),
  CONSTRAINT created_identity_cleanup_worker_counts_check
    CHECK (
      (last_run_id IS NULL
       AND last_status IS NULL
       AND last_claimed IS NULL
       AND last_completed IS NULL
       AND last_pending IS NULL
       AND last_receipt_failures IS NULL
       AND last_error_code IS NULL
       AND last_finished_at IS NULL)
      OR (
        last_run_id IS NOT NULL
        AND last_status IS NOT NULL
        AND last_claimed IS NOT NULL
        AND last_completed IS NOT NULL
        AND last_pending IS NOT NULL
        AND last_receipt_failures IS NOT NULL
        AND last_claimed >= 0
        AND last_completed >= 0
        AND last_pending >= 0
        AND last_receipt_failures >= 0
        AND last_completed + last_pending = last_claimed
        AND last_receipt_failures <= last_pending
        AND last_finished_at IS NOT NULL
      )
    ),
  CONSTRAINT created_identity_cleanup_worker_error_check
    CHECK (
      (last_status IS NULL AND last_error_code IS NULL)
      OR (last_status = 'succeeded' AND last_error_code IS NULL)
      OR (
        last_status = 'failed'
        AND last_error_code IS NOT NULL
        AND last_error_code IN (
          'worker_deadline_exceeded',
          'batch_failed',
          'receipt_persistence_failed',
          'invocation_failed'
        )
      )
    ),
  CONSTRAINT created_identity_cleanup_scheduler_project_ref_check
    CHECK (
      scheduler_project_ref IS NULL
      OR scheduler_project_ref ~ '^[a-z0-9]{20}$'
    )
);

ALTER TABLE effectime_private.created_identity_cleanup_worker_state
  ENABLE ROW LEVEL SECURITY;

INSERT INTO effectime_private.created_identity_cleanup_worker_state(singleton)
VALUES (true);

ALTER TABLE effectime_private.created_identity_cleanup_worker_state
  ADD CONSTRAINT created_identity_cleanup_scheduler_installation_check
  CHECK (
    (scheduler_job_id IS NULL
     AND scheduler_project_ref IS NULL
     AND scheduler_installed_at IS NULL)
    OR (scheduler_job_id IS NOT NULL
        AND scheduler_project_ref IS NOT NULL
        AND scheduler_installed_at IS NOT NULL)
  );

-- An active fencing token is immutable. Only the current, unexpired holder may
-- preserve it while a v1 writer implementation performs the underlying
-- transaction. Expired holders cannot mutate; a v2 claim is the only allowed
-- operation that replaces a token.
CREATE OR REPLACE FUNCTION effectime_private.enforce_created_identity_cleanup_lease_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_presented_token text;
BEGIN
  v_presented_token := pg_catalog.current_setting(
    'effectime.created_identity_cleanup_lease_token',
    true
  );

  IF OLD.lease_token IS NULL THEN
    IF NEW.lease_token IS NULL THEN
      IF NEW.lease_expires_at IS NOT NULL THEN
        RAISE EXCEPTION 'Unfenced cleanup leases are disabled'
          USING ERRCODE = '0A000';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.lease_expires_at IS NULL
       OR NEW.lease_expires_at <= pg_catalog.now()
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.status NOT IN ('provisioning', 'pending_auth')
       OR NEW.attempt_count IS DISTINCT FROM OLD.attempt_count + 1 THEN
      RAISE EXCEPTION 'Cleanup lease claim is invalid'
        USING ERRCODE = '40001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.lease_token IS DISTINCT FROM OLD.lease_token THEN
    IF OLD.lease_expires_at > pg_catalog.now()
       OR NEW.lease_token IS NULL
       OR NEW.lease_expires_at IS NULL
       OR NEW.lease_expires_at <= pg_catalog.now()
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.status NOT IN ('provisioning', 'pending_auth')
       OR NEW.attempt_count IS DISTINCT FROM OLD.attempt_count + 1 THEN
      RAISE EXCEPTION 'Cleanup lease replacement is invalid'
        USING ERRCODE = '40001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.lease_expires_at <= pg_catalog.now()
     OR v_presented_token IS NULL
     OR v_presented_token IS DISTINCT FROM OLD.lease_token::text THEN
    RAISE EXCEPTION 'Cleanup lease ownership was lost'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.lease_expires_at IS NULL THEN
    NEW.lease_expires_at := OLD.lease_expires_at;
  ELSIF NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at THEN
    RAISE EXCEPTION 'Cleanup lease expiry is immutable'
      USING ERRCODE = '40001';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION effectime_private.enforce_created_identity_cleanup_lease_v2()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION effectime_private.enforce_created_identity_cleanup_lease_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER enforce_created_identity_cleanup_lease_v2
BEFORE UPDATE ON effectime_private.created_identity_cleanup_jobs
FOR EACH ROW
EXECUTE FUNCTION effectime_private.enforce_created_identity_cleanup_lease_v2();

-- Retain the reviewed v3.51.7 transaction bodies as owner-only implementation
-- details. Public v1 wrappers now prove that no fenced worker owns the job
-- before entering those bodies; v2 wrappers prove the exact opposite and pass
-- the current token to the lease trigger. This makes the v1 denial independent
-- of any caller-controlled session setting.
ALTER FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  RENAME TO prepare_created_enterprise_identity_cleanup_core_v2;
ALTER FUNCTION public.prepare_created_enterprise_identity_cleanup_core_v2(uuid, uuid, uuid)
  SET SCHEMA effectime_private;
ALTER FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  RENAME TO complete_created_enterprise_identity_cleanup_core_v2;
ALTER FUNCTION public.complete_created_enterprise_identity_cleanup_core_v2(uuid, uuid)
  SET SCHEMA effectime_private;
ALTER FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  RENAME TO fail_created_enterprise_identity_cleanup_core_v2;
ALTER FUNCTION public.fail_created_enterprise_identity_cleanup_core_v2(uuid, uuid, text)
  SET SCHEMA effectime_private;

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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.lease_token IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup job is worker-owned or was not found'
      USING ERRCODE = '40001';
  END IF;

  RETURN effectime_private.prepare_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id,
    p_membership_id
  );
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.lease_token IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup job is worker-owned or was not found'
      USING ERRCODE = '40001';
  END IF;

  RETURN effectime_private.complete_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id
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
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.lease_token IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup job is worker-owned or was not found'
      USING ERRCODE = '40001';
  END IF;

  RETURN effectime_private.fail_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id,
    p_error_code
  );
END;
$function$;

-- The unfenced claim contract is intentionally retired. Keeping its signature
-- with an explicit failure gives stale deployments a diagnostic instead of a
-- silently unsafe lease.
CREATE OR REPLACE FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(
  p_limit integer DEFAULT 25
)
RETURNS TABLE(cleanup_job_id uuid, status text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'Unfenced cleanup claim v1 is disabled; use v2'
    USING ERRCODE = '0A000';
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v2(
  p_limit integer DEFAULT 25
)
RETURNS TABLE(
  cleanup_job_id uuid,
  status text,
  user_id uuid,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'Cleanup claim limit is invalid' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT cleanup_job.id,
           pg_catalog.gen_random_uuid() AS next_lease_token
    FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
    WHERE cleanup_job.status IN ('provisioning', 'pending_auth')
      AND cleanup_job.next_attempt_at <= pg_catalog.now()
      AND (
        cleanup_job.lease_expires_at IS NULL
        OR cleanup_job.lease_expires_at <= pg_catalog.now()
      )
    ORDER BY cleanup_job.next_attempt_at, cleanup_job.created_at, cleanup_job.id
    FOR UPDATE OF cleanup_job SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE effectime_private.created_identity_cleanup_jobs AS cleanup_job
  SET attempt_count = cleanup_job.attempt_count + 1,
      lease_token = candidates.next_lease_token,
      lease_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  FROM candidates
  WHERE cleanup_job.id = candidates.id
  RETURNING cleanup_job.id,
            cleanup_job.status,
            cleanup_job.user_id,
            cleanup_job.lease_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_created_enterprise_identity_cleanup_v2(
  p_cleanup_job_id uuid,
  p_user_id uuid,
  p_membership_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Cleanup job and lease token are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.status IN ('provisioning', 'pending_auth')
    AND cleanup_job.lease_token = p_lease_token
    AND cleanup_job.lease_expires_at > pg_catalog.now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup lease ownership was lost'
      USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime.created_identity_cleanup_lease_token',
    p_lease_token::text,
    true
  );

  v_result := effectime_private.prepare_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id,
    p_membership_id
  );

  RETURN v_result || pg_catalog.jsonb_build_object('lease_token', p_lease_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_created_enterprise_identity_cleanup_v2(
  p_cleanup_job_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL OR p_user_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Cleanup job, user and lease token are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.status IN ('pending_auth', 'completed')
    AND cleanup_job.user_id = p_user_id
    AND cleanup_job.lease_token = p_lease_token
    AND cleanup_job.lease_expires_at > pg_catalog.now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup lease ownership was lost'
      USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime.created_identity_cleanup_lease_token',
    p_lease_token::text,
    true
  );
  v_result := effectime_private.complete_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id
  );

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cleanup_job_id', p_cleanup_job_id,
    'status', 'completed',
    'lease_token', p_lease_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_created_enterprise_identity_cleanup_v2(
  p_cleanup_job_id uuid,
  p_user_id uuid,
  p_error_code text,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_cleanup_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Cleanup job and lease token are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
  WHERE cleanup_job.id = p_cleanup_job_id
    AND cleanup_job.status IN ('provisioning', 'pending_auth')
    AND cleanup_job.lease_token = p_lease_token
    AND cleanup_job.lease_expires_at > pg_catalog.now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cleanup lease ownership was lost'
      USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config(
    'effectime.created_identity_cleanup_lease_token',
    p_lease_token::text,
    true
  );
  v_result := effectime_private.fail_created_enterprise_identity_cleanup_core_v2(
    p_cleanup_job_id,
    p_user_id,
    p_error_code
  );

  RETURN v_result || pg_catalog.jsonb_build_object('lease_token', p_lease_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.acquire_created_identity_cleanup_worker_v1(
  p_run_id uuid,
  p_lease_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '10s'
AS $function$
DECLARE
  v_state effectime_private.created_identity_cleanup_worker_state%ROWTYPE;
  v_lease_expires_at timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL
     OR p_lease_seconds IS NULL
     OR p_lease_seconds < 120
     OR p_lease_seconds > 240 THEN
    RAISE EXCEPTION 'Worker lease request is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT worker_state.*
  INTO v_state
  FROM effectime_private.created_identity_cleanup_worker_state AS worker_state
  WHERE worker_state.singleton
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker singleton state is missing' USING ERRCODE = '55000';
  END IF;

  IF v_state.active_run_id IS NOT NULL
     AND v_state.lease_expires_at > pg_catalog.now() THEN
    UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
    SET overlap_count = worker_state.overlap_count + 1
    WHERE worker_state.singleton;

    -- Never disclose the other worker token or its lease timing.
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'acquired', false,
      'run_id', p_run_id,
      'lease_expires_at', NULL
    );
  END IF;

  v_lease_expires_at := pg_catalog.now()
    + pg_catalog.make_interval(secs => p_lease_seconds);

  UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
  SET active_run_id = p_run_id,
      lease_expires_at = v_lease_expires_at,
      active_started_at = pg_catalog.now()
  WHERE worker_state.singleton;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'acquired', true,
    'run_id', p_run_id,
    'lease_expires_at', v_lease_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finish_created_identity_cleanup_worker_v1(
  p_run_id uuid,
  p_status text,
  p_claimed integer,
  p_completed integer,
  p_pending integer,
  p_receipt_failures integer,
  p_error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '10s'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL
     OR p_status NOT IN ('succeeded', 'failed')
     OR p_claimed IS NULL OR p_claimed < 0
     OR p_completed IS NULL OR p_completed < 0 OR p_completed > p_claimed
     OR p_pending IS NULL OR p_pending < 0 OR p_pending > p_claimed
     OR p_receipt_failures IS NULL
     OR p_receipt_failures < 0 OR p_receipt_failures > p_pending
     OR p_completed + p_pending <> p_claimed
     OR (p_status = 'succeeded' AND p_error_code IS NOT NULL)
     OR (
       p_status = 'failed'
       AND p_error_code NOT IN (
         'worker_deadline_exceeded',
         'batch_failed',
         'receipt_persistence_failed',
         'invocation_failed'
       )
     ) THEN
    RAISE EXCEPTION 'Worker completion receipt is invalid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
  SET active_run_id = NULL,
      lease_expires_at = NULL,
      active_started_at = NULL,
      last_run_id = p_run_id,
      last_status = p_status,
      last_claimed = p_claimed,
      last_completed = p_completed,
      last_pending = p_pending,
      last_receipt_failures = p_receipt_failures,
      last_error_code = p_error_code,
      last_finished_at = pg_catalog.now()
  WHERE worker_state.singleton
    AND worker_state.active_run_id = p_run_id
    AND worker_state.lease_expires_at > pg_catalog.now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker lease ownership was lost'
      USING ERRCODE = '40001';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'status', p_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION effectime_private.is_created_identity_cleanup_anon_key_v1(
  p_key text,
  p_expected_project_ref text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  v_parts text[];
  v_payload_text text;
  v_payload jsonb;
BEGIN
  IF p_key IS NULL
     OR pg_catalog.length(p_key) < 32
     OR p_key ~ '[[:space:]]'
     OR p_key ~ '^sb_secret_' THEN
    RETURN false;
  END IF;

  v_parts := pg_catalog.string_to_array(p_key, '.');
  IF pg_catalog.cardinality(v_parts) <> 3
     OR v_parts[2] !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN false;
  END IF;

  BEGIN
    v_payload_text := pg_catalog.translate(v_parts[2], '-_', '+/');
    v_payload_text := v_payload_text
      || pg_catalog.repeat('=', (4 - pg_catalog.length(v_payload_text) % 4) % 4);
    v_payload := pg_catalog.convert_from(
      pg_catalog.decode(v_payload_text, 'base64'),
      'UTF8'
    )::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN COALESCE(v_payload ->> 'role' = 'anon', false)
    AND COALESCE(
      v_payload ->> 'ref' = p_expected_project_ref,
      false
    );
END;
$function$;

CREATE OR REPLACE FUNCTION effectime_private.install_created_identity_cleanup_scheduler_v1(
  p_expected_project_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_base_url text;
  v_anon_key text;
  v_trigger_secret text;
  v_base_count integer;
  v_anon_count integer;
  v_trigger_count integer;
  v_distinct_trigger_characters integer;
  v_existing_job_count integer;
  v_job_id bigint;
  v_job_command text := $cron_command$
WITH endpoint AS (
  SELECT pg_catalog.min(secret.decrypted_secret) AS value
  FROM vault.decrypted_secrets AS secret
  WHERE secret.name = 'supabase_function_base_url'
  HAVING pg_catalog.count(*) = 1
), credential AS (
  SELECT pg_catalog.min(secret.decrypted_secret) AS value
  FROM vault.decrypted_secrets AS secret
  WHERE secret.name = 'created_identity_cleanup_anon_key'
  HAVING pg_catalog.count(*) = 1
), trigger_secret AS (
  SELECT pg_catalog.min(secret.decrypted_secret) AS value
  FROM vault.decrypted_secrets AS secret
  WHERE secret.name = 'created_identity_cleanup_scheduler_secret'
  HAVING pg_catalog.count(*) = 1
)
SELECT net.http_post(
  url := endpoint.value || '/functions/v1/cleanup-created-identities',
  headers := pg_catalog.jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || credential.value,
    'apikey', credential.value,
    'x-effectime-cleanup-secret', trigger_secret.value
  ),
  body := pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'source', 'pg_cron'
  ),
  timeout_milliseconds := 120000
) AS request_id
FROM endpoint
CROSS JOIN credential
CROSS JOIN trigger_secret;
$cron_command$;
  v_persisted_command text;
BEGIN
  IF p_expected_project_ref IS NULL
     OR p_expected_project_ref !~ '^[a-z0-9]{20}$' THEN
    RAISE EXCEPTION 'Expected Supabase project ref is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.to_regclass('cron.job') IS NULL
     OR pg_catalog.to_regnamespace('net') IS NULL
     OR pg_catalog.to_regclass('vault.decrypted_secrets') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace
         ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'cron'
         AND procedure.proname = 'schedule'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace
         ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'cron'
         AND procedure.proname = 'unschedule'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace
         ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'net'
         AND procedure.proname = 'http_post'
     ) THEN
    RAISE EXCEPTION 'pg_cron, pg_net and Vault are required before scheduler install'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE $sql$
    SELECT pg_catalog.count(*)::integer,
           pg_catalog.min(secret.decrypted_secret)
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = $1
  $sql$ INTO v_base_count, v_base_url USING 'supabase_function_base_url';
  EXECUTE $sql$
    SELECT pg_catalog.count(*)::integer,
           pg_catalog.min(secret.decrypted_secret)
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = $1
  $sql$ INTO v_anon_count, v_anon_key
    USING 'created_identity_cleanup_anon_key';
  EXECUTE $sql$
    SELECT pg_catalog.count(*)::integer,
           pg_catalog.min(secret.decrypted_secret)
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = $1
  $sql$ INTO v_trigger_count, v_trigger_secret
    USING 'created_identity_cleanup_scheduler_secret';

  IF v_base_count <> 1 OR v_anon_count <> 1 OR v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Scheduler Vault names must each resolve exactly once'
      USING ERRCODE = '55000';
  END IF;

  IF v_base_url IS DISTINCT FROM pg_catalog.format(
       'https://%s.supabase.co',
       p_expected_project_ref
     ) THEN
    RAISE EXCEPTION 'Scheduler target does not match the expected Supabase project'
      USING ERRCODE = '22023';
  END IF;

  IF NOT effectime_private.is_created_identity_cleanup_anon_key_v1(
    v_anon_key,
    p_expected_project_ref
  ) THEN
    RAISE EXCEPTION 'Scheduler credential must be a legacy anon JWT'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(DISTINCT split_character.value)::integer
  INTO v_distinct_trigger_characters
  FROM pg_catalog.regexp_split_to_table(v_trigger_secret, '') AS split_character(value);

  IF v_trigger_secret !~ '^[A-Za-z0-9_-]{43,128}$'
     OR v_distinct_trigger_characters < 16
     OR v_trigger_secret = v_anon_key
     OR v_trigger_secret = v_base_url THEN
    RAISE EXCEPTION 'Scheduler trigger secret is not a dedicated high-entropy value'
      USING ERRCODE = '22023';
  END IF;

  EXECUTE $sql$
    SELECT pg_catalog.count(*)::integer
    FROM cron.job AS job
    WHERE job.jobname = $1
  $sql$ INTO v_existing_job_count
    USING 'effectime-created-identity-cleanup-v1';

  IF v_existing_job_count > 1 THEN
    RAISE EXCEPTION 'Duplicate created identity cleanup scheduler jobs exist'
      USING ERRCODE = '55000';
  END IF;
  IF v_existing_job_count = 1 THEN
    EXECUTE 'SELECT cron.unschedule($1)'
      USING 'effectime-created-identity-cleanup-v1';
  END IF;

  EXECUTE 'SELECT cron.schedule($1, $2, $3)'
  INTO v_job_id
  USING 'effectime-created-identity-cleanup-v1',
        '*/5 * * * *',
        v_job_command;

  EXECUTE $sql$
    SELECT job.command
    FROM cron.job AS job
    WHERE job.jobname = $1
  $sql$ INTO v_persisted_command
    USING 'effectime-created-identity-cleanup-v1';

  IF v_persisted_command IS NULL
     OR pg_catalog.strpos(v_persisted_command, v_base_url) > 0
     OR pg_catalog.strpos(v_persisted_command, v_anon_key) > 0
     OR pg_catalog.strpos(v_persisted_command, v_trigger_secret) > 0 THEN
    RAISE EXCEPTION 'Scheduler command persistence invariant failed'
      USING ERRCODE = '55000';
  END IF;

  UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
  SET scheduler_job_id = v_job_id,
      scheduler_project_ref = p_expected_project_ref,
      scheduler_installed_at = pg_catalog.now()
  WHERE worker_state.singleton;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'job_name', 'effectime-created-identity-cleanup-v1',
    'job_id', v_job_id,
    'schedule', '*/5 * * * *'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION effectime_private.pause_created_identity_cleanup_scheduler_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '15s'
AS $function$
DECLARE
  v_existing_job_count integer := 0;
BEGIN
  IF pg_catalog.to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT pg_catalog.count(*)::integer
      FROM cron.job AS job
      WHERE job.jobname = $1
    $sql$ INTO v_existing_job_count
      USING 'effectime-created-identity-cleanup-v1';

    IF v_existing_job_count > 1 THEN
      RAISE EXCEPTION 'Duplicate created identity cleanup scheduler jobs exist'
        USING ERRCODE = '55000';
    END IF;
    IF v_existing_job_count = 1 THEN
      EXECUTE 'SELECT cron.unschedule($1)'
        USING 'effectime-created-identity-cleanup-v1';
    END IF;
  END IF;

  UPDATE effectime_private.created_identity_cleanup_worker_state AS worker_state
  SET scheduler_job_id = NULL,
      scheduler_project_ref = NULL,
      scheduler_installed_at = NULL
  WHERE worker_state.singleton;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'job_name', 'effectime-created-identity-cleanup-v1',
    'unscheduled', v_existing_job_count = 1
  );
END;
$function$;

-- Legacy temporary profiles use a separate, short-lived fenced lease. The
-- Edge worker cannot keep database eligibility and an external GoTrue delete in
-- one transaction, so the lease plus the two guards below freeze the exact
-- profile/event decision until Auth absence is proven. The table deliberately
-- stores UUIDs and operational timestamps only.
CREATE TABLE effectime_private.temporary_profile_cleanup_leases (
  user_id uuid PRIMARY KEY,
  lease_token uuid NOT NULL UNIQUE,
  linked_event_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  lease_expires_at timestamptz NOT NULL,
  CONSTRAINT temporary_profile_cleanup_lease_window_check
    CHECK (lease_expires_at > claimed_at)
);

ALTER TABLE effectime_private.temporary_profile_cleanup_leases
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX temporary_profile_cleanup_leases_expiry_idx
  ON effectime_private.temporary_profile_cleanup_leases(lease_expires_at, user_id);

CREATE INDEX temporary_profile_cleanup_leases_event_expiry_idx
  ON effectime_private.temporary_profile_cleanup_leases(
    linked_event_id,
    lease_expires_at
  )
  WHERE linked_event_id IS NOT NULL;

CREATE INDEX temporary_profiles_cleanup_candidates_idx
  ON public.profiles(created_at, user_id)
  WHERE is_temporary;

CREATE OR REPLACE FUNCTION effectime_private.guard_temporary_profile_cleanup_profile_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_user_id uuid;
  v_auth_user_exists boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':temporary-profile-cleanup',
      734563
    )
  );

  IF EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = v_user_id
      AND cleanup_lease.lease_expires_at > pg_catalog.now()
  ) THEN
    -- A real Auth deletion cascades to profiles. Permit only that exact delete:
    -- a direct profile delete still sees auth.users and remains fenced.
    IF TG_OP = 'DELETE' THEN
      SELECT EXISTS (
        SELECT 1
        FROM auth.users AS auth_user
        WHERE auth_user.id = v_user_id
      ) INTO v_auth_user_exists;
      IF NOT v_auth_user_exists THEN
        RETURN OLD;
      END IF;
    END IF;

    RAISE EXCEPTION 'Temporary profile cleanup lease rejects profile mutation'
      USING ERRCODE = '40001';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        OLD.user_id::text || ':temporary-profile-cleanup',
        734563
      )
    );
    IF EXISTS (
      SELECT 1
      FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
      WHERE cleanup_lease.user_id = OLD.user_id
        AND cleanup_lease.lease_expires_at > pg_catalog.now()
    ) THEN
      RAISE EXCEPTION 'Temporary profile cleanup lease rejects profile mutation'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE OR REPLACE FUNCTION effectime_private.guard_temporary_profile_cleanup_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  FOR v_event_id IN
    SELECT DISTINCT candidate.event_id
    FROM pg_catalog.unnest(
      CASE
        WHEN TG_OP = 'INSERT' THEN ARRAY[NEW.id]::uuid[]
        WHEN TG_OP = 'DELETE' THEN ARRAY[OLD.id]::uuid[]
        ELSE ARRAY[OLD.id, NEW.id]::uuid[]
      END
    ) AS candidate(event_id)
    WHERE candidate.event_id IS NOT NULL
    ORDER BY candidate.event_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_event_id::text || ':temporary-profile-cleanup-event',
        734563
      )
    );

    IF EXISTS (
      SELECT 1
      FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
      WHERE cleanup_lease.linked_event_id = v_event_id
        AND cleanup_lease.lease_expires_at > pg_catalog.now()
    ) THEN
      -- If the temporary user owns its linked event, deleting the Auth identity
      -- cascades through events before the worker can finish its database
      -- receipt. Permit only that exact owner cascade, and only when it cannot
      -- remove another profile or another claimant's fenced event.
      IF TG_OP = 'DELETE'
         AND OLD.created_by IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM auth.users AS auth_user
           WHERE auth_user.id = OLD.created_by
         )
         AND EXISTS (
           SELECT 1
           FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
           WHERE cleanup_lease.linked_event_id = v_event_id
             AND cleanup_lease.user_id = OLD.created_by
             AND cleanup_lease.lease_expires_at > pg_catalog.now()
         )
         AND NOT EXISTS (
           SELECT 1
           FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
           WHERE cleanup_lease.linked_event_id = v_event_id
             AND cleanup_lease.user_id IS DISTINCT FROM OLD.created_by
             AND cleanup_lease.lease_expires_at > pg_catalog.now()
         )
         AND NOT EXISTS (
           SELECT 1
           FROM public.profiles AS linked_profile
           WHERE linked_profile.linked_event_id = v_event_id
             AND linked_profile.user_id IS DISTINCT FROM OLD.created_by
         )
         AND NOT EXISTS (
           SELECT 1
           FROM public.votes AS linked_vote
           WHERE linked_vote.event_id = v_event_id
             AND linked_vote.user_id IS DISTINCT FROM OLD.created_by
         )
         AND NOT EXISTS (
           SELECT 1
           FROM public.event_participants AS linked_participant
           WHERE linked_participant.event_id = v_event_id
             AND linked_participant.user_id IS DISTINCT FROM OLD.created_by
         ) THEN
        RETURN OLD;
      END IF;

      RAISE EXCEPTION 'Temporary profile cleanup lease rejects event mutation'
        USING ERRCODE = '40001';
    END IF;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS zz_guard_temporary_profile_cleanup_lease
  ON public.profiles;
CREATE TRIGGER zz_guard_temporary_profile_cleanup_lease
  BEFORE INSERT OR UPDATE OF user_id, is_temporary, linked_event_id OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION effectime_private.guard_temporary_profile_cleanup_profile_v1();

DROP TRIGGER IF EXISTS zz_guard_temporary_event_cleanup_lease
  ON public.events;
CREATE TRIGGER zz_guard_temporary_event_cleanup_lease
  BEFORE INSERT OR UPDATE OF id, created_by, end_date OR DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION effectime_private.guard_temporary_profile_cleanup_event_v1();

CREATE OR REPLACE FUNCTION public.claim_eligible_temporary_profiles_v1(
  p_limit integer
)
RETURNS TABLE(user_id uuid, lease_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '10s'
AS $function$
DECLARE
  v_candidate record;
  v_token uuid;
  v_claimed integer := 0;
  v_now timestamptz;
  v_profile record;
  v_inserted uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Temporary profile cleanup limit is invalid'
      USING ERRCODE = '22023';
  END IF;

  -- Recover an Auth-delete success whose final database receipt was interrupted.
  -- A missing profile is safe only when auth.users is also authoritatively absent;
  -- the active-lease trigger is the only permitted path that can remove the
  -- profile while the original Auth identity still existed.
  FOR v_candidate IN
    SELECT cleanup_lease.user_id, cleanup_lease.linked_event_id
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.lease_expires_at <= pg_catalog.now()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles AS profile
        WHERE profile.user_id = cleanup_lease.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM auth.users AS auth_user
        WHERE auth_user.id = cleanup_lease.user_id
      )
    ORDER BY cleanup_lease.claimed_at, cleanup_lease.user_id
    LIMIT p_limit
    FOR UPDATE OF cleanup_lease SKIP LOCKED
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_candidate.user_id::text || ':temporary-profile-cleanup',
        734563
      )
    );
    IF v_candidate.linked_event_id IS NOT NULL THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          v_candidate.linked_event_id::text || ':temporary-profile-cleanup-event',
          734563
        )
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.user_id = v_candidate.user_id
    ) OR EXISTS (
      SELECT 1 FROM auth.users AS auth_user
      WHERE auth_user.id = v_candidate.user_id
    ) THEN
      CONTINUE;
    END IF;

    v_now := pg_catalog.now();
    v_token := pg_catalog.gen_random_uuid();
    v_inserted := NULL;
    UPDATE effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    SET lease_token = v_token,
        claimed_at = v_now,
        lease_expires_at = v_now + interval '120 seconds'
    WHERE cleanup_lease.user_id = v_candidate.user_id
      AND cleanup_lease.lease_expires_at <= v_now
    RETURNING cleanup_lease.user_id INTO v_inserted;
    IF v_inserted IS NULL THEN
      CONTINUE;
    END IF;

    user_id := v_candidate.user_id;
    lease_token := v_token;
    RETURN NEXT;
    v_claimed := v_claimed + 1;
  END LOOP;

  IF v_claimed >= p_limit THEN
    RETURN;
  END IF;

  -- Only currently eligible rows enter the bounded candidate set. Long-lived
  -- retained profiles are absent from this ORDER/LIMIT and cannot starve older
  -- eligible rows that happen to sort after them.
  FOR v_candidate IN
    SELECT profile.user_id, profile.linked_event_id
    FROM public.profiles AS profile
    LEFT JOIN public.events AS linked_event
      ON linked_event.id = profile.linked_event_id
    WHERE profile.is_temporary
      AND (
        profile.linked_event_id IS NULL
        OR linked_event.id IS NULL
        OR (
          linked_event.end_date IS NOT NULL
          AND pg_catalog.now() >
            (linked_event.end_date::timestamp AT TIME ZONE 'UTC') + interval '10 days'
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM effectime_private.temporary_profile_cleanup_leases AS active_lease
        WHERE active_lease.user_id = profile.user_id
          AND active_lease.lease_expires_at > pg_catalog.now()
      )
    ORDER BY profile.created_at, profile.user_id
    LIMIT (p_limit - v_claimed)
    FOR UPDATE OF profile SKIP LOCKED
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_candidate.user_id::text || ':temporary-profile-cleanup',
        734563
      )
    );
    IF v_candidate.linked_event_id IS NOT NULL THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          v_candidate.linked_event_id::text || ':temporary-profile-cleanup-event',
          734563
        )
      );
    END IF;

    SELECT profile.is_temporary,
           profile.linked_event_id,
           linked_event.id AS event_id,
           linked_event.end_date
    INTO v_profile
    FROM public.profiles AS profile
    LEFT JOIN public.events AS linked_event
      ON linked_event.id = profile.linked_event_id
    WHERE profile.user_id = v_candidate.user_id
    FOR UPDATE OF profile;

    IF NOT FOUND
       OR NOT v_profile.is_temporary
       OR NOT (
         v_profile.linked_event_id IS NULL
         OR v_profile.event_id IS NULL
         OR (
           v_profile.end_date IS NOT NULL
           AND pg_catalog.now() >
             (v_profile.end_date::timestamp AT TIME ZONE 'UTC') + interval '10 days'
         )
       ) THEN
      CONTINUE;
    END IF;

    v_now := pg_catalog.now();
    v_token := pg_catalog.gen_random_uuid();
    v_inserted := NULL;
    INSERT INTO effectime_private.temporary_profile_cleanup_leases(
      user_id,
      lease_token,
      linked_event_id,
      claimed_at,
      lease_expires_at
    ) VALUES (
      v_candidate.user_id,
      v_token,
      v_profile.linked_event_id,
      v_now,
      v_now + interval '120 seconds'
    )
    ON CONFLICT ON CONSTRAINT temporary_profile_cleanup_leases_pkey DO UPDATE
    SET lease_token = EXCLUDED.lease_token,
        linked_event_id = EXCLUDED.linked_event_id,
        claimed_at = EXCLUDED.claimed_at,
        lease_expires_at = EXCLUDED.lease_expires_at
    WHERE effectime_private.temporary_profile_cleanup_leases.lease_expires_at <= v_now
    RETURNING effectime_private.temporary_profile_cleanup_leases.user_id
      INTO v_inserted;
    IF v_inserted IS NULL THEN
      CONTINUE;
    END IF;

    user_id := v_candidate.user_id;
    lease_token := v_token;
    RETURN NEXT;
    v_claimed := v_claimed + 1;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_temporary_profile_cleanup_v1(
  p_user_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '10s'
AS $function$
DECLARE
  v_lease record;
  v_profile record;
  v_mode text;
  v_now timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Temporary profile cleanup identity is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text || ':temporary-profile-cleanup',
      734563
    )
  );

  SELECT cleanup_lease.linked_event_id,
         cleanup_lease.lease_expires_at
  INTO v_lease
  FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
  WHERE cleanup_lease.user_id = p_user_id
    AND cleanup_lease.lease_token = p_lease_token
  FOR UPDATE;

  IF NOT FOUND OR v_lease.lease_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Temporary profile cleanup lease is stale'
      USING ERRCODE = '40001';
  END IF;

  IF v_lease.linked_event_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_lease.linked_event_id::text || ':temporary-profile-cleanup-event',
        734563
      )
    );
  END IF;

  SELECT profile.is_temporary,
         profile.linked_event_id,
         linked_event.id AS event_id,
         linked_event.end_date
  INTO v_profile
  FROM public.profiles AS profile
  LEFT JOIN public.events AS linked_event
    ON linked_event.id = profile.linked_event_id
  WHERE profile.user_id = p_user_id
  FOR UPDATE OF profile;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Temporary cleanup profile disappeared while Auth exists'
        USING ERRCODE = '40001';
    END IF;
    v_mode := 'orphan_recovery';
  ELSIF NOT v_profile.is_temporary
     OR v_profile.linked_event_id IS DISTINCT FROM v_lease.linked_event_id
     OR NOT (
       v_profile.linked_event_id IS NULL
       OR v_profile.event_id IS NULL
       OR (
         v_profile.end_date IS NOT NULL
         AND pg_catalog.now() >
           (v_profile.end_date::timestamp AT TIME ZONE 'UTC') + interval '10 days'
       )
     ) THEN
    RAISE EXCEPTION 'Temporary profile cleanup eligibility changed'
      USING ERRCODE = '40001';
  ELSE
    v_mode := 'eligible_profile';
  END IF;

  -- This call is repeated immediately before each bounded Auth delete. Renewing
  -- the exact token here keeps the eligibility fence alive longer than the
  -- worker's remaining request budget without granting a stale claimant a new
  -- lease.
  v_now := pg_catalog.now();
  UPDATE effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
  SET claimed_at = v_now,
      lease_expires_at = v_now + interval '120 seconds'
  WHERE cleanup_lease.user_id = p_user_id
    AND cleanup_lease.lease_token = p_lease_token
    AND cleanup_lease.lease_expires_at > v_now;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Temporary profile cleanup lease was lost during prepare'
      USING ERRCODE = '40001';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'lease_token', p_lease_token,
    'mode', v_mode
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_temporary_profile_cleanup_v1(
  p_user_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '10s'
AS $function$
DECLARE
  v_lease record;
  v_profile record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Temporary profile cleanup identity is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text || ':temporary-profile-cleanup',
      734563
    )
  );

  SELECT cleanup_lease.linked_event_id,
         cleanup_lease.lease_expires_at
  INTO v_lease
  FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
  WHERE cleanup_lease.user_id = p_user_id
    AND cleanup_lease.lease_token = p_lease_token
  FOR UPDATE;

  IF NOT FOUND OR v_lease.lease_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Temporary profile cleanup lease is stale'
      USING ERRCODE = '40001';
  END IF;

  IF v_lease.linked_event_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_lease.linked_event_id::text || ':temporary-profile-cleanup-event',
        734563
      )
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Temporary Auth cleanup is not complete'
      USING ERRCODE = '55000';
  END IF;

  SELECT profile.is_temporary,
         profile.linked_event_id,
         linked_event.id AS event_id,
         linked_event.end_date
  INTO v_profile
  FROM public.profiles AS profile
  LEFT JOIN public.events AS linked_event
    ON linked_event.id = profile.linked_event_id
  WHERE profile.user_id = p_user_id
  FOR UPDATE OF profile;

  IF FOUND AND (
    NOT v_profile.is_temporary
    OR v_profile.linked_event_id IS DISTINCT FROM v_lease.linked_event_id
    OR NOT (
      v_profile.linked_event_id IS NULL
      OR v_profile.event_id IS NULL
      OR (
        v_profile.end_date IS NOT NULL
        AND pg_catalog.now() >
          (v_profile.end_date::timestamp AT TIME ZONE 'UTC') + interval '10 days'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Temporary profile cleanup eligibility changed'
      USING ERRCODE = '40001';
  END IF;

  DELETE FROM public.votes AS vote WHERE vote.user_id = p_user_id;
  DELETE FROM public.event_participants AS participant
    WHERE participant.user_id = p_user_id;
  DELETE FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = p_user_id
      AND cleanup_lease.lease_token = p_lease_token;
  DELETE FROM public.profiles AS profile WHERE profile.user_id = p_user_id;

  IF EXISTS (
    SELECT 1 FROM public.votes AS vote WHERE vote.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_participants AS participant
    WHERE participant.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM effectime_private.temporary_profile_cleanup_leases AS cleanup_lease
    WHERE cleanup_lease.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Temporary profile database cleanup is incomplete'
      USING ERRCODE = '55000';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'lease_token', p_lease_token,
    'status', 'completed'
  );
END;
$function$;

ALTER TABLE effectime_private.temporary_profile_cleanup_leases OWNER TO postgres;
ALTER FUNCTION effectime_private.guard_temporary_profile_cleanup_profile_v1()
  OWNER TO postgres;
ALTER FUNCTION effectime_private.guard_temporary_profile_cleanup_event_v1()
  OWNER TO postgres;
ALTER FUNCTION public.claim_eligible_temporary_profiles_v1(integer)
  OWNER TO postgres;
ALTER FUNCTION public.prepare_temporary_profile_cleanup_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.complete_temporary_profile_cleanup_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)
  OWNER TO postgres;
ALTER FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  OWNER TO postgres;
ALTER FUNCTION effectime_private.prepare_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid, uuid
) OWNER TO postgres;
ALTER FUNCTION effectime_private.complete_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid
) OWNER TO postgres;
ALTER FUNCTION effectime_private.fail_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid, text
) OWNER TO postgres;
ALTER FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)
  OWNER TO postgres;
ALTER FUNCTION public.prepare_created_enterprise_identity_cleanup_v2(uuid, uuid, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.complete_created_enterprise_identity_cleanup_v2(uuid, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.fail_created_enterprise_identity_cleanup_v2(uuid, uuid, text, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.acquire_created_identity_cleanup_worker_v1(uuid, integer)
  OWNER TO postgres;
ALTER FUNCTION public.finish_created_identity_cleanup_worker_v1(
  uuid, text, integer, integer, integer, integer, text
) OWNER TO postgres;
ALTER FUNCTION effectime_private.is_created_identity_cleanup_anon_key_v1(text, text)
  OWNER TO postgres;
ALTER FUNCTION effectime_private.install_created_identity_cleanup_scheduler_v1(text)
  OWNER TO postgres;
ALTER FUNCTION effectime_private.pause_created_identity_cleanup_scheduler_v1()
  OWNER TO postgres;

REVOKE ALL ON TABLE effectime_private.created_identity_cleanup_jobs
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE effectime_private.created_identity_cleanup_worker_state
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE effectime_private.temporary_profile_cleanup_leases
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.guard_temporary_profile_cleanup_profile_v1()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.guard_temporary_profile_cleanup_event_v1()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_eligible_temporary_profiles_v1(integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_temporary_profile_cleanup_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_temporary_profile_cleanup_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v1(integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.prepare_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.complete_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.fail_created_enterprise_identity_cleanup_core_v2(
  uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v2(
  uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_created_enterprise_identity_cleanup_v2(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_created_enterprise_identity_cleanup_v2(
  uuid, uuid, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.acquire_created_identity_cleanup_worker_v1(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_created_identity_cleanup_worker_v1(
  uuid, text, integer, integer, integer, integer, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.is_created_identity_cleanup_anon_key_v1(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.install_created_identity_cleanup_scheduler_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION effectime_private.pause_created_identity_cleanup_scheduler_v1()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.claim_created_enterprise_identity_cleanup_jobs_v2(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_eligible_temporary_profiles_v1(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_temporary_profile_cleanup_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_temporary_profile_cleanup_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v1(
  uuid, uuid, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_created_enterprise_identity_cleanup_v1(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_created_enterprise_identity_cleanup_v1(
  uuid, uuid, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_created_enterprise_identity_cleanup_v2(
  uuid, uuid, uuid, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_created_enterprise_identity_cleanup_v2(
  uuid, uuid, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_created_enterprise_identity_cleanup_v2(
  uuid, uuid, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_created_identity_cleanup_worker_v1(uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_created_identity_cleanup_worker_v1(
  uuid, text, integer, integer, integer, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';
