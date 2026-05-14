import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Clock-in hooks (Top-20 Rank 10, shipped v3.22.0).
 *
 * Smartphone-based attendance verification via GPS / NFC / QR. Replaces
 * physical time-clock hardware. All clock events are append-only and
 * written through the SECURITY DEFINER `clock_event` RPC.
 */

export interface ClockEventRow {
  id: string;
  workspace_id: string;
  membership_id: string;
  event_type: 'clock_in' | 'clock_out';
  method: 'gps' | 'nfc' | 'qr' | 'manual';
  office_id: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  verified: boolean;
  created_at: string;
}

export function useTodayClockEvents(workspaceId: string | null | undefined, membershipId: string | null | undefined) {
  return useQuery({
    queryKey: ['clock', 'today', workspaceId, membershipId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('clock_events')
        .select('id, workspace_id, membership_id, event_type, method, office_id, latitude, longitude, distance_m, verified, created_at')
        .eq('workspace_id', workspaceId as string)
        .eq('membership_id', membershipId as string)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClockEventRow[];
    },
    enabled: !!workspaceId && !!membershipId,
    staleTime: 15 * 1000,
  });
}

export function useLiveAttendance(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['clock', 'live', workspaceId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('clock_events')
        .select('id, workspace_id, membership_id, event_type, method, office_id, latitude, longitude, distance_m, verified, created_at')
        .eq('workspace_id', workspaceId as string)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClockEventRow[];
    },
    enabled: !!workspaceId,
    staleTime: 15 * 1000,
  });
}

export async function clockEvent(args: {
  workspaceId: string;
  eventType: 'clock_in' | 'clock_out';
  method: 'gps' | 'nfc' | 'qr' | 'manual';
  latitude?: number;
  longitude?: number;
  qrCode?: string;
  nfcTag?: string;
  officeId?: string;
}) {
  const { data, error } = await supabase.rpc('clock_event', {
    _workspace_id: args.workspaceId,
    _event_type: args.eventType,
    _method: args.method,
    _latitude: args.latitude ?? null,
    _longitude: args.longitude ?? null,
    _qr_code: args.qrCode ?? null,
    _nfc_tag: args.nfcTag ?? null,
    _office_id: args.officeId ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; event_id: string; verified: boolean; office_id: string | null; distance_m: number | null };
}

export async function generateQrSession(officeId: string, ttlSeconds = 60) {
  const { data, error } = await supabase.rpc('clock_generate_qr', {
    _office_id: officeId,
    _ttl_seconds: ttlSeconds,
  });
  if (error) throw error;
  return data as { ok: boolean; session_id: string; code: string; expires_at: string };
}
