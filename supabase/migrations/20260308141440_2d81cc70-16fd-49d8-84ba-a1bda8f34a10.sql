-- Add allow_participant_sharing to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS allow_participant_sharing boolean NOT NULL DEFAULT false;

-- Create friendships table
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they receive" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Create favorites table
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  favorite_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, favorite_user_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites" ON public.favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update trigger for friendships
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS for event_share_tokens to allow participant sharing
DROP POLICY IF EXISTS "Event creators can create share tokens" ON public.event_share_tokens;
CREATE POLICY "Authorized users can create share tokens" ON public.event_share_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
      OR
      (EXISTS (SELECT 1 FROM events WHERE events.id = event_share_tokens.event_id AND events.allow_participant_sharing = true)
       AND EXISTS (SELECT 1 FROM event_participants WHERE event_participants.event_id = event_share_tokens.event_id AND event_participants.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Event creators can view share tokens" ON public.event_share_tokens;
CREATE POLICY "Authorized users can view share tokens" ON public.event_share_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM events WHERE events.id = event_share_tokens.event_id AND events.allow_participant_sharing = true)
     AND EXISTS (SELECT 1 FROM event_participants WHERE event_participants.event_id = event_share_tokens.event_id AND event_participants.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Event creators can delete share tokens" ON public.event_share_tokens;
CREATE POLICY "Authorized users can delete share tokens" ON public.event_share_tokens
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM events WHERE events.id = event_share_tokens.event_id AND events.created_by = auth.uid())
  );