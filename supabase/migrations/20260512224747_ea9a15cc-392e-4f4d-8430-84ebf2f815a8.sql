
DO $$
DECLARE
  v_freemium_id uuid;
  ws RECORD;
  v_tenant_id uuid;
  v_slug_base text;
  v_slug text;
  v_n int;
BEGIN
  SELECT id INTO v_freemium_id FROM public.tiers WHERE tier_key = 'freemium' LIMIT 1;
  IF v_freemium_id IS NULL THEN RETURN; END IF;

  FOR ws IN SELECT id, name FROM public.enterprise_workspaces LOOP
    IF EXISTS (SELECT 1 FROM public.tenant_workspaces WHERE workspace_id = ws.id) THEN
      CONTINUE;
    END IF;

    -- slugify
    v_slug_base := lower(regexp_replace(coalesce(ws.name,'tenant'), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(both '-' from v_slug_base);
    IF v_slug_base = '' THEN v_slug_base := 'tenant'; END IF;
    v_slug := left(v_slug_base, 40) || '-' || substr(ws.id::text, 1, 8);
    v_n := 0;
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) AND v_n < 20 LOOP
      v_n := v_n + 1;
      v_slug := left(v_slug_base, 36) || '-' || substr(ws.id::text, 1, 8) || '-' || v_n;
    END LOOP;

    INSERT INTO public.tenants (name, slug, status, metadata)
    VALUES (ws.name, v_slug, 'active', jsonb_build_object('backfilled_from_workspace', ws.id))
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_workspaces (tenant_id, workspace_id, is_primary)
    VALUES (v_tenant_id, ws.id, true);

    INSERT INTO public.tenant_subscriptions (tenant_id, tier_id, status, started_at)
    VALUES (v_tenant_id, v_freemium_id, 'active', now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_id_for_workspace(_workspace_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_workspaces
  WHERE workspace_id = _workspace_id
  ORDER BY is_primary DESC, created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.tenant_enabled_features(_tenant_id uuid)
RETURNS TABLE(feature_key text, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH enabled AS (
    SELECT f.feature_key, 'tier'::text AS source
    FROM public.tenant_subscriptions ts
    JOIN public.tier_features tf ON tf.tier_id = ts.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE ts.tenant_id = _tenant_id AND ts.status = 'active'
      AND (ts.ends_at IS NULL OR ts.ends_at > now())
    UNION
    SELECT f.feature_key, 'addon'::text
    FROM public.tenant_addons ta
    JOIN public.addon_features af ON af.addon_id = ta.addon_id
    JOIN public.features f ON f.id = af.feature_id
    WHERE ta.tenant_id = _tenant_id AND ta.status = 'active'
      AND (ta.ends_at IS NULL OR ta.ends_at > now())
    UNION
    SELECT f.feature_key, 'override'::text
    FROM public.tenant_feature_overrides o
    JOIN public.features f ON f.id = o.feature_id
    WHERE o.tenant_id = _tenant_id AND o.enabled = true
      AND (o.expires_at IS NULL OR o.expires_at > now())
  ),
  disabled AS (
    SELECT f.feature_key
    FROM public.tenant_feature_overrides o
    JOIN public.features f ON f.id = o.feature_id
    WHERE o.tenant_id = _tenant_id AND o.enabled = false
      AND (o.expires_at IS NULL OR o.expires_at > now())
  )
  SELECT DISTINCT e.feature_key, e.source FROM enabled e
  WHERE e.feature_key NOT IN (SELECT feature_key FROM disabled);
$$;
