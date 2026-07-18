
-- 1. Events: restrict SELECT to creator + participants
DROP POLICY IF EXISTS "Events viewable by participants" ON public.events;
CREATE POLICY "Events viewable by participants"
ON public.events
FOR SELECT
USING (public.can_access_event(id, auth.uid()));

-- 2. Profiles: hide temp tokens from other users
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (temp_access_token IS NULL AND temp_verification_code IS NULL)
);

-- 3. Avatars storage: allow owner to delete
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. account_deletions: admin-only read policy (service role bypasses RLS)
CREATE POLICY "Admins can view account deletions"
ON public.account_deletions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Lock down search_path on remaining functions
DO $$
BEGIN
  -- This diagnostic helper existed in some deployed databases before its DDL
  -- was versioned. Harden it where present without making a fresh replay
  -- depend on an undocumented, non-runtime function.
  IF to_regprocedure('public.export_all_tables_sample(integer)') IS NOT NULL THEN
    ALTER FUNCTION public.export_all_tables_sample(integer)
      SET search_path = public, pg_temp;
  END IF;
END;
$$;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
