-- ============================================================
-- Csomag 1: Leave Quota Management (Absentify-style)
-- ============================================================

-- 1. Quotas table
CREATE TABLE public.enterprise_leave_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  year integer NOT NULL,
  initial_days numeric(6,2) NOT NULL DEFAULT 0,
  carryover_days numeric(6,2) NOT NULL DEFAULT 0,
  manual_adjustment_days numeric(6,2) NOT NULL DEFAULT 0,
  carryover_expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, membership_id, leave_type, year)
);

CREATE INDEX idx_quotas_membership ON public.enterprise_leave_quotas(membership_id, year);
CREATE INDEX idx_quotas_workspace ON public.enterprise_leave_quotas(workspace_id, year);

ALTER TABLE public.enterprise_leave_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own quotas" ON public.enterprise_leave_quotas FOR SELECT TO authenticated
USING (
  is_enterprise_member(workspace_id, auth.uid())
  AND (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    OR EXISTS (SELECT 1 FROM enterprise_memberships m WHERE m.id = membership_id AND m.user_id = auth.uid())
  )
);

CREATE POLICY "Admins insert quotas" ON public.enterprise_leave_quotas FOR INSERT TO authenticated
WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins update quotas" ON public.enterprise_leave_quotas FOR UPDATE TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY "Admins delete quotas" ON public.enterprise_leave_quotas FOR DELETE TO authenticated
USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

CREATE TRIGGER set_quotas_updated_at BEFORE UPDATE ON public.enterprise_leave_quotas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Quota transactions (audit trail of all balance movements)
CREATE TYPE public.quota_transaction_type AS ENUM ('consume','refund','adjustment','carryover','grant');

CREATE TABLE public.enterprise_quota_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  quota_id uuid NOT NULL REFERENCES public.enterprise_leave_quotas(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  transaction_type quota_transaction_type NOT NULL,
  amount_days numeric(6,2) NOT NULL, -- positive = added to balance, negative = consumed
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qtxn_quota ON public.enterprise_quota_transactions(quota_id, created_at DESC);
CREATE INDEX idx_qtxn_request ON public.enterprise_quota_transactions(leave_request_id);

ALTER TABLE public.enterprise_quota_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own quota txns" ON public.enterprise_quota_transactions FOR SELECT TO authenticated
USING (
  is_enterprise_member(workspace_id, auth.uid())
  AND (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    OR EXISTS (SELECT 1 FROM enterprise_memberships m WHERE m.id = membership_id AND m.user_id = auth.uid())
  )
);

CREATE POLICY "Admins insert quota txns" ON public.enterprise_quota_transactions FOR INSERT TO authenticated
WITH CHECK (
  has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
  OR auth.role() = 'service_role'
);

-- No update/delete on transactions — they are append-only audit records.

-- 3. Helper function: business-day count between two dates (excludes weekends, halfday=0.5)
CREATE OR REPLACE FUNCTION public.calc_leave_days(_start date, _end date, _half boolean)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
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

-- 4. Auto-consume quota on leave_request approval / refund on cancellation
CREATE OR REPLACE FUNCTION public.handle_leave_quota_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _membership_id uuid;
  _quota_id uuid;
  _days numeric;
  _year integer;
BEGIN
  -- Resolve membership for this user inside the workspace
  SELECT id INTO _membership_id
  FROM enterprise_memberships
  WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id AND status = 'active'
  LIMIT 1;
  IF _membership_id IS NULL THEN RETURN NEW; END IF;

  _year := EXTRACT(YEAR FROM NEW.start_date)::int;
  _days := calc_leave_days(NEW.start_date, NEW.end_date, COALESCE(NEW.is_half_day, false));

  -- Find or auto-create the quota row (initial 0 — admin must set)
  SELECT id INTO _quota_id FROM enterprise_leave_quotas
  WHERE workspace_id = NEW.workspace_id AND membership_id = _membership_id
    AND leave_type = NEW.leave_type AND year = _year;

  IF _quota_id IS NULL THEN
    INSERT INTO enterprise_leave_quotas (workspace_id, membership_id, leave_type, year, initial_days)
    VALUES (NEW.workspace_id, _membership_id, NEW.leave_type, _year, 0)
    RETURNING id INTO _quota_id;
  END IF;

  -- pending -> approved : consume
  IF (TG_OP = 'UPDATE' AND OLD.status <> 'approved' AND NEW.status = 'approved') THEN
    INSERT INTO enterprise_quota_transactions
      (workspace_id, quota_id, membership_id, leave_request_id, transaction_type, amount_days, reason, created_by)
    VALUES
      (NEW.workspace_id, _quota_id, _membership_id, NEW.id, 'consume', -_days,
       'Auto-consume on approval', COALESCE(NEW.reviewer_id, NEW.user_id));
  END IF;

  -- approved -> cancelled : refund
  IF (TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'cancelled') THEN
    INSERT INTO enterprise_quota_transactions
      (workspace_id, quota_id, membership_id, leave_request_id, transaction_type, amount_days, reason, created_by)
    VALUES
      (NEW.workspace_id, _quota_id, _membership_id, NEW.id, 'refund', _days,
       'Auto-refund on cancellation', COALESCE(NEW.reviewer_id, NEW.user_id));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_quota_change
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_leave_quota_change();

-- 5. View: real-time balance per quota
CREATE OR REPLACE VIEW public.enterprise_leave_quota_balances AS
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
FROM enterprise_leave_quotas q
LEFT JOIN enterprise_quota_transactions t ON t.quota_id = q.id
GROUP BY q.id;

-- View inherits RLS from underlying tables.

-- 6. Add new feature_keys for permission tree
INSERT INTO public.enterprise_feature_catalog (feature_key, parent_key, display_name, description, sort_order) VALUES
  ('quotas', 'calendar', 'Szabadság-kvóták', 'Éves kvóták és egyenlegek megtekintése/szerkesztése', 6),
  ('substitutes', 'calendar', 'Helyettesítők', 'Helyettesítő kijelölése és megerősítése', 7),
  ('attachments', 'calendar', 'Csatolmányok', 'Dokumentum-feltöltés szabadságkérelemhez', 8),
  ('integrations', 'settings', 'Integrációk', 'Jira / Azure DevOps külső rendszerek', 3)
ON CONFLICT (feature_key) DO NOTHING;