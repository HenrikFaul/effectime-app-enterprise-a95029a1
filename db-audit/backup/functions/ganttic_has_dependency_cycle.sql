-- Backup of public.ganttic_has_dependency_cycle (taken 2026-05-13)
-- Reason for deletion: paired helper for enterprise_ganttic_dependencies.
-- Reads from that table only; no other function/RPC/view/trigger calls it.
-- Pass 1: only in types.ts. Pass 2: not reached from UI. Pass 3: no
-- indirect reference. All 3 methods agree unused.

CREATE OR REPLACE FUNCTION public.ganttic_has_dependency_cycle(
  p_workspace_id uuid,
  p_integration_id uuid,
  p_predecessor text,
  p_successor text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cycle boolean := false;
BEGIN
  WITH RECURSIVE reachable AS (
    SELECT successor_key AS key
    FROM   enterprise_ganttIc_dependencies
    WHERE  integration_id = p_integration_id
    AND    predecessor_key = p_successor
    UNION
    SELECT d.successor_key
    FROM   enterprise_ganttIc_dependencies d
    INNER JOIN reachable r ON d.predecessor_key = r.key
    WHERE  d.integration_id = p_integration_id
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable WHERE key = p_predecessor
  ) INTO v_cycle;
  RETURN v_cycle;
END;
$function$;
