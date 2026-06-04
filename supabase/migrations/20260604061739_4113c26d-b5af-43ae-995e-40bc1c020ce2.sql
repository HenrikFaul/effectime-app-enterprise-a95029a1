-- v3.49.9 hygiene sweep: fix linter findings safely
-- 1. set_updated_at: pin search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- 2. Convert SECURITY DEFINER views to security_invoker
ALTER VIEW public.enterprise_org_pulse_membership SET (security_invoker = on);
ALTER VIEW public.enterprise_coverage_rules SET (security_invoker = on);