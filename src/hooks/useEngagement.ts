import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Engagement / gamification hooks (Top-20 Rank 14, shipped v3.18.0).
 *
 * Read paths use direct table access (RLS scopes member to own data, owner /
 * resourceAssistant to team). Award path uses the SECURITY DEFINER RPC
 * `engagement_record_event` because direct INSERT on
 * engagement_member_achievements is policy-blocked.
 */

export interface AchievementCatalogRow {
  id: string;
  key: string;
  category: string;
  icon: string;
  threshold: number;
  trigger_event: string;
  is_repeatable: boolean;
  sort_order: number;
}

export interface MemberAchievementRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  achievement_id: string;
  earned_at: string;
  streak_value: number | null;
}

export interface StreakRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  streak_type: string;
  current_count: number;
  longest_count: number;
  last_event_at: string | null;
}

const STALE_MS = 60 * 1000;

export function useAchievementsCatalog() {
  return useQuery({
    queryKey: ['engagement', 'catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_achievements')
        .select('id, key, category, icon, threshold, trigger_event, is_repeatable, sort_order')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as AchievementCatalogRow[];
    },
    staleTime: 10 * 60 * 1000, // catalog is mostly static
  });
}

export function useMemberAchievements(workspaceId: string | null | undefined, membershipId: string | null | undefined) {
  return useQuery({
    queryKey: ['engagement', 'member-achievements', workspaceId, membershipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_member_achievements')
        .select('id, workspace_id, membership_id, achievement_id, earned_at, streak_value')
        .eq('workspace_id', workspaceId as string)
        .eq('membership_id', membershipId as string)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberAchievementRow[];
    },
    enabled: !!workspaceId && !!membershipId,
    staleTime: STALE_MS,
  });
}

export function useMemberStreaks(workspaceId: string | null | undefined, membershipId: string | null | undefined) {
  return useQuery({
    queryKey: ['engagement', 'streaks', workspaceId, membershipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_streaks')
        .select('id, workspace_id, membership_id, streak_type, current_count, longest_count, last_event_at')
        .eq('workspace_id', workspaceId as string)
        .eq('membership_id', membershipId as string)
        .order('streak_type');
      if (error) throw error;
      return (data ?? []) as StreakRow[];
    },
    enabled: !!workspaceId && !!membershipId,
    staleTime: STALE_MS,
  });
}

/** Award helper. Wraps the SECURITY DEFINER RPC; safe to call from any UI flow. */
export async function recordEngagementEvent(
  workspaceId: string,
  membershipId: string,
  eventType: 'clock_in_on_time' | 'leave_planned_ahead' | 'shift_swap_accepted' | 'profile_completed',
): Promise<{ ok: boolean; streak?: number; awarded?: Array<{ key: string; category: string; icon: string; streak: number }>; skipped?: string }> {
  const { data, error } = await supabase.rpc('engagement_record_event', {
    _workspace_id: workspaceId,
    _membership_id: membershipId,
    _event_type: eventType,
  });
  if (error) throw error;
  return (data ?? { ok: false }) as { ok: boolean; streak?: number; awarded?: Array<{ key: string; category: string; icon: string; streak: number }>; skipped?: string };
}
