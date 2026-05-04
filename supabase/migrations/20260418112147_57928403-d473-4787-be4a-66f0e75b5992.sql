-- Additive enhancement of enterprise_reports for semantic dataset layer
-- Existing columns (data_source, config, chart_type) remain untouched for backward compatibility.

ALTER TABLE public.enterprise_reports
  ADD COLUMN IF NOT EXISTS dataset_key text,
  ADD COLUMN IF NOT EXISTS dashboard_slot integer,
  ADD COLUMN IF NOT EXISTS widget_size text DEFAULT 'medium';

-- Index for fast dashboard widget lookup
CREATE INDEX IF NOT EXISTS idx_enterprise_reports_pinned
  ON public.enterprise_reports (workspace_id, is_pinned)
  WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_enterprise_reports_template
  ON public.enterprise_reports (workspace_id, is_template)
  WHERE is_template = true;