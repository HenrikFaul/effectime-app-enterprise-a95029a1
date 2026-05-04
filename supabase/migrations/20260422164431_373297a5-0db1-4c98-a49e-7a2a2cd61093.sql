-- Phase 1.2: Base Working Hours per membership
ALTER TABLE public.enterprise_memberships
  ADD COLUMN IF NOT EXISTS base_working_hours numeric NOT NULL DEFAULT 8;

ALTER TABLE public.enterprise_memberships
  ADD CONSTRAINT enterprise_memberships_base_working_hours_check
  CHECK (base_working_hours >= 0 AND base_working_hours <= 24);

COMMENT ON COLUMN public.enterprise_memberships.base_working_hours IS
  'Daily base working hours (e.g. 8 full-time, 6 or 4 part-time). Used for capacity math: hours_capacity = base_working_hours * (allocation_pct/100).';

-- Phase 2.2: Hierarchical permission tree (parent_id on feature catalog)
CREATE TABLE IF NOT EXISTS public.enterprise_feature_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  parent_key text REFERENCES public.enterprise_feature_catalog(feature_key) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_feature_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read feature catalog"
  ON public.enterprise_feature_catalog FOR SELECT
  TO authenticated USING (true);

-- Seed catalog reflecting current navigation tree
INSERT INTO public.enterprise_feature_catalog (feature_key, display_name, parent_key, sort_order) VALUES
  ('calendar', 'Naptár', NULL, 10),
  ('calendar_sidebar', 'Naptár oldalsáv', 'calendar', 1),
  ('leave_requests_view', 'Szabadságkérelmek megtekintése', 'calendar', 2),
  ('leave_requests_submit', 'Szabadságkérelem beküldése', 'calendar', 3),
  ('approvals', 'Jóváhagyások', 'calendar', 4),
  ('admin_override', 'Admin felülbírálás', 'calendar', 5),
  ('resources', 'Erőforrások', NULL, 20),
  ('resources_dashboard', 'Erőforrás áttekintés', 'resources', 1),
  ('resources_projects', 'Projektek', 'resources', 2),
  ('resources_timeline', 'Idővonal', 'resources', 3),
  ('resources_gaps', 'Kapacitás-hiány', 'resources', 4),
  ('resources_positions', 'Pozíciók', 'resources', 5),
  ('resources_teams', 'Csapatok', 'resources', 6),
  ('members', 'Tagok', NULL, 30),
  ('invitations', 'Meghívók', 'members', 1),
  ('reports', 'Riportok', NULL, 40),
  ('export', 'Exportok', 'reports', 1),
  ('audit', 'Audit napló', 'reports', 2),
  ('settings', 'Beállítások', NULL, 50),
  ('rules', 'Szabályok', 'settings', 1),
  ('notifications', 'Értesítések', 'settings', 2)
ON CONFLICT (feature_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      parent_key = EXCLUDED.parent_key,
      sort_order = EXCLUDED.sort_order;
