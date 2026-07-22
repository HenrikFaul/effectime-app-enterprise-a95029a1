-- v3.30.0 — Plugin Marketplace (Top-20 Rank 19).
-- MVP scope: plugin manifest + submission + per-workspace install +
-- webhook event log. Full sandbox runtime + plugin SDK npm package
-- deferred to v3.30.1+.

-- ── 1. Marketplace plugins (system-wide catalog) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_plugins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  version         text NOT NULL DEFAULT '1.0.0',
  description     text,
  icon_url        text,
  category        text NOT NULL DEFAULT 'integration'
                   CHECK (category IN ('integration','analytics','compliance','vertical','automation','other')),
  author_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name     text,
  manifest        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','published','rejected','archived')),
  install_count   integer NOT NULL DEFAULT 0,
  pricing_model   text NOT NULL DEFAULT 'free' CHECK (pricing_model IN ('free','one_time','subscription','revenue_share')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_plugins_status
  ON public.marketplace_plugins (status, category);

ALTER TABLE public.marketplace_plugins ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse published plugins; admins see all
DROP POLICY IF EXISTS marketplace_plugins_read ON public.marketplace_plugins;
CREATE POLICY marketplace_plugins_read ON public.marketplace_plugins FOR SELECT TO authenticated
  USING (status = 'published'
         OR author_user_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS marketplace_plugins_no_direct_write ON public.marketplace_plugins;
CREATE POLICY marketplace_plugins_no_direct_write ON public.marketplace_plugins FOR INSERT TO authenticated WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_marketplace_plugins_updated_at ON public.marketplace_plugins;
CREATE TRIGGER trg_marketplace_plugins_updated_at
  BEFORE UPDATE ON public.marketplace_plugins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Per-workspace installed plugins ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_installed_plugins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  plugin_id      uuid NOT NULL REFERENCES public.marketplace_plugins(id) ON DELETE CASCADE,
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled        boolean NOT NULL DEFAULT true,
  installed_at   timestamptz NOT NULL DEFAULT now(),
  installed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_installed_plugins_workspace
  ON public.workspace_installed_plugins (workspace_id, enabled);

ALTER TABLE public.workspace_installed_plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_installed_plugins_read ON public.workspace_installed_plugins;
CREATE POLICY workspace_installed_plugins_read ON public.workspace_installed_plugins FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS workspace_installed_plugins_no_direct_write ON public.workspace_installed_plugins;
CREATE POLICY workspace_installed_plugins_no_direct_write ON public.workspace_installed_plugins FOR INSERT TO authenticated WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_workspace_installed_plugins_updated_at ON public.workspace_installed_plugins;
CREATE TRIGGER trg_workspace_installed_plugins_updated_at
  BEFORE UPDATE ON public.workspace_installed_plugins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Plugin webhook event log (forwarded to plugin URLs) ─────────────────
CREATE TABLE IF NOT EXISTS public.plugin_webhook_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  installed_plugin_id   uuid NOT NULL REFERENCES public.workspace_installed_plugins(id) ON DELETE CASCADE,
  event_type            text NOT NULL,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered             boolean NOT NULL DEFAULT false,
  delivery_attempts     integer NOT NULL DEFAULT 0,
  last_response_status  integer,
  last_response_body    text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  delivered_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_plugin_webhook_events_undelivered
  ON public.plugin_webhook_events (delivered, created_at) WHERE delivered = false;

ALTER TABLE public.plugin_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plugin_webhook_events_read ON public.plugin_webhook_events;
CREATE POLICY plugin_webhook_events_read ON public.plugin_webhook_events FOR SELECT TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(),
          ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS plugin_webhook_events_no_direct_write ON public.plugin_webhook_events;
CREATE POLICY plugin_webhook_events_no_direct_write ON public.plugin_webhook_events FOR INSERT TO authenticated WITH CHECK (false);

-- ── 4. Submit a plugin (authenticated developer) ───────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_submit_plugin(
  _slug         text,
  _name         text,
  _description  text,
  _category     text,
  _manifest     jsonb,
  _icon_url     text DEFAULT NULL,
  _pricing      text DEFAULT 'free'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_caller uuid; v_plugin_id uuid; v_author_name text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _slug IS NULL OR length(_slug) < 3 THEN RAISE EXCEPTION 'slug must be at least 3 characters'; END IF;
  IF _name IS NULL OR length(_name) < 1 THEN RAISE EXCEPTION 'name is required'; END IF;
  IF _category NOT IN ('integration','analytics','compliance','vertical','automation','other') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  SELECT display_name INTO v_author_name FROM public.profiles WHERE user_id = v_caller;

  INSERT INTO public.marketplace_plugins
    (slug, name, description, category, author_user_id, author_name, manifest, icon_url, pricing_model, status)
  VALUES (lower(_slug), _name, _description, _category, v_caller, v_author_name,
          COALESCE(_manifest, '{}'::jsonb), _icon_url, _pricing, 'pending')
  RETURNING id INTO v_plugin_id;

  RETURN v_plugin_id;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_submit_plugin(text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_submit_plugin(text, text, text, text, jsonb, text, text) TO authenticated;

-- ── 5. Approve / publish (platform admin only) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_set_plugin_status(
  _plugin_id uuid, _status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: platform admin required';
  END IF;
  IF _status NOT IN ('pending','approved','published','rejected','archived') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.marketplace_plugins SET status = _status WHERE id = _plugin_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_set_plugin_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_set_plugin_status(uuid, text) TO authenticated;

-- ── 6. Install plugin (workspace owner only) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_install_plugin(
  _workspace_id uuid, _plugin_id uuid, _config jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_caller uuid; v_install_id uuid; v_status text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_enterprise_role(_workspace_id, v_caller,
        ARRAY['owner'::public.enterprise_role]) THEN
    RAISE EXCEPTION 'Forbidden: workspace owner required';
  END IF;

  SELECT status INTO v_status FROM public.marketplace_plugins WHERE id = _plugin_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Plugin not found'; END IF;
  IF v_status NOT IN ('published','approved') THEN
    RAISE EXCEPTION 'Plugin not available for install (status=%)', v_status;
  END IF;

  INSERT INTO public.workspace_installed_plugins
    (workspace_id, plugin_id, config, installed_by)
  VALUES (_workspace_id, _plugin_id, COALESCE(_config, '{}'::jsonb), v_caller)
  ON CONFLICT (workspace_id, plugin_id) DO UPDATE
    SET config = EXCLUDED.config, enabled = true, installed_by = v_caller
  RETURNING id INTO v_install_id;

  UPDATE public.marketplace_plugins
    SET install_count = (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = _plugin_id AND enabled = true)
    WHERE id = _plugin_id;

  RETURN v_install_id;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb) TO authenticated;

-- ── 7. Uninstall ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_uninstall_plugin(
  _installed_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_caller uuid; v_workspace uuid; v_plugin uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT workspace_id, plugin_id INTO v_workspace, v_plugin
   FROM public.workspace_installed_plugins WHERE id = _installed_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Installation not found'; END IF;
  IF NOT public.has_enterprise_role(v_workspace, v_caller,
        ARRAY['owner'::public.enterprise_role]) THEN
    RAISE EXCEPTION 'Forbidden: workspace owner required';
  END IF;

  DELETE FROM public.workspace_installed_plugins WHERE id = _installed_id;
  UPDATE public.marketplace_plugins
    SET install_count = (SELECT count(*) FROM public.workspace_installed_plugins WHERE plugin_id = v_plugin AND enabled = true)
    WHERE id = v_plugin;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_uninstall_plugin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_plugin(uuid) TO authenticated;

-- ── 8. Seed 2 sample published plugins for demo ────────────────────────────
INSERT INTO public.marketplace_plugins (slug, name, description, category, manifest, status, author_name, pricing_model)
VALUES
  ('slack-leave-notify', 'Slack Leave Notifier',
   'Posts a message to a Slack channel whenever a leave request is approved or rejected.',
   'integration',
   '{"version":"1.0.0","hooks":["leave.approved","leave.rejected"],"permissions":["read:leave_requests"],"config_schema":{"slack_webhook_url":{"type":"string","required":true},"channel":{"type":"string","default":"#hr-updates"}}}'::jsonb,
   'published', 'Effectime', 'free'),
  ('birthday-bot', 'Birthday Bot',
   'Sends a friendly automated greeting to team members on their birthday via the workspace integration channel.',
   'automation',
   '{"version":"1.0.0","hooks":["cron.daily"],"permissions":["read:memberships"],"config_schema":{"greeting_template":{"type":"string","default":"🎂 Happy birthday, {{name}}!"}}}'::jsonb,
   'published', 'Effectime', 'free')
ON CONFLICT (slug) DO NOTHING;

-- ── 9. Feature catalog + tier mapping (Enterprise only) ────────────────────
INSERT INTO public.features (feature_key, name, module, description, status, dependencies, route_path, menu_path, sort_order)
VALUES
  ('plugin_marketplace_browse', 'Plugin marketplace', 'plugins',
   'Browse third-party plugins published to the Effectime marketplace',
   'active', ARRAY[]::text[], '/w/:workspaceId', ARRAY['Settings','Plugins','Marketplace']::text[], 2000),
  ('plugin_install', 'Install plugins', 'plugins',
   'Workspace owner can install a plugin from the marketplace + configure it',
   'active', ARRAY['plugin_marketplace_browse']::text[], '/w/:workspaceId', ARRAY['Settings','Plugins','Installed']::text[], 2010),
  ('plugin_developer_submission', 'Plugin developer submission', 'plugins',
   'Authenticated developers can submit plugins; platform admin approves',
   'active', ARRAY['plugin_marketplace_browse']::text[], '/marketplace', ARRAY['Developer','Plugin Submission']::text[], 2020)
ON CONFLICT (feature_key) DO UPDATE
  SET route_path = EXCLUDED.route_path, menu_path = EXCLUDED.menu_path,
      module = EXCLUDED.module, description = EXCLUDED.description,
      dependencies = EXCLUDED.dependencies;

WITH t AS (SELECT id FROM public.tiers WHERE tier_key = 'enterprise'),
     f AS (SELECT id FROM public.features WHERE feature_key IN ('plugin_marketplace_browse','plugin_install','plugin_developer_submission'))
INSERT INTO public.tier_features (tier_id, feature_id) SELECT t.id, f.id FROM t, f
ON CONFLICT DO NOTHING;;
