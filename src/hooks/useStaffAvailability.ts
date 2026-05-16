import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred';

export interface StaffAvailabilityRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  user_id: string;
  availability_date: string;
  status: AvailabilityStatus;
  notes: string | null;
}

const STALE_MS = 60_000;

/** All availability rows for a workspace in a date range — used by managers in CoveragePlannerView */
export function useWorkspaceAvailability(
  workspaceId: string | null | undefined,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['staff-availability', 'workspace', workspaceId, from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('enterprise_staff_availability')
        .select('id,workspace_id,membership_id,user_id,availability_date,status,notes')
        .eq('workspace_id', workspaceId)
        .gte('availability_date', from)
        .lte('availability_date', to);
      if (error) throw error;
      return (data ?? []) as StaffAvailabilityRow[];
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

/** Current user's availability rows for a given month — used in AvailabilityCalendar */
export function useMyAvailability(
  workspaceId: string | null | undefined,
  userId: string | null | undefined,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['staff-availability', 'mine', workspaceId, userId, from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('enterprise_staff_availability')
        .select('id,workspace_id,membership_id,user_id,availability_date,status,notes')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .gte('availability_date', from)
        .lte('availability_date', to);
      if (error) throw error;
      return (data ?? []) as StaffAvailabilityRow[];
    },
    enabled: !!workspaceId && !!userId,
    staleTime: STALE_MS,
  });
}

interface UpsertAvailabilityArgs {
  workspaceId: string;
  membershipId: string;
  userId: string;
  date: string;
  status: AvailabilityStatus;
  notes?: string;
}

/** Upsert a single availability row (insert or update on conflict). */
export function useUpsertAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, membershipId, userId, date, status, notes }: UpsertAvailabilityArgs) => {
      const { error } = await (supabase as any)
        .from('enterprise_staff_availability')
        .upsert(
          {
            workspace_id: workspaceId,
            membership_id: membershipId,
            user_id: userId,
            availability_date: date,
            status,
            notes: notes ?? null,
          },
          { onConflict: 'workspace_id,user_id,availability_date' }
        );
      if (error) throw error;
    },
    onSuccess: (_data, { workspaceId, userId }) => {
      qc.invalidateQueries({ queryKey: ['staff-availability', 'workspace', workspaceId] });
      qc.invalidateQueries({ queryKey: ['staff-availability', 'mine', workspaceId, userId] });
    },
  });
}

/** Remove a single availability row. */
export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workspaceId, userId }: { id: string; workspaceId: string; userId: string }) => {
      const { error } = await (supabase as any)
        .from('enterprise_staff_availability')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { workspaceId, userId };
    },
    onSuccess: (_data, { workspaceId, userId }) => {
      qc.invalidateQueries({ queryKey: ['staff-availability', 'workspace', workspaceId] });
      qc.invalidateQueries({ queryKey: ['staff-availability', 'mine', workspaceId, userId] });
    },
  });
}
