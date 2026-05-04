-- A) Priority pozíció flag
ALTER TABLE public.enterprise_member_role_allocations
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- Részleges UNIQUE index: max 1 priority pozíció / membership
CREATE UNIQUE INDEX IF NOT EXISTS enterprise_member_role_allocations_priority_unique
  ON public.enterprise_member_role_allocations (membership_id)
  WHERE is_priority = true;

-- Backfill: minden meglévő membership-hez a legnagyobb %-os allokációt jelöljük priority-nek
WITH ranked AS (
  SELECT id,
         membership_id,
         ROW_NUMBER() OVER (PARTITION BY membership_id ORDER BY percentage DESC, created_at ASC) as rn
  FROM public.enterprise_member_role_allocations
)
UPDATE public.enterprise_member_role_allocations a
SET is_priority = true
FROM ranked r
WHERE a.id = r.id AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_member_role_allocations b
    WHERE b.membership_id = a.membership_id AND b.is_priority = true
  );

-- B) Reports tábla
CREATE TABLE IF NOT EXISTS public.enterprise_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  data_source text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  chart_type text NOT NULL DEFAULT 'table',
  is_template boolean NOT NULL DEFAULT false,
  is_shared boolean NOT NULL DEFAULT true,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_reports_workspace_idx ON public.enterprise_reports(workspace_id);
CREATE INDEX IF NOT EXISTS enterprise_reports_pinned_idx ON public.enterprise_reports(workspace_id, is_pinned) WHERE is_pinned = true;

ALTER TABLE public.enterprise_reports ENABLE ROW LEVEL SECURITY;

-- Tagok láthatják a megosztott riportokat + a sajátjaikat
CREATE POLICY "Members view shared and own reports"
ON public.enterprise_reports FOR SELECT
USING (
  public.is_enterprise_member(workspace_id, auth.uid())
  AND (is_shared = true OR created_by = auth.uid())
);

-- Tagok létrehozhatnak saját riportot
CREATE POLICY "Members create own reports"
ON public.enterprise_reports FOR INSERT
WITH CHECK (
  public.is_enterprise_member(workspace_id, auth.uid())
  AND created_by = auth.uid()
);

-- Saját riport módosítás / admin bárki
CREATE POLICY "Owners or admins update reports"
ON public.enterprise_reports FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
);

CREATE POLICY "Owners or admins delete reports"
ON public.enterprise_reports FOR DELETE
USING (
  created_by = auth.uid()
  OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_enterprise_reports_updated_at ON public.enterprise_reports;
CREATE TRIGGER update_enterprise_reports_updated_at
BEFORE UPDATE ON public.enterprise_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();