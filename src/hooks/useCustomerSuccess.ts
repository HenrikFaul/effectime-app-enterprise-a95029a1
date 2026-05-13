import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Customer Success hooks (Top-20 Rank 17, shipped v3.19.0).
 *
 * Three pillars from the strategy doc:
 *   1. In-app onboarding checklist — completion correlates with retention.
 *   2. NPS automation — 30 days post-onboarding, then every 90 days.
 *   3. Health scores — algorithmic per-workspace scoring 0–100.
 *
 * All write paths route through SECURITY DEFINER RPCs; direct INSERT on the
 * three tables is policy-blocked.
 */

export const ONBOARDING_ITEMS = [
  'team_invited',
  'sites_configured',
  'schedule_template_created',
  'calendar_connected',
  'first_schedule_published',
  'mobile_app_installed',
  'member_skill_added',
] as const;
export type OnboardingItem = typeof ONBOARDING_ITEMS[number];

export interface OnboardingProgressRow {
  id: string;
  workspace_id: string;
  item_key: OnboardingItem;
  completed_at: string;
  completed_by: string | null;
}

export interface NpsSurveyRow {
  id: string;
  workspace_id: string;
  user_id: string;
  triggered_at: string;
  responded_at: string | null;
  score: number | null;
  feedback: string | null;
  category: 'onboarding' | 'periodic';
}

export interface HealthScoreRow {
  id: string;
  workspace_id: string;
  score: number;
  components: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
  calculated_at: string;
}

const STALE_MS = 60 * 1000;

export function useOnboardingProgress(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs', 'onboarding', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_success_onboarding_progress')
        .select('id, workspace_id, item_key, completed_at, completed_by')
        .eq('workspace_id', workspaceId as string)
        .order('completed_at');
      if (error) throw error;
      return (data ?? []) as OnboardingProgressRow[];
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

export async function recordOnboardingStep(workspaceId: string, itemKey: OnboardingItem) {
  const { data, error } = await supabase.rpc('customer_success_record_onboarding_step', {
    _workspace_id: workspaceId,
    _item_key: itemKey,
  });
  if (error) throw error;
  return data as { ok: boolean; item_key: string };
}

export function usePendingNpsSurvey(workspaceId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs', 'nps-pending', workspaceId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_success_nps_surveys')
        .select('id, workspace_id, user_id, triggered_at, responded_at, score, feedback, category')
        .eq('workspace_id', workspaceId as string)
        .eq('user_id', userId as string)
        .is('responded_at', null)
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as NpsSurveyRow | null;
    },
    enabled: !!workspaceId && !!userId,
    staleTime: STALE_MS,
  });
}

export async function triggerNpsSurvey(workspaceId: string, category: 'onboarding' | 'periodic' = 'periodic') {
  const { data, error } = await supabase.rpc('customer_success_trigger_nps', {
    _workspace_id: workspaceId,
    _category: category,
  });
  if (error) throw error;
  return data as string | null;
}

export async function submitNpsResponse(surveyId: string, score: number, feedback?: string) {
  const { data, error } = await supabase.rpc('customer_success_submit_nps', {
    _survey_id: surveyId,
    _score: score,
    _feedback: feedback ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean };
}

export function useLatestHealthScore(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs', 'health', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_success_health_scores')
        .select('id, workspace_id, score, components, trend, calculated_at')
        .eq('workspace_id', workspaceId as string)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as HealthScoreRow | null;
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

export async function calculateHealthScore(workspaceId: string) {
  const { data, error } = await supabase.rpc('customer_success_calculate_health_score', {
    _workspace_id: workspaceId,
  });
  if (error) throw error;
  return data as { ok: boolean; score: number; trend: string };
}
