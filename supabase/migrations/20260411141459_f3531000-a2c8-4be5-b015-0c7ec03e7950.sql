
-- Add business_role to memberships for job family tracking (SYN-18)
ALTER TABLE public.enterprise_memberships
ADD COLUMN IF NOT EXISTS business_role text DEFAULT NULL;

-- Add role_filter to daily rules for role-based coverage constraints
ALTER TABLE public.enterprise_daily_rules
ADD COLUMN IF NOT EXISTS role_filter text DEFAULT NULL;
