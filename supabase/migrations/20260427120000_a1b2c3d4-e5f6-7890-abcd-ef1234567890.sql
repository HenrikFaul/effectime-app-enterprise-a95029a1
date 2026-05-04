-- Multi-position / multi-skill support for office coverage rules

ALTER TABLE public.enterprise_office_coverage_rules
  ADD COLUMN IF NOT EXISTS business_roles text[],
  ADD COLUMN IF NOT EXISTS skill_ids uuid[];

-- Relax the old single-value constraint to also accept arrays
ALTER TABLE public.enterprise_office_coverage_rules
  DROP CONSTRAINT IF EXISTS coverage_rule_role_or_skill_required;

ALTER TABLE public.enterprise_office_coverage_rules
  ADD CONSTRAINT coverage_rule_role_or_skill_required
  CHECK (
    business_role IS NOT NULL
    OR skill_id IS NOT NULL
    OR (business_roles IS NOT NULL AND array_length(business_roles, 1) > 0)
    OR (skill_ids IS NOT NULL AND array_length(skill_ids, 1) > 0)
  );
