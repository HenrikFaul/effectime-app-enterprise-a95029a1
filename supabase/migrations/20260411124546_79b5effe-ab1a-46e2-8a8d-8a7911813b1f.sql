
-- Leave request status enum
CREATE TYPE public.leave_request_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'expired');

-- Leave type enum
CREATE TYPE public.leave_type AS ENUM ('vacation', 'sick_leave', 'unpaid_leave', 'other');

-- Leave requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  leave_type public.leave_type NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.leave_request_status NOT NULL DEFAULT 'pending',
  comment TEXT,
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Members can view leave requests in their workspace
CREATE POLICY "Members can view workspace leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- RLS: Members can create their own leave requests
CREATE POLICY "Members can create own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_enterprise_member(workspace_id, auth.uid())
  );

-- RLS: Requesters can update own draft/pending requests (cancel)
CREATE POLICY "Requesters can update own pending requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id AND status IN ('draft', 'pending'))
    OR public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
  );

-- RLS: Only owners can delete
CREATE POLICY "Owners can delete leave requests"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

-- Approval decisions table
CREATE TABLE public.approval_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  decided_by UUID NOT NULL,
  decision public.leave_request_status NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

-- RLS: Workspace members can view decisions
CREATE POLICY "Members can view approval decisions"
  ON public.approval_decisions FOR SELECT TO authenticated
  USING (public.is_enterprise_member(workspace_id, auth.uid()));

-- RLS: Admins can create decisions
CREATE POLICY "Admins can create approval decisions"
  ON public.approval_decisions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
  );
