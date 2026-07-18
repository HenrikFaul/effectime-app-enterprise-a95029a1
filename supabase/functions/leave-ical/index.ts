// iCal feed for personal / team leave subscriptions
// Public endpoint — auth via opaque token
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { checkWorkspaceFeature } from '../_shared/feature-entitlement.ts';
import { canUseIcalScope, parseIcalScope, type WorkspaceRole } from './security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function fmt(d: string) { return d.replaceAll('-', ''); }
function escapeIcalText(value: unknown) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\n', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}
function ical(events: any[], calName: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Effectime Enterprise//Leave Calendar//EN',
    `X-WR-CALNAME:${escapeIcalText(calName)}`,
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
    lines.push(`SUMMARY:${escapeIcalText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcalText(e.description)}`);
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
    if (!token) return new Response('Missing token', { status: 400, headers: corsHeaders });

    const { data: tk, error: tokenError } = await supabase
      .from('enterprise_ical_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (tokenError) {
      console.error('[leave-ical] token lookup failed:', tokenError.message);
      return new Response('Calendar feed temporarily unavailable', { status: 503, headers: corsHeaders });
    }
    if (!tk) return new Response('Invalid token', { status: 404, headers: corsHeaders });
    const scope = parseIcalScope(tk.scope);
    if (!scope) return new Response('Invalid token scope', { status: 403, headers: corsHeaders });

    const { data: membership, error: membershipError } = await supabase
      .from('enterprise_memberships')
      .select('role')
      .eq('workspace_id', tk.workspace_id)
      .eq('user_id', tk.user_id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) {
      console.error('[leave-ical] membership lookup failed:', membershipError.message);
      return new Response('Calendar feed temporarily unavailable', { status: 503, headers: corsHeaders });
    }
    if (!membership || !canUseIcalScope(scope, membership.role as WorkspaceRole)) {
      return new Response('Calendar feed access revoked', { status: 403, headers: corsHeaders });
    }

    const entitlement = await checkWorkspaceFeature(supabase, tk.workspace_id, 'ical_feed');
    if (!entitlement.enabled) {
      if (entitlement.reason === 'lookup_error') {
        console.error(
          `[leave-ical] entitlement lookup failed workspace=${tk.workspace_id} step=${entitlement.step}: ${entitlement.error}`,
        );
        return new Response('Calendar feed temporarily unavailable', { status: 503, headers: corsHeaders });
      }
      return new Response('Calendar feed feature disabled', { status: 403, headers: corsHeaders });
    }

    const { error: usageError } = await supabase
      .from('enterprise_ical_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tk.id);
    if (usageError) console.warn('[leave-ical] last-used timestamp update failed:', usageError.message);

    let q = supabase
      .from('leave_requests')
      .select('id, start_date, end_date, leave_type, comment, user_id, status, is_private')
      .eq('workspace_id', tk.workspace_id)
      .eq('status', 'approved');
    if (scope === 'own') q = q.eq('user_id', tk.user_id);

    const { data: requests, error: requestsError } = await q;
    if (requestsError) {
      console.error('[leave-ical] leave query failed:', requestsError.message);
      return new Response('Calendar feed temporarily unavailable', { status: 503, headers: corsHeaders });
    }
    const userIds = Array.from(new Set((requests || []).map((r: any) => r.user_id)));
    const { data: profs, error: profilesError } = userIds.length > 0
      ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
      : { data: [], error: null };
    if (profilesError) {
      console.warn('[leave-ical] profile enrichment unavailable; using generic labels:', profilesError.message);
    }
    const names: Record<string, string> = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.display_name || 'Munkatárs']));

    const events = (requests || []).map((r: any) => {
      const personName = names[r.user_id] || 'Munkatárs';
      return {
        id: r.id,
        start_date: r.start_date,
        end_date: r.end_date,
        summary: r.is_private && r.user_id !== tk.user_id
          ? `${personName} – Távol`
          : `${personName} – ${r.leave_type}`,
        description: r.is_private && r.user_id !== tk.user_id ? '' : (r.comment || ''),
      };
    });

    const body = ical(events, scope === 'team' ? 'Effectime – Csapat szabadságok' : 'Effectime – Szabadságaim');
    return new Response(body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/calendar; charset=utf-8' },
    });
  } catch (e) {
    console.error('[leave-ical] unhandled error:', e instanceof Error ? e.message : String(e));
    return new Response('Calendar feed temporarily unavailable', { status: 500, headers: corsHeaders });
  }
});
