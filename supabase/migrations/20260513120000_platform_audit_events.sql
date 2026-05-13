-- Migration: platform_audit_events table for platform-level superadmin audit trail
--
-- enterprise_audit_events requires workspace_id, but platform-level changes
-- (tier-feature mappings, addon-feature mappings, tier/addon CRUD, tenant tier
-- assignments) have no workspace context. Spec phase 5 / 8 mandates an audit
-- trail on tier/addon changes; this table is the storage layer.

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  prev_state   JSONB,
  new_state    JSONB,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_audit_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS platform_audit_events_created_idx
  ON public.platform_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS platform_audit_events_action_idx
  ON public.platform_audit_events (action, created_at DESC);

-- Read: only platform admins
DROP POLICY IF EXISTS "platform_audit_events_select" ON public.platform_audit_events;
CREATE POLICY "platform_audit_events_select"
  ON public.platform_audit_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert: only platform admins (the only users who can change tiers/addons)
DROP POLICY IF EXISTS "platform_audit_events_insert" ON public.platform_audit_events;
CREATE POLICY "platform_audit_events_insert"
  ON public.platform_audit_events
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND actor_id = auth.uid()
  );

-- No UPDATE or DELETE policies → table is immutable to clients (audit integrity).
