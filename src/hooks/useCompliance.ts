import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Compliance hooks (Top-20 Rank 13, shipped v3.20.0).
 *
 * Two surfaces: a real-time violation list (read-only, RLS-scoped to owners
 * + resourceAssistants) and an on-demand RPC that runs the WTD check for a
 * given period. The RPC ALSO inserts violation rows so the dashboard stays
 * current.
 */

export interface ComplianceViolation {
  id: string;
  workspace_id: string;
  membership_id: string | null;
  jurisdiction: string;
  rule_key: string;
  period_start: string;
  period_end: string;
  actual_value: number | null;
  limit_value: number | null;
  severity: 'warning' | 'violation';
  detected_at: string;
  resolved_at: string | null;
  details: Record<string, unknown>;
}

export interface ComplianceRuleset {
  id: string;
  workspace_id: string;
  jurisdiction: 'EU_WTD' | 'HU_MT' | 'DE_ArbZG' | 'AT_AVRAG' | 'custom';
  parameters: Record<string, unknown>;
  is_active: boolean;
}

export function useComplianceViolations(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['compliance', 'violations', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_violations')
        .select('id, workspace_id, membership_id, jurisdiction, rule_key, period_start, period_end, actual_value, limit_value, severity, detected_at, resolved_at, details')
        .eq('workspace_id', workspaceId as string)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ComplianceViolation[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useComplianceRuleset(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['compliance', 'ruleset', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_rulesets')
        .select('id, workspace_id, jurisdiction, parameters, is_active')
        .eq('workspace_id', workspaceId as string)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ComplianceRuleset | null;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export async function runComplianceCheck(workspaceId: string, periodStart: string, periodEnd: string) {
  const { data, error } = await supabase.rpc('compliance_check_working_time', {
    _workspace_id: workspaceId,
    _period_start: periodStart,
    _period_end: periodEnd,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    jurisdiction: string;
    period_start: string;
    period_end: string;
    weekly_limit: number;
    daily_rest_min: number;
    violations: Array<{
      id: string;
      membership_id: string;
      name: string;
      rule: string;
      actual: number;
      limit: number;
      severity: 'warning' | 'violation';
    }>;
  };
}
