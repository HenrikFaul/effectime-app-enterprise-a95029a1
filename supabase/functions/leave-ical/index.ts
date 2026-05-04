// iCal feed for personal / team leave subscriptions
// Public endpoint — auth via opaque token
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function fmt(d: string) { return d.replaceAll('-', ''); }
function ical(events: any[], calName: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Effectime Enterprise//Leave Calendar//EN',
    `X-WR-CALNAME:${calName}`,
    'METHOD:PUBLISH',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@effectime`);
    lines.push(`DTSTAMP:${fmt(e.start_date)}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${fmt(e.start_date)}`);
    // iCal end is exclusive
    const end = new Date(e.end_date); end.setDate(end.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`);
    lines.push(`SUMMARY:${e.summary}`);
    if (e.description) lines.push(`DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const scope = url.searchParams.get('scope') || 'own';
    if (!token) return new Response('Missing token', { status: 400, headers: corsHeaders });

    const { data: tk } = await supabase
      .from('enterprise_ical_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (!tk) return new Response('Invalid token', { status: 404, headers: corsHeaders });

    await supabase.from('enterprise_ical_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tk.id);

    let q = supabase
      .from('leave_requests')
      .select('id, start_date, end_date, leave_type, comment, user_id, status, is_private')
      .eq('workspace_id', tk.workspace_id)
      .in('status', ['approved', 'pending']);
    if (scope === 'own') q = q.eq('user_id', tk.user_id);

    const { data: requests } = await q;
    const userIds = Array.from(new Set((requests || []).map((r: any) => r.user_id)));
    const { data: profs } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
    const names: Record<string, string> = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.display_name || 'Munkatárs']));

    const events = (requests || []).map((r: any) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      summary: r.is_private && r.user_id !== tk.user_id
        ? `${names[r.user_id]} – Távol`
        : `${names[r.user_id]} – ${r.leave_type}${r.status === 'pending' ? ' (függőben)' : ''}`,
      description: r.is_private && r.user_id !== tk.user_id ? '' : (r.comment || ''),
    }));

    const body = ical(events, scope === 'team' ? 'SyncFolk – Csapat szabadságok' : 'SyncFolk – Szabadságaim');
    return new Response(body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/calendar; charset=utf-8' },
    });
  } catch (e) {
    return new Response('Error: ' + (e as Error).message, { status: 500, headers: corsHeaders });
  }
});
