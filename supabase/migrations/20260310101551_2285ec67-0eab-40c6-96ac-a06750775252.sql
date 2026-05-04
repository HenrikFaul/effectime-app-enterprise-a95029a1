CREATE TABLE public.account_deletions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  account_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deletion_reason TEXT NOT NULL
);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - only service role will insert into this table