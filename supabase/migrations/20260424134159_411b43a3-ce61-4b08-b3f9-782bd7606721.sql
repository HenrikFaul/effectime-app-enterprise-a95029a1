-- ============================================================
-- Csomag 2: Substitute (Helyettesítő) system
-- ============================================================
CREATE TYPE public.substitute_status AS ENUM ('pending','confirmed','declined');

CREATE TABLE public.leave_request_substitutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  substitute_user_id uuid NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status substitute_status NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_request_id, substitute_user_id)
);

CREATE INDEX idx_subst_request ON public.leave_request_substitutes(leave_request_id);
CREATE INDEX idx_subst_user ON public.leave_request_substitutes(substitute_user_id, status);

ALTER TABLE public.leave_request_substitutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View substitutes (involved or admin)" ON public.leave_request_substitutes FOR SELECT TO authenticated
USING (
  is_enterprise_member(workspace_id, auth.uid())
  AND (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    OR substitute_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_request_id AND lr.user_id = auth.uid())
  )
);

CREATE POLICY "Insert substitutes (requester or admin)" ON public.leave_request_substitutes FOR INSERT TO authenticated
WITH CHECK (
  is_enterprise_member(workspace_id, auth.uid())
  AND (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    OR EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_request_id AND lr.user_id = auth.uid())
  )
);

CREATE POLICY "Update substitute (substitute confirms)" ON public.leave_request_substitutes FOR UPDATE TO authenticated
USING (
  substitute_user_id = auth.uid()
  OR has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
);

CREATE POLICY "Delete substitute (requester or admin)" ON public.leave_request_substitutes FOR DELETE TO authenticated
USING (
  has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
  OR EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_request_id AND lr.user_id = auth.uid())
);

-- ============================================================
-- Csomag 3: Leave request enrichment
-- ============================================================
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern jsonb,
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES public.leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lr_parent ON public.leave_requests(parent_request_id);

CREATE TABLE public.leave_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lr_att_request ON public.leave_request_attachments(leave_request_id);

ALTER TABLE public.leave_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attachments (owner/admin/approver)" ON public.leave_request_attachments FOR SELECT TO authenticated
USING (
  is_enterprise_member(workspace_id, auth.uid())
  AND (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    OR EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_request_id AND lr.user_id = auth.uid())
  )
);

CREATE POLICY "Insert attachments (requester)" ON public.leave_request_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_request_id AND lr.user_id = auth.uid())
);

CREATE POLICY "Delete attachments (uploader/admin)" ON public.leave_request_attachments FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('leave-attachments','leave-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path = workspace_id/leave_request_id/filename
CREATE POLICY "Leave attachments: read involved" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leave_request_attachments a
    WHERE a.storage_path = name
      AND (
        a.uploaded_by = auth.uid()
        OR has_enterprise_role(a.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
      )
  )
);

CREATE POLICY "Leave attachments: upload own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-attachments' AND owner = auth.uid());

CREATE POLICY "Leave attachments: delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'leave-attachments' AND owner = auth.uid());

-- ============================================================
-- Csomag 5: External integrations (Jira / Azure DevOps)
-- ============================================================
CREATE TYPE public.integration_provider AS ENUM ('jira','azure_devops');

CREATE TABLE public.enterprise_workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  base_url text NOT NULL,
  account_email text,
  api_token text NOT NULL, -- stored encrypted at rest by Supabase
  project_key text, -- Jira project key OR ADO project name
  default_issue_type text DEFAULT 'Task',
  auto_create_on_approval boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

ALTER TABLE public.enterprise_workspace_integrations ENABLE ROW LEVEL SECURITY;

-- Owners can manage; api_token never exposed to clients (we read it only from edge functions)
CREATE POLICY "Owners manage integrations metadata" ON public.enterprise_workspace_integrations FOR SELECT TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE POLICY "Owners insert integrations" ON public.enterprise_workspace_integrations FOR INSERT TO authenticated
WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]) AND created_by = auth.uid());

CREATE POLICY "Owners update integrations" ON public.enterprise_workspace_integrations FOR UPDATE TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE POLICY "Owners delete integrations" ON public.enterprise_workspace_integrations FOR DELETE TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE TRIGGER set_integration_updated_at BEFORE UPDATE ON public.enterprise_workspace_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.enterprise_integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.enterprise_workspace_integrations(id) ON DELETE CASCADE,
  leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  external_ref text, -- e.g. "PROJ-123" or ADO work item ID
  status text NOT NULL, -- 'success' | 'error'
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sync log" ON public.enterprise_integration_sync_log FOR SELECT TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

-- ============================================================
-- Csomag 4: iCal subscription tokens (per-user)
-- ============================================================
CREATE TABLE public.enterprise_ical_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  scope text NOT NULL DEFAULT 'own', -- 'own' | 'team'
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (workspace_id, user_id, scope)
);

ALTER TABLE public.enterprise_ical_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ical tokens (select)" ON public.enterprise_ical_tokens FOR SELECT TO authenticated
USING (user_id = auth.uid() AND is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Users create own ical tokens" ON public.enterprise_ical_tokens FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Users delete own ical tokens" ON public.enterprise_ical_tokens FOR DELETE TO authenticated
USING (user_id = auth.uid());