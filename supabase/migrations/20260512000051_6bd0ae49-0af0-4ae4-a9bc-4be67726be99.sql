ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS external_calendar_event_id text;
CREATE INDEX IF NOT EXISTS idx_leave_requests_external_event
  ON public.leave_requests(external_calendar_event_id)
  WHERE external_calendar_event_id IS NOT NULL;