
-- Allow event creators to delete their own events
CREATE POLICY "Creators can delete their events"
ON public.events
FOR DELETE
TO authenticated
USING (created_by = auth.uid());
