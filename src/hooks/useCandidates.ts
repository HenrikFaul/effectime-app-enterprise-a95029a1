import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Candidate / ATS hooks (Top-20 Rank 20, v3.31.0).
 *
 * Internal candidate pipeline + interview slot scheduling with multi-
 * interviewer eligibility (no leave conflicts, no double-bookings).
 * Public self-booking via signed token; ATS adapters (Greenhouse / Lever
 * / Workable) deferred to v3.31.1+.
 */

export interface Candidate {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  position_applied: string | null;
  ats_provider: string | null;
  ats_candidate_id: string | null;
  status: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InterviewSlot {
  id: string;
  workspace_id: string;
  candidate_id: string | null;
  interviewer_membership_ids: string[];
  slot_start: string;
  slot_end: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled' | 'no_show';
  booking_token: string | null;
  notes: string | null;
  outcome_rating: number | null;
  outcome_recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire' | null;
}

export function useCandidates(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['candidates', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, workspace_id, name, email, position_applied, ats_provider, ats_candidate_id, status, metadata, created_at')
        .eq('workspace_id', workspaceId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useInterviewSlots(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['interview-slots', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_slots')
        .select('id, workspace_id, candidate_id, interviewer_membership_ids, slot_start, slot_end, status, booking_token, notes, outcome_rating, outcome_recommendation')
        .eq('workspace_id', workspaceId as string)
        .gte('slot_start', new Date().toISOString())
        .order('slot_start');
      if (error) throw error;
      return (data ?? []) as InterviewSlot[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export async function createInterviewSlot(args: {
  workspaceId: string;
  slotStart: string;
  slotEnd: string;
  interviewerIds: string[];
  notes?: string;
}) {
  const { data, error } = await supabase.rpc('candidate_create_slot', {
    _workspace_id: args.workspaceId,
    _slot_start: args.slotStart,
    _slot_end: args.slotEnd,
    _interviewer_ids: args.interviewerIds,
    _notes: args.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function bookSlotPublic(token: string, candidateName: string, candidateEmail: string) {
  const { data, error } = await supabase.rpc('candidate_self_book', {
    _booking_token: token,
    _candidate_name: candidateName,
    _candidate_email: candidateEmail,
  });
  if (error) throw error;
  return data as { ok: boolean; slot_id: string; slot_start: string; slot_end: string; candidate_id: string };
}

export async function generateCandidateOnboarding(workspaceId: string, candidateId: string, startDate: string) {
  const { data, error } = await supabase.rpc('candidate_generate_onboarding', {
    _workspace_id: workspaceId,
    _candidate_id: candidateId,
    _start_date: startDate,
  });
  if (error) throw error;
  return data as { ok: boolean; candidate_id: string; onboarding_instance_id: string | null; template_used: string | null };
}
