
-- Csomag IV: Allowances tábla
CREATE TABLE IF NOT EXISTS public.enterprise_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'days' CHECK (unit IN ('days','hours')),
  ignore_limit boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view allowances" ON public.enterprise_allowances
  FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins insert allowances" ON public.enterprise_allowances
  FOR INSERT TO authenticated WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins update allowances" ON public.enterprise_allowances
  FOR UPDATE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
CREATE POLICY "Owners delete allowances" ON public.enterprise_allowances
  FOR DELETE TO authenticated USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE TRIGGER trg_allowances_updated_at BEFORE UPDATE ON public.enterprise_allowances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leave types bővítés
ALTER TABLE public.enterprise_leave_types
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowance_id uuid REFERENCES public.enterprise_allowances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon text;

-- Csomag II: Workspace beállítások bővítés
ALTER TABLE public.enterprise_workspaces
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month smallint NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS name_format text NOT NULL DEFAULT 'full_name' CHECK (name_format IN ('full_name','first_last','last_first','email')),
  ADD COLUMN IF NOT EXISTS show_past_absences boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_other_dept_view boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_manager_retroactive boolean NOT NULL DEFAULT false,
  -- Csomag III: Branding
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS brand_logo_light_url text,
  ADD COLUMN IF NOT EXISTS brand_logo_dark_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS white_label boolean NOT NULL DEFAULT false;

-- Csomag II: Departments (teams) bővítés
ALTER TABLE public.enterprise_teams
  ADD COLUMN IF NOT EXISTS max_absent integer,
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'linear' CHECK (approval_mode IN ('linear','parallel'));

-- Branding asset storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('workspace-branding', 'workspace-branding', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read branding" ON storage.objects
  FOR SELECT USING (bucket_id = 'workspace-branding');
CREATE POLICY "Workspace owners upload branding" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'workspace-branding'
    AND has_enterprise_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
  );
CREATE POLICY "Workspace owners update branding" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'workspace-branding'
    AND has_enterprise_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
  );
CREATE POLICY "Workspace owners delete branding" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'workspace-branding'
    AND has_enterprise_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
  );
