-- The global catalog tables (categories, roles, skills, role-skill links) are
-- shared reference data used by the position picker. They had RLS enabled but
-- no policies, so authenticated users got empty results for everything.
-- These are read-only for normal users; only service_role / DB owner can write.

CREATE POLICY "catalog_categories_select_authenticated"
  ON public.enterprise_catalog_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_roles_select_authenticated"
  ON public.enterprise_catalog_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_skills_select_authenticated"
  ON public.enterprise_catalog_skills FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_role_skills_select_authenticated"
  ON public.enterprise_catalog_role_skills FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
