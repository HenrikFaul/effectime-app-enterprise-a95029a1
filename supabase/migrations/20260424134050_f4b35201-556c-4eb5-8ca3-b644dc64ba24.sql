-- Fix: SECURITY INVOKER view (no SECURITY DEFINER bypass) + immutable search_path
DROP VIEW IF EXISTS public.enterprise_leave_quota_balances;

CREATE VIEW public.enterprise_leave_quota_balances
WITH (security_invoker = on) AS
SELECT
  q.id AS quota_id,
  q.workspace_id,
  q.membership_id,
  q.leave_type,
  q.year,
  q.initial_days,
  q.carryover_days,
  q.manual_adjustment_days,
  q.carryover_expires_at,
  COALESCE(SUM(t.amount_days) FILTER (WHERE t.transaction_type = 'consume'), 0) AS consumed_days,
  COALESCE(SUM(t.amount_days) FILTER (WHERE t.transaction_type = 'refund'), 0) AS refunded_days,
  (q.initial_days + q.carryover_days + q.manual_adjustment_days
    + COALESCE(SUM(t.amount_days), 0)) AS available_days
FROM public.enterprise_leave_quotas q
LEFT JOIN public.enterprise_quota_transactions t ON t.quota_id = q.id
GROUP BY q.id;

-- Re-create calc_leave_days with explicit search_path (was already SET but linter sees overload)
CREATE OR REPLACE FUNCTION public.calc_leave_days(_start date, _end date, _half boolean)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d date;
  cnt numeric := 0;
BEGIN
  IF _half THEN RETURN 0.5; END IF;
  d := _start;
  WHILE d <= _end LOOP
    IF EXTRACT(ISODOW FROM d) < 6 THEN cnt := cnt + 1; END IF;
    d := d + 1;
  END LOOP;
  RETURN cnt;
END;
$$;