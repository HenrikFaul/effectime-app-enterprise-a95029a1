-- v3.7.9: Extended office parameters
-- Adds: contact info, manager/deputy, opening hours, equipment, min staffing

-- 1. Extend enterprise_offices with new scalar columns
ALTER TABLE enterprise_offices
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS deputy_name  TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb;

-- 2. Equipment/facilities table
CREATE TABLE IF NOT EXISTS enterprise_office_equipment (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  office_id        UUID        NOT NULL REFERENCES enterprise_offices(id)    ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  quantity         INTEGER     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  required_skill_id UUID       REFERENCES enterprise_skills(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enterprise_office_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_equipment_select" ON enterprise_office_equipment
  FOR SELECT USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "office_equipment_insert" ON enterprise_office_equipment
  FOR INSERT WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "office_equipment_update" ON enterprise_office_equipment
  FOR UPDATE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "office_equipment_delete" ON enterprise_office_equipment
  FOR DELETE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- 3. Minimum mandatory staffing table (permanent office setting, unlike date-ranged coverage rules)
CREATE TABLE IF NOT EXISTS enterprise_office_min_staffing (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  office_id       UUID        NOT NULL REFERENCES enterprise_offices(id)    ON DELETE CASCADE,
  business_role   TEXT,
  skill_id        UUID        REFERENCES enterprise_skills(id) ON DELETE SET NULL,
  min_headcount   INTEGER     NOT NULL DEFAULT 1 CHECK (min_headcount >= 1),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT min_staffing_role_or_skill CHECK (business_role IS NOT NULL OR skill_id IS NOT NULL)
);

ALTER TABLE enterprise_office_min_staffing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_min_staffing_select" ON enterprise_office_min_staffing
  FOR SELECT USING (is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "office_min_staffing_insert" ON enterprise_office_min_staffing
  FOR INSERT WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "office_min_staffing_update" ON enterprise_office_min_staffing
  FOR UPDATE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "office_min_staffing_delete" ON enterprise_office_min_staffing
  FOR DELETE USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- Trigger: keep updated_at current on equipment
CREATE OR REPLACE FUNCTION update_office_equipment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER office_equipment_updated_at
  BEFORE UPDATE ON enterprise_office_equipment
  FOR EACH ROW EXECUTE FUNCTION update_office_equipment_updated_at();

-- Trigger: keep updated_at current on min staffing
CREATE OR REPLACE FUNCTION update_office_min_staffing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER office_min_staffing_updated_at
  BEFORE UPDATE ON enterprise_office_min_staffing
  FOR EACH ROW EXECUTE FUNCTION update_office_min_staffing_updated_at();
