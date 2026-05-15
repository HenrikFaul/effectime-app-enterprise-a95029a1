-- v3.33.3 — Search-path hygiene sweep on remaining public-schema functions.
--
-- The 10 functions below were all flagged by the Supabase security advisor
-- (function_search_path_mutable). Each one was audited before edit; all
-- internal references are either fully qualified to public.* or are
-- pg_catalog builtins (now, sin, cos, asin, sqrt, radians, jsonb_each_text,
-- replace, length). Adding `SET search_path TO 'public'` is a non-functional
-- hardening — same shape as the v3.33.2 hotfix applied to the new triggers.
--
-- This migration completes the search-path sweep for `public` schema
-- functions. Out of scope: 6 advisor hits in non-public schemas (`syncfolk`,
-- `plannermaster`) which are owned by other subsystems.

CREATE OR REPLACE FUNCTION public.candidate_interview_slot_eligible(
  _slot_start timestamp with time zone,
  _slot_end timestamp with time zone,
  _interviewer_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_mid uuid;
BEGIN
  IF array_length(_interviewer_ids, 1) IS NULL THEN RETURN false; END IF;

  FOREACH v_mid IN ARRAY _interviewer_ids LOOP
    IF EXISTS (
      SELECT 1 FROM public.leave_requests lr
      JOIN public.enterprise_memberships m ON m.user_id = lr.user_id AND m.workspace_id = lr.workspace_id
      WHERE m.id = v_mid AND lr.status = 'approved'
        AND _slot_start::date BETWEEN lr.start_date AND lr.end_date
    ) THEN RETURN false; END IF;

    IF EXISTS (
      SELECT 1 FROM public.interview_slots s
      WHERE v_mid = ANY(s.interviewer_membership_ids)
        AND s.status = 'booked'
        AND s.slot_start < _slot_end AND s.slot_end > _slot_start
    ) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.document_substitute(_body_html text, _vars jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_result text := _body_html;
  v_key    text;
  v_val    text;
BEGIN
  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(COALESCE(_vars, '{}'::jsonb))
  LOOP
    v_result := replace(v_result, '{{' || v_key || '}}', COALESCE(v_val, ''));
  END LOOP;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_data_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE policy RECORD;
BEGIN
  FOR policy IN SELECT * FROM public.data_retention_policies WHERE is_active = true LOOP
    IF policy.table_name = 'enterprise_audit_events' THEN
      DELETE FROM public.enterprise_audit_events WHERE workspace_id = policy.workspace_id AND created_at < now() - (policy.retention_days || ' days')::INTERVAL;
    ELSIF policy.table_name = 'enterprise_api_usage_logs' THEN
      DELETE FROM public.enterprise_api_usage_logs WHERE workspace_id = policy.workspace_id AND created_at < now() - (policy.retention_days || ' days')::INTERVAL;
    ELSIF policy.table_name = 'wellbeing_scores' THEN
      DELETE FROM public.wellbeing_scores WHERE workspace_id = policy.workspace_id AND calculated_at < now() - (policy.retention_days || ' days')::INTERVAL;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enterprise_decision_memory_set_due()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.observation_due_at IS NULL THEN
    NEW.observation_due_at := COALESCE(NEW.authored_at, now()) + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ))
$function$;

CREATE OR REPLACE FUNCTION public.set_hr_workflow_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_webhook_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_office_equipment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_office_min_staffing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_password_policy(_password text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_failures text[] := '{}';
BEGIN
  IF _password IS NULL OR length(_password) < 10 THEN
    v_failures := v_failures || 'min_length_10';
  END IF;
  IF _password !~ '[A-Z]' THEN v_failures := v_failures || 'requires_uppercase'; END IF;
  IF _password !~ '[a-z]' THEN v_failures := v_failures || 'requires_lowercase'; END IF;
  IF _password !~ '[0-9]' THEN v_failures := v_failures || 'requires_digit';     END IF;
  IF _password !~ '[^A-Za-z0-9]' THEN v_failures := v_failures || 'requires_special_char'; END IF;

  RETURN jsonb_build_object(
    'ok', array_length(v_failures, 1) IS NULL,
    'failures', v_failures
  );
END;
$function$;
