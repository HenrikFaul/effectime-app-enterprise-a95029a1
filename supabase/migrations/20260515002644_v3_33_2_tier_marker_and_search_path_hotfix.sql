-- v3.33.2 hotfix — caught two regressions introduced by v3.33.1:
--
--   1. superadmin_change_workspace_tier did NOT call set_config to arm the
--      'app.tier_change_rpc_active' guard. The enforce_tier_id_immutability
--      trigger from v3.33.1 would have blocked every legitimate tier change
--      in production. Caught before merge by reading the live RPC body.
--
--   2. The 4 functions added in v3.33.1 (enforce_tier_id_immutability,
--      validate_tier_feature_keys, validate_feature_dependencies,
--      require_feature_id) all lacked SET search_path. Caught by the
--      Supabase security advisor (function_search_path_mutable).
--      Without SET search_path an attacker who can manipulate session
--      search_path can shadow public.features / public.tenant_subscriptions
--      from inside a trigger context.

-- ─────────────────────────────────────────────────────────────────────
-- Fix 1: superadmin_change_workspace_tier — arm the trigger guard
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.superadmin_change_workspace_tier(
  _workspace_id uuid,
  _tier_key text,
  _reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid;
  v_tenant_id uuid;
  v_old_tier_id uuid;
  v_old_tier_key text;
  v_new_tier_id uuid;
  v_new_tier_key text;
  v_sub_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(v_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: platform admin role required';
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_workspaces
  WHERE workspace_id = _workspace_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant mapping for workspace %', _workspace_id;
  END IF;

  SELECT id, tier_key INTO v_new_tier_id, v_new_tier_key
  FROM public.tiers
  WHERE tier_key = _tier_key
  LIMIT 1;
  IF v_new_tier_id IS NULL THEN
    RAISE EXCEPTION 'Unknown tier_key: %', _tier_key;
  END IF;

  SELECT ts.id, t.id, t.tier_key
    INTO v_sub_id, v_old_tier_id, v_old_tier_key
  FROM public.tenant_subscriptions ts
  JOIN public.tiers t ON t.id = ts.tier_id
  WHERE ts.tenant_id = v_tenant_id AND ts.status = 'active'
    AND (ts.ends_at IS NULL OR ts.ends_at > now())
  ORDER BY ts.started_at DESC
  LIMIT 1;

  -- v3.33.2: arm the session-local guard so the
  -- enforce_tier_id_immutability trigger (added in v3.33.1) allows our
  -- UPDATE/INSERT. Third arg `true` makes it transaction-local;
  -- auto-cleared at commit/rollback. Without this, the trigger blocks
  -- every tier change in production.
  PERFORM set_config('app.tier_change_rpc_active', 'true', true);

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.tenant_subscriptions
       SET tier_id = v_new_tier_id,
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'last_tier_change_at', now(),
                  'last_tier_change_actor', v_caller,
                  'last_tier_change_reason', _reason,
                  'last_tier_change_from', v_old_tier_key,
                  'last_tier_change_to', v_new_tier_key
                )
     WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.tenant_subscriptions (tenant_id, tier_id, status, started_at, metadata)
    VALUES (v_tenant_id, v_new_tier_id, 'active', now(),
            jsonb_build_object(
              'source', 'superadmin_change_workspace_tier',
              'last_tier_change_actor', v_caller,
              'last_tier_change_reason', _reason
            ))
    RETURNING id INTO v_sub_id;
  END IF;

  INSERT INTO public.platform_audit_events
    (actor_id, action, target_type, target_id, prev_state, new_state, metadata)
  VALUES (
    v_caller,
    'workspace_tier_changed',
    'workspace',
    _workspace_id::text,
    jsonb_build_object('tier_key', v_old_tier_key, 'tier_id', v_old_tier_id),
    jsonb_build_object('tier_key', v_new_tier_key, 'tier_id', v_new_tier_id),
    jsonb_build_object('tenant_id', v_tenant_id, 'subscription_id', v_sub_id, 'reason', _reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_id', _workspace_id,
    'tenant_id', v_tenant_id,
    'subscription_id', v_sub_id,
    'from_tier_key', v_old_tier_key,
    'to_tier_key', v_new_tier_key
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- Fix 2: add SET search_path to the 4 v3.33.1 functions
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_tier_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tier_id IS DISTINCT FROM OLD.tier_id THEN
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

CREATE OR REPLACE FUNCTION public.validate_tier_feature_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _added text[];
  _missing text[];
BEGIN
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

CREATE OR REPLACE FUNCTION public.validate_feature_dependencies()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _added text[];
  _missing text[];
BEGIN
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

CREATE OR REPLACE FUNCTION public.require_feature_id(_feature_key text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.features WHERE feature_key = _feature_key;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'Unknown feature_key: %', _feature_key USING ERRCODE = '23503';
  END IF;
  RETURN _id;
END;
$$;
