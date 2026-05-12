-- 1. Routing/menu columns on features
ALTER TABLE public.features
  ADD COLUMN IF NOT EXISTS route_path text,
  ADD COLUMN IF NOT EXISTS menu_path  text[] DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_features_route_path ON public.features (route_path);

-- 2. Tier-aware workspace creation
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  _name text,
  _description text DEFAULT NULL,
  _tier_key text DEFAULT 'freemium',
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

  SELECT id INTO _tier_id FROM public.tiers WHERE tier_key = COALESCE(_tier_key, 'freemium') LIMIT 1;
  IF _tier_id IS NULL THEN
    SELECT id INTO _tier_id FROM public.tiers ORDER BY sort_order LIMIT 1;
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

  IF _tier_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (tenant_id, tier_id, seats, status, started_at, metadata)
    VALUES (_tenant_id, _tier_id, COALESCE(_seats, 5), 'active', now(), jsonb_build_object('source','workspace_create'));
  END IF;

  RETURN _workspace_id;
END;
$$;