import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OpenShiftRequest {
  id: string;
  workspace_id: string;
  office_id: string;
  shift_date: string;
  business_role: string | null;
  skill_id: string | null;
  notes: string | null;
  status: 'open' | 'filled' | 'cancelled';
  filled_by_user_id: string | null;
  filled_at: string | null;
  created_by: string;
  created_at: string;
}

const STALE_MS = 30_000;

export function useOpenShiftRequests(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['open-shifts', workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('enterprise_open_shift_requests')
        .select('*')
        .eq('workspace_id', workspaceId)
        .in('status', ['open', 'filled'])
        .order('shift_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpenShiftRequest[];
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

export function useClaimOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await (supabase as any).rpc('claim_open_shift', {
        _request_id: requestId,
      });
      if (error) throw error;
      return data as { ok: boolean; assignment_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-shifts'] });
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
    },
  });
}

interface CreateOpenShiftArgs {
  workspaceId: string;
  officeId: string;
  shiftDate: string;
  businessRole?: string;
  skillId?: string;
  notes?: string;
}

export function useCreateOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, officeId, shiftDate, businessRole, skillId, notes }: CreateOpenShiftArgs) => {
      const { data, error } = await (supabase as any).rpc('create_open_shift_request', {
        _workspace_id: workspaceId,
        _office_id: officeId,
        _shift_date: shiftDate,
        _business_role: businessRole ?? null,
        _skill_id: skillId ?? null,
        _notes: notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, { workspaceId }) => {
      qc.invalidateQueries({ queryKey: ['open-shifts', workspaceId] });
    },
  });
}

export function useCancelOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await (supabase as any).rpc('cancel_open_shift_request', {
        _request_id: requestId,
      });
      if (error) throw error;
      return data as { ok: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-shifts'] });
    },
  });
}
