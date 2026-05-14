import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shift marketplace hooks (Top-20 Rank 12, shipped v3.21.0).
 *
 * Peer-to-peer shift trading: a member offers an assigned shift, eligible
 * colleagues see the offer, first to accept triggers manager approval
 * (or auto-approves per workspace policy).
 *
 * All writes flow through SECURITY DEFINER RPCs; direct INSERT on the
 * two tables is policy-blocked.
 */

export interface ShiftTradeOffer {
  id: string;
  workspace_id: string;
  shift_assignment_id: string;
  offering_membership_id: string;
  reason: string | null;
  status: 'open' | 'accepted' | 'cancelled' | 'expired' | 'approved' | 'rejected';
  expires_at: string | null;
  created_at: string;
}

export interface ShiftTradeAcceptance {
  id: string;
  offer_id: string;
  accepting_membership_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  decided_by: string | null;
  decided_at: string | null;
  manager_notes: string | null;
  created_at: string;
}

const STALE_MS = 30 * 1000;

export function useOpenTradeOffers(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['shift-trade', 'offers', 'open', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_trade_offers')
        .select('id, workspace_id, shift_assignment_id, offering_membership_id, reason, status, expires_at, created_at')
        .eq('workspace_id', workspaceId as string)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShiftTradeOffer[];
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

export function useMyTradeOffers(workspaceId: string | null | undefined, membershipId: string | null | undefined) {
  return useQuery({
    queryKey: ['shift-trade', 'offers', 'mine', workspaceId, membershipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_trade_offers')
        .select('id, workspace_id, shift_assignment_id, offering_membership_id, reason, status, expires_at, created_at')
        .eq('workspace_id', workspaceId as string)
        .eq('offering_membership_id', membershipId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShiftTradeOffer[];
    },
    enabled: !!workspaceId && !!membershipId,
    staleTime: STALE_MS,
  });
}

export function usePendingAcceptances(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['shift-trade', 'acceptances', 'pending', workspaceId],
    queryFn: async () => {
      // Get all acceptances for offers in this workspace where status = pending
      const { data, error } = await supabase
        .from('shift_trade_acceptances')
        .select('id, offer_id, accepting_membership_id, status, decided_by, decided_at, manager_notes, created_at, shift_trade_offers!inner(workspace_id)')
        .eq('status', 'pending')
        .eq('shift_trade_offers.workspace_id', workspaceId as string);
      if (error) throw error;
      return (data ?? []) as unknown as ShiftTradeAcceptance[];
    },
    enabled: !!workspaceId,
    staleTime: STALE_MS,
  });
}

export async function offerShiftForTrade(shiftAssignmentId: string, reason?: string, expiresAt?: string) {
  const { data, error } = await supabase.rpc('shift_trade_offer', {
    _shift_assignment_id: shiftAssignmentId,
    _reason: reason ?? null,
    _expires_at: expiresAt ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function acceptTradeOffer(offerId: string) {
  const { data, error } = await supabase.rpc('shift_trade_accept', { _offer_id: offerId });
  if (error) throw error;
  return data as { ok: boolean; acceptance_id: string };
}

export async function decideTradeAcceptance(acceptanceId: string, approved: boolean, notes?: string) {
  const { data, error } = await supabase.rpc('shift_trade_decide', {
    _acceptance_id: acceptanceId,
    _approved: approved,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; decided: string };
}

export async function cancelTradeOffer(offerId: string) {
  const { data, error } = await supabase.rpc('shift_trade_cancel', { _offer_id: offerId });
  if (error) throw error;
  return data as { ok: boolean };
}
