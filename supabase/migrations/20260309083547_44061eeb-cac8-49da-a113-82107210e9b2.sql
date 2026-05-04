-- Ensure event members (creator + invited participants) can view full participant list
CREATE OR REPLACE FUNCTION public.can_access_event(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = _event_id
      AND e.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = _event_id
      AND ep.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Participants can see their events " ON public.event_participants;
DROP POLICY IF EXISTS "Participants can see their events" ON public.event_participants;

CREATE POLICY "Event members can view all participants"
ON public.event_participants
FOR SELECT
TO authenticated
USING (public.can_access_event(event_id, auth.uid()));

-- Allow event creators to reset voting by deleting all votes in their own events
CREATE POLICY "Event creators can delete all votes"
ON public.votes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = votes.event_id
      AND e.created_by = auth.uid()
  )
);