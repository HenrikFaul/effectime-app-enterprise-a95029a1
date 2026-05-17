-- v3.41.5b — Drop duplicate indexes identified by Supabase performance advisors
-- enterprise_reports: enterprise_reports_pinned_idx duplicates idx_enterprise_reports_pinned
DROP INDEX IF EXISTS public.enterprise_reports_pinned_idx;

-- interview_slots: idx_interview_slots_start duplicates idx_interview_slots_workspace_time
-- Both are (workspace_id, slot_start) btree — keep the more descriptive name
DROP INDEX IF EXISTS public.idx_interview_slots_start;
