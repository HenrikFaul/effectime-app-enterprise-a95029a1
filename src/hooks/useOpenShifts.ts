import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { rankCandidates, type MemberInput, type RequirementInput, type EligibilityContext, type EligibilityResult } from '@/lib/coverageEligibility';

export interface OpenShiftRequest {
  id: string;
  workspace_id: string;
  office_id: string;
  shift_date: string;
  business_role: string | null;
  role_id: string | null;
  skill_id: string | null;
  skill_ids: string[];
  notes: string | null;
  status: 'open' | 'filled' | 'cancelled';
  filled_by_user_id: string | null;
  filled_at: string | null;
  created_by: string;
  created_at: string;
  respond_by_at: string | null;
  timeout_hours: number;
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
  roleId?: string;
  skillIds?: string[];
  timeoutHours?: number;
  targetUserIds?: string[];
}

export function useCreateOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId, officeId, shiftDate, businessRole, skillId, notes,
      roleId, skillIds, timeoutHours, targetUserIds,
    }: CreateOpenShiftArgs) => {
      const { data, error } = await (supabase as any).rpc('create_open_shift_request', {
        _workspace_id: workspaceId,
        _office_id: officeId,
        _shift_date: shiftDate,
        _business_role: businessRole ?? null,
        _skill_id: skillId ?? null,
        _notes: notes ?? null,
        _role_id: roleId ?? null,
        _skill_ids: skillIds ?? [],
        _timeout_hours: timeoutHours ?? 3,
        _target_user_ids: targetUserIds ?? [],
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

export function useJoinWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await (supabase as any).rpc('join_open_shift_waitlist', {
        _request_id: requestId,
      });
      if (error) throw error;
      return data as { ok: boolean; position: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-shifts'] });
    },
  });
}

export function useCancelShiftAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await (supabase as any).rpc('cancel_shift_assignment', {
        _assignment_id: assignmentId,
      });
      if (error) throw error;
      return data as { ok: boolean; request_id: string; replacement_found: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-shifts'] });
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
    },
  });
}

interface ShiftCandidatesArgs {
  workspaceId: string;
  officeId: string;
  shiftDate: string;
  businessRole?: string | null;
  skillIds?: string[];
  enabled?: boolean;
}

export function useShiftCandidates({
  workspaceId, officeId, shiftDate, businessRole, skillIds, enabled = true,
}: ShiftCandidatesArgs) {
  return useQuery({
    queryKey: ['shift-candidates', workspaceId, officeId, shiftDate, businessRole, skillIds],
    enabled: enabled && !!workspaceId && !!officeId && !!shiftDate,
    staleTime: STALE_MS,
    queryFn: async () => {
      const baseQueries = [
        (supabase as any).from('enterprise_memberships')
          .select('id,user_id,business_role,weekly_capacity_hours,base_working_hours')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        (supabase as any).from('enterprise_member_skills')
          .select('membership_id,skill_id,level')
          .eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_shift_assignments')
          .select('user_id,office_id,shift_date')
          .eq('workspace_id', workspaceId)
          .eq('shift_date', shiftDate),
        (supabase as any).from('leave_requests')
          .select('user_id,start_date,end_date,status')
          .eq('workspace_id', workspaceId)
          .in('status', ['approved', 'pending'])
          .lte('start_date', shiftDate)
          .gte('end_date', shiftDate),
        (supabase as any).from('enterprise_holidays')
          .select('holiday_date')
          .eq('workspace_id', workspaceId)
          .eq('holiday_date', shiftDate),
        (supabase as any).from('enterprise_blocked_dates')
          .select('blocked_date')
          .eq('workspace_id', workspaceId)
          .eq('blocked_date', shiftDate),
        (supabase as any).from('enterprise_staff_availability')
          .select('user_id,availability_date')
          .eq('workspace_id', workspaceId)
          .eq('availability_date', shiftDate)
          .in('status', ['available', 'preferred']),
        // When a role is requested, also check enterprise_member_role_allocations so members
        // whose position is tracked there (not only in enterprise_memberships.business_role)
        // are correctly included and scored.
        businessRole
          ? (supabase as any).from('enterprise_member_role_allocations')
              .select('membership_id')
              .eq('workspace_id', workspaceId)
              .eq('business_role', businessRole)
          : Promise.resolve({ data: [] }),
      ] as const;

      const [memRes, skillRes, assignRes, leaveRes, holidayRes, blockedRes, avRes, allocRes] =
        await Promise.all(baseQueries);

      // membership_ids that carry the requested role via allocations table
      const allocMembershipIds = new Set<string>(
        ((allocRes.data ?? []) as any[]).map((a: any) => a.membership_id)
      );

      let memRows = (memRes.data ?? []) as any[];

      // Hard-filter: when a specific role is requested, only consider members whose
      // enterprise_memberships.business_role matches OR who have a matching allocation record.
      // This prevents non-matching members from appearing in the candidate list at all.
      if (businessRole) {
        memRows = memRows.filter(
          (m: any) => m.business_role === businessRole || allocMembershipIds.has(m.id)
        );
      }
      const userIds = memRows.map((m: any) => m.user_id);
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from('profiles').select('user_id,display_name').in('user_id', userIds);
        (profs ?? []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || p.user_id; });
      }

      const skillsByMem = new Map<string, { skill_id: string; level: number }[]>();
      ((skillRes.data ?? []) as any[]).forEach((s: any) => {
        const arr = skillsByMem.get(s.membership_id) ?? [];
        arr.push({ skill_id: s.skill_id, level: s.level });
        skillsByMem.set(s.membership_id, arr);
      });

      const members: MemberInput[] = memRows.map((m: any) => ({
        membership_id: m.id,
        user_id: m.user_id,
        display_name: nameMap[m.user_id] ?? m.user_id,
        // For members matched via allocations (not enterprise_memberships.business_role),
        // surface the requested role so the eligibility engine scores them correctly.
        business_role: (businessRole && allocMembershipIds.has(m.id) && m.business_role !== businessRole)
          ? businessRole
          : (m.business_role ?? null),
        weekly_capacity_hours: m.weekly_capacity_hours ?? 40,
        base_working_hours: m.base_working_hours ?? 8,
        skills: skillsByMem.get(m.id) ?? [],
      }));

      const avSet = new Set<string>(
        ((avRes.data ?? []) as any[]).map((a: any) => a.user_id)
      );
      const avByDate = new Map<string, Set<string>>();
      avByDate.set(shiftDate, avSet);

      const ctx: EligibilityContext = {
        holidaysISO: new Set(((holidayRes.data ?? []) as any[]).map((h: any) => h.holiday_date)),
        blockedDatesISO: new Set(((blockedRes.data ?? []) as any[]).map((b: any) => b.blocked_date)),
        leaves: (leaveRes.data ?? []) as any[],
        shifts: (assignRes.data ?? []) as any[],
        availabilityByDate: avByDate,
      };

      const req: RequirementInput = {
        shift_date: shiftDate,
        office_id: officeId,
        business_role: businessRole ?? null,
        skill_ids: skillIds && skillIds.length > 0 ? skillIds : null,
      };

      return rankCandidates(members, req, ctx) as EligibilityResult[];
    },
  });
}
