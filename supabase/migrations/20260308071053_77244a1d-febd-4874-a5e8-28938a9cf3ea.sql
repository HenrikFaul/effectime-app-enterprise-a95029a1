
CREATE TABLE public.event_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.event_share_tokens ENABLE ROW LEVEL SECURITY;

-- Event creators can create share tokens
CREATE POLICY "Event creators can create share tokens"
  ON public.event_share_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
    AND created_by = auth.uid()
  );

-- Event creators can view their share tokens
CREATE POLICY "Event creators can view share tokens"
  ON public.event_share_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
  );

-- Event creators can delete share tokens
CREATE POLICY "Event creators can delete share tokens"
  ON public.event_share_tokens FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
  );

-- Anyone authenticated can read tokens (for joining via link)
CREATE POLICY "Authenticated users can read tokens for joining"
  ON public.event_share_tokens FOR SELECT
  TO authenticated
  USING (true);
