import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Predictive analytics hooks (Top-20 Rank 3, v3.29.0).
 *
 * Three forecasting/risk surfaces backed by SECURITY DEFINER RPCs:
 *   - Labor cost forecast (next N months)
 *   - Per-member absence risk score 0-100
 *   - 90-day coverage risk heatmap (green/yellow/red per day)
 */

export interface LaborCostMonth {
  month_offset: number;
  month_start: string;
  projected_cost_eur: number;
}

export interface AbsenceRiskRow {
  membership_id: string;
  name: string;
  risk_score: number;
  recent_approved_180d: number;
  recent_sick_180d: number;
  year_approved: number;
}

export interface CoverageDay {
  date: string;
  on_leave: number;
  total: number;
  pct_out: number;
  color: 'green' | 'yellow' | 'red';
  dow: number;
}

export function useLaborCostForecast(workspaceId: string | null | undefined, monthsAhead = 6) {
  return useQuery({
    queryKey: ['analytics', 'labor-cost', workspaceId, monthsAhead],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_labor_cost_forecast', {
        _workspace_id: workspaceId as string,
        _months_ahead: monthsAhead,
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; currency: string; forecast: LaborCostMonth[] };
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAbsenceRiskScores(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['analytics', 'absence-risk', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_absence_risk_scores', {
        _workspace_id: workspaceId as string,
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; results: AbsenceRiskRow[] };
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoverageRiskHeatmap(workspaceId: string | null | undefined, daysAhead = 90) {
  return useQuery({
    queryKey: ['analytics', 'coverage-heatmap', workspaceId, daysAhead],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_coverage_risk_heatmap', {
        _workspace_id: workspaceId as string,
        _days_ahead: daysAhead,
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; total_members: number; days: CoverageDay[] };
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}
