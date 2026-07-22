-- v3.51.7: one authenticated, tenant-scoped transaction for deleting a
-- business role from every membership status in a workspace. This migration is
-- intentionally additive and depends on the v3.51.6 member-profile revision,
-- allocation integrity, permission and entitlement contracts.

DO $business_role_delete_preflight$
BEGIN
  IF pg_catalog.to_regclass('public.enterprise_memberships') IS NULL
     OR pg_catalog.to_regclass('public.enterprise_member_role_allocations') IS NULL
     OR pg_catalog.to_regclass('public.enterprise_audit_events') IS NULL
     OR pg_catalog.to_regprocedure(
       'public.has_workspace_permission(uuid,uuid,text,text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'public.workspace_has_any_feature(uuid,text[])'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'public.workspace_parent_exists_for_cascade_guard(uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'Atomic business-role delete prerequisites are missing'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND attribute.attname = 'profile_revision'
      AND attribute.atttypid = 'integer'::pg_catalog.regtype
      AND attribute.attnotnull
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION 'Atomic business-role delete requires profile_revision'
      USING ERRCODE = '55000';
  END IF;
END;
$business_role_delete_preflight$;

-- Reserve the aggregate audit receipt against direct authenticated/service
-- writes while still allowing a real parent-workspace ON DELETE CASCADE.
CREATE OR REPLACE FUNCTION public.guard_business_role_delete_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_reserved_action constant text := 'membership.business_role_deleted';
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF (TG_OP = 'INSERT' AND NEW.action = v_reserved_action)
       OR (TG_OP = 'UPDATE' AND (
         OLD.action = v_reserved_action OR NEW.action = v_reserved_action
       ))
       OR (
         TG_OP = 'DELETE'
         AND OLD.action = v_reserved_action
         AND public.workspace_parent_exists_for_cascade_guard(OLD.workspace_id)
       ) THEN
      RAISE EXCEPTION 'Business-role delete audit events require the atomic RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_business_role_delete_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_business_role_delete_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_role_delete_audit_mutation();

-- Every runtime writer participates in one workspace-scoped mutation gate.
-- Direct writers fail immediately rather than waiting behind a large delete;
-- the delete RPC itself waits for at most lock_timeout and either observes the
-- earlier write or aborts without a partial commit. This replaces a global
-- allocation-table lock that would couple unrelated tenants.
CREATE OR REPLACE FUNCTION public.guard_workspace_business_role_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'enterprise_memberships'
     AND TG_OP = 'UPDATE'
     AND OLD.business_role IS NOT DISTINCT FROM NEW.business_role THEN
    RETURN NEW;
  END IF;

  v_workspace_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.workspace_id
    ELSE NEW.workspace_id
  END;

  IF v_workspace_id IS NULL
     OR NOT pg_catalog.pg_try_advisory_xact_lock(
       pg_catalog.hashtextextended(
         v_workspace_id::text || ':business-role-mutation',
         734559
       )
     ) THEN
    RAISE EXCEPTION 'Workspace business-role mutation is busy'
      USING ERRCODE = '55P03';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_workspace_business_role_membership_mutation
  ON public.enterprise_memberships;
CREATE TRIGGER guard_workspace_business_role_membership_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_role_mutation();

DROP TRIGGER IF EXISTS guard_workspace_business_role_allocation_mutation
  ON public.enterprise_member_role_allocations;
CREATE TRIGGER guard_workspace_business_role_allocation_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_member_role_allocations
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_role_mutation();

CREATE OR REPLACE FUNCTION public.delete_workspace_business_role_v1(
  p_workspace_id uuid,
  p_business_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_membership_id uuid;
  v_actor_role public.enterprise_role;
  v_business_role text := p_business_role;
  v_affected_membership_ids uuid[] := ARRAY[]::uuid[];
  v_affected_membership_count integer := 0;
  v_deleted_allocation_count integer := 0;
  v_snapshot_count integer;
  v_snapshot_total numeric;
  v_snapshot_priority_count integer;
  v_snapshot_priority_role text;
  v_membership_primary_role text;
  v_remaining_count integer;
  v_priority_allocation_id uuid;
  v_priority_role text;
  v_membership_id uuid;
  v_audit_event_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_workspace_id IS NULL
     OR v_business_role IS NULL
     OR v_business_role = ''
     OR v_business_role IS DISTINCT FROM pg_catalog.btrim(v_business_role)
     OR v_business_role IS DISTINCT FROM pg_catalog.normalize(v_business_role, 'NFKC')
     OR pg_catalog.char_length(v_business_role) > 200
     OR v_business_role ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid business role' USING ERRCODE = '22023';
  END IF;

  -- Serialize every membership/allocation business-role mutation in this
  -- workspace. Matching table triggers make all direct and RPC writers observe
  -- the same gate without blocking unrelated tenants.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':business-role-mutation',
      734559
    )
  );

  -- Identical role deletions also retain a stable, role-specific lock key for
  -- diagnostics and bounded retries.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':business-role:' || v_business_role,
      734557
    )
  );

  SELECT membership.id, membership.role
  INTO v_actor_membership_id, v_actor_role
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = p_workspace_id
    AND membership.user_id = v_actor
    AND membership.status = 'active'::public.enterprise_membership_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'owner'::public.enterprise_role THEN
    PERFORM permission.workspace_id
    FROM public.enterprise_role_permissions AS permission
    WHERE permission.workspace_id = p_workspace_id
      AND permission.role_key = v_actor_role::text
      AND permission.feature_key = 'members'
      AND permission.access_level = 'edit'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT COALESCE(
       public.has_workspace_permission(
         p_workspace_id,
         v_actor,
         'members',
         'edit'
       ),
       false
     )
     OR NOT COALESCE(
       public.workspace_has_any_feature(
         p_workspace_id,
         ARRAY['members_list']::text[]
       ),
       false
     )
     OR NOT COALESCE(
       public.workspace_has_any_feature(
         p_workspace_id,
         ARRAY['business_roles']::text[]
       ),
       false
     ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    pg_catalog.array_agg(membership.id ORDER BY membership.id),
    ARRAY[]::uuid[]
  )
  INTO v_affected_membership_ids
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = p_workspace_id
    AND (
      membership.business_role = v_business_role
      OR EXISTS (
        SELECT 1
        FROM public.enterprise_member_role_allocations AS allocation
        WHERE allocation.workspace_id = p_workspace_id
          AND allocation.membership_id = membership.id
          AND allocation.business_role = v_business_role
      )
    );

  v_affected_membership_count := pg_catalog.cardinality(v_affected_membership_ids);

  IF v_affected_membership_count > 0 THEN
    PERFORM membership.id
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = p_workspace_id
      AND membership.id = ANY(v_affected_membership_ids)
    ORDER BY membership.id
    FOR UPDATE;
  END IF;

  -- Do not turn a delete click into an implicit historical-data repair. Every
  -- non-empty affected snapshot must already satisfy the v3.51.6 save contract.
  FOREACH v_membership_id IN ARRAY v_affected_membership_ids LOOP
    SELECT
      pg_catalog.count(*)::integer,
      COALESCE(pg_catalog.sum(allocation.percentage), 0::numeric),
      pg_catalog.count(*) FILTER (WHERE allocation.is_priority)::integer,
      pg_catalog.max(allocation.business_role) FILTER (WHERE allocation.is_priority)
    INTO
      v_snapshot_count,
      v_snapshot_total,
      v_snapshot_priority_count,
      v_snapshot_priority_role
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.workspace_id = p_workspace_id
      AND allocation.membership_id = v_membership_id;

    SELECT membership.business_role
    INTO v_membership_primary_role
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = p_workspace_id
      AND membership.id = v_membership_id;

    IF v_snapshot_count > 0
       AND (
         v_snapshot_total <> 100::numeric
         OR v_snapshot_priority_count <> 1
         OR v_membership_primary_role IS DISTINCT FROM v_snapshot_priority_role
       ) THEN
      RAISE EXCEPTION 'Role allocation snapshot requires explicit repair'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  DELETE FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.workspace_id = p_workspace_id
    AND allocation.business_role = v_business_role;
  GET DIAGNOSTICS v_deleted_allocation_count = ROW_COUNT;

  FOREACH v_membership_id IN ARRAY v_affected_membership_ids LOOP
    SELECT pg_catalog.count(*)::integer
    INTO v_remaining_count
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.workspace_id = p_workspace_id
      AND allocation.membership_id = v_membership_id;

    v_priority_allocation_id := NULL;
    v_priority_role := NULL;

    IF v_remaining_count > 0 THEN
      SELECT allocation.id, allocation.business_role
      INTO v_priority_allocation_id, v_priority_role
      FROM public.enterprise_member_role_allocations AS allocation
      WHERE allocation.workspace_id = p_workspace_id
        AND allocation.membership_id = v_membership_id
      ORDER BY allocation.is_priority DESC, allocation.business_role, allocation.id
      LIMIT 1;

      -- Rebalance only the explicit, confirmed removal result. Integer
      -- hundredths and stable largest-remainder ordering prevent browser/SQL
      -- floating-point drift. A zero-weight remainder is split evenly.
      WITH source AS (
        SELECT
          allocation.id,
          allocation.business_role,
          CASE
            WHEN totals.total_percentage = 0::numeric THEN 1::numeric
            ELSE allocation.percentage
          END AS weight
        FROM public.enterprise_member_role_allocations AS allocation
        CROSS JOIN LATERAL (
          SELECT COALESCE(pg_catalog.sum(candidate.percentage), 0::numeric)
            AS total_percentage
          FROM public.enterprise_member_role_allocations AS candidate
          WHERE candidate.workspace_id = p_workspace_id
            AND candidate.membership_id = v_membership_id
        ) AS totals
        WHERE allocation.workspace_id = p_workspace_id
          AND allocation.membership_id = v_membership_id
      ), weighted AS (
        SELECT
          source.*,
          pg_catalog.sum(source.weight) OVER () AS total_weight
        FROM source
      ), calculated AS (
        SELECT
          weighted.*,
          pg_catalog.floor(weighted.weight * 10000::numeric / weighted.total_weight)::integer
            AS floor_units,
          weighted.weight * 10000::numeric / weighted.total_weight
            - pg_catalog.floor(weighted.weight * 10000::numeric / weighted.total_weight)
            AS remainder
        FROM weighted
      ), ranked AS (
        SELECT
          calculated.*,
          pg_catalog.row_number() OVER (
            ORDER BY calculated.remainder DESC, calculated.business_role, calculated.id
          ) AS remainder_rank,
          10000 - pg_catalog.sum(calculated.floor_units) OVER () AS extra_units
        FROM calculated
      ), final AS (
        SELECT
          ranked.id,
          ranked.floor_units
            + CASE WHEN ranked.remainder_rank <= ranked.extra_units THEN 1 ELSE 0 END
            AS percentage_units
        FROM ranked
      )
      UPDATE public.enterprise_member_role_allocations AS allocation
      SET percentage = final.percentage_units::numeric / 100::numeric,
          is_priority = allocation.id = v_priority_allocation_id
      FROM final
      WHERE allocation.id = final.id
        AND allocation.workspace_id = p_workspace_id
        AND allocation.membership_id = v_membership_id
        AND (
          allocation.percentage IS DISTINCT FROM final.percentage_units::numeric / 100::numeric
          OR allocation.is_priority IS DISTINCT FROM (
            allocation.id = v_priority_allocation_id
          )
        );
    END IF;

    UPDATE public.enterprise_memberships AS membership
    SET business_role = v_priority_role
    WHERE membership.workspace_id = p_workspace_id
      AND membership.id = v_membership_id
      AND membership.business_role IS DISTINCT FROM v_priority_role;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = p_workspace_id
      AND membership.business_role = v_business_role
  ) OR EXISTS (
    SELECT 1
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.workspace_id = p_workspace_id
      AND allocation.business_role = v_business_role
  ) OR EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = p_workspace_id
      AND membership.id = ANY(v_affected_membership_ids)
      AND EXISTS (
        SELECT 1
        FROM public.enterprise_member_role_allocations AS allocation
        WHERE allocation.workspace_id = p_workspace_id
          AND allocation.membership_id = membership.id
        GROUP BY allocation.membership_id
        HAVING pg_catalog.sum(allocation.percentage) <> 100::numeric
          OR pg_catalog.count(*) FILTER (WHERE allocation.is_priority) <> 1
          OR membership.business_role IS DISTINCT FROM
            pg_catalog.max(allocation.business_role) FILTER (WHERE allocation.is_priority)
      )
  ) THEN
    RAISE EXCEPTION 'Business-role delete postcondition failed'
      USING ERRCODE = '55000';
  END IF;

  IF v_affected_membership_count > 0 THEN
    INSERT INTO public.enterprise_audit_events (
      workspace_id,
      actor_id,
      action,
      target_type,
      target_id,
      prev_state,
      new_state,
      metadata
    ) VALUES (
      p_workspace_id,
      v_actor,
      'membership.business_role_deleted',
      'enterprise_workspace',
      p_workspace_id,
      pg_catalog.jsonb_build_object(
        'affected_membership_count', v_affected_membership_count,
        'deleted_allocation_count', v_deleted_allocation_count
      ),
      pg_catalog.jsonb_build_object(
        'affected_membership_count', v_affected_membership_count,
        'deleted_allocation_count', 0
      ),
      pg_catalog.jsonb_build_object(
        'affected_membership_count', v_affected_membership_count,
        'deleted_allocation_count', v_deleted_allocation_count
      )
    )
    RETURNING id INTO v_audit_event_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'workspace_id', p_workspace_id,
    'business_role', v_business_role,
    'changed', v_affected_membership_count > 0,
    'affected_membership_count', v_affected_membership_count,
    'deleted_allocation_count', v_deleted_allocation_count,
    'audit_event_id', v_audit_event_id
  );
END;
$function$;

ALTER FUNCTION public.guard_business_role_delete_audit_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.guard_workspace_business_role_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.delete_workspace_business_role_v1(uuid, text)
  OWNER TO postgres;

DO $business_role_delete_owner_contract$
DECLARE
  v_expected_owner oid := pg_catalog.to_regrole('postgres')::oid;
  v_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_business_role_delete_audit_mutation()'
  )::oid;
  v_mutation_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_workspace_business_role_mutation()'
  )::oid;
  v_delete_oid oid := pg_catalog.to_regprocedure(
    'public.delete_workspace_business_role_v1(uuid,text)'
  )::oid;
BEGIN
  IF v_guard_oid IS NULL OR v_mutation_guard_oid IS NULL OR v_delete_oid IS NULL THEN
    RAISE EXCEPTION 'Atomic business-role delete routine contract is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid IN (v_guard_oid, v_mutation_guard_oid, v_delete_oid)
      AND procedure.proowner <> v_expected_owner
  ) THEN
    RAISE EXCEPTION 'Atomic business-role delete routines require the migration owner'
      USING ERRCODE = '55000';
  END IF;
END;
$business_role_delete_owner_contract$;

REVOKE ALL ON FUNCTION public.guard_business_role_delete_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_workspace_business_role_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_workspace_business_role_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_workspace_business_role_v1(uuid, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
