import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Wellbeing hooks (Top-20 Rank 8, completed in v3.23.0).
 *
 * The tables `wellbeing_scores` and `wellbeing_alerts` were created earlier;
 * this release adds the scoring engine (RPC) and exposes it via a hook that
 * the existing WellbeingDashboard can call from a Recalculate button.
 */

export interface WellbeingScoreRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  score: number;
  components: Record<string, unknown>;
  calculated_at: string;
  period_start: string | null;
  period_end: string | null;
}

export interface WellbeingAlertRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  triggered_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

export function useLatestWellbeingScores(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['wellbeing', 'latest-scores', workspaceId],
    queryFn: async () => {
      // Take the most recent score per member by ordering descending and
      // de-duplicating in JS (avoids a Postgres window-function query that
      // PostgREST cannot construct directly).
      const { data, error } = await supabase
        .from('wellbeing_scores')
        .select('id, workspace_id, membership_id, score, components, calculated_at, period_start, period_end')
        .eq('workspace_id', workspaceId as string)
        .order('calculated_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const latestPerMember = new Map<string, WellbeingScoreRow>();
      for (const row of (data ?? []) as WellbeingScoreRow[]) {
        if (!latestPerMember.has(row.membership_id)) latestPerMember.set(row.membership_id, row);
      }
      return Array.from(latestPerMember.values());
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useOpenWellbeingAlerts(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['wellbeing', 'alerts', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wellbeing_alerts')
        .select('id, workspace_id, membership_id, alert_type, severity, triggered_at, resolved_at, metadata')
        .eq('workspace_id', workspaceId as string)
        .is('resolved_at', null)
        .order('triggered_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WellbeingAlertRow[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export async function recalculateWellbeingScores(workspaceId: string) {
  const { data, error } = await supabase.rpc('wellbeing_calculate_scores', {
    _workspace_id: workspaceId,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    count: number;
    alerts_fired: number;
    results: Array<{ membership_id: string; name: string; score: number }>;
  };
}
