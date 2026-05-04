
-- Notification preferences per member per workspace
CREATE TABLE public.enterprise_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  channel_email boolean NOT NULL DEFAULT true,
  channel_push boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, event_type)
);

ALTER TABLE public.enterprise_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
ON public.enterprise_notification_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.enterprise_notification_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND is_enterprise_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update own notification preferences"
ON public.enterprise_notification_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
ON public.enterprise_notification_preferences FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification preferences"
ON public.enterprise_notification_preferences FOR SELECT
TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.enterprise_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
