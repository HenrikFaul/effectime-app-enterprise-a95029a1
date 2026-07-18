// Edge function: send-scheduled-reports
// Triggered hourly by pg_cron. Finds active schedules due in this hour,
// runs the underlying report and dispatches a bounded HTML preview through the
// transactional-email queue. Full exports remain available in the app because
// the configured provider does not support attachments.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { checkWorkspaceFeature } from '../_shared/feature-entitlement.ts';
import { hasServiceRoleCredential } from '../_shared/request-security.ts';
import {
  classifyTransactionalEmailResult,
  type DeliveryOutcome,
  summarizeDeliveryOutcomes,
} from './delivery-result.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500);
    if (!hasServiceRoleCredential(req, serviceKey)) return json({ error: 'Forbidden' }, 403);
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDow = now.getUTCDay();
    const currentDom = now.getUTCDate();

    const { data: schedules, error } = await admin
      .from('enterprise_report_schedules')
      .select('*, enterprise_reports(*)')
      .eq('is_active', true)
      .eq('hour_of_day', currentHour);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return json({ ok: true, processed: 0, message: 'No schedules due this hour' });
    }

    const results: any[] = [];

    for (const sch of schedules) {
      try {
        // Frequency gating
        if (sch.frequency === 'weekly' && sch.day_of_week !== currentDow) continue;
        if (sch.frequency === 'monthly' && sch.day_of_month !== currentDom) continue;

        // Skip if already ran today (idempotency)
        if (sch.last_run_at) {
          const lastRun = new Date(sch.last_run_at);
          if (lastRun.toDateString() === now.toDateString()) continue;
        }

        // Evaluate the target workspace independently for every due schedule.
        // The scheduler's service credential must never bypass tenant tiering.
        const entitlement = await checkWorkspaceFeature(admin, sch.workspace_id, 'scheduled_reports');
        if (!entitlement.enabled) {
          if (entitlement.reason === 'lookup_error') {
            const context = `Feature entitlement lookup unavailable (${entitlement.step})`;
            console.error(
              `[send-scheduled-reports] schedule=${sch.id} workspace=${sch.workspace_id} feature=scheduled_reports step=${entitlement.step}: ${entitlement.error}`,
            );
            await markRun(admin, sch.id, 'error', context);
            results.push({ id: sch.id, status: 'error', reason: 'entitlement_lookup_unavailable' });
          } else {
            const context = `Feature scheduled_reports is not enabled (${entitlement.reason})`;
            console.warn(
              `[send-scheduled-reports] schedule=${sch.id} workspace=${sch.workspace_id} feature=scheduled_reports skipped reason=${entitlement.reason}`,
            );
            await markRun(admin, sch.id, 'skipped', context);
            results.push({ id: sch.id, status: 'skipped', reason: entitlement.reason });
          }
          continue;
        }

        const report = sch.enterprise_reports;
        if (!report) {
          await markRun(admin, sch.id, 'error', 'Report not found');
          continue;
        }

        // Run the report via the existing run-report function
        const runRes = await fetch(`${supabaseUrl}/functions/v1/run-report`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: sch.workspace_id,
            data_source: report.data_source,
            config: report.config,
          }),
        });

        if (!runRes.ok) {
          const txt = await runRes.text();
          await markRun(admin, sch.id, 'error', `Run failed: ${txt.slice(0, 300)}`);
          continue;
        }

        const runData = await runRes.json();
        const rows = runData.rows || [];
        const columns = runData.columns || [];

        // HTTP 2xx only means the transactional endpoint handled the request.
        // A recipient is delivered exclusively when its business payload says
        // success=true; suppression is a separate, non-delivery outcome.
        const recipients = Array.isArray(sch.recipients)
          ? sch.recipients.filter((recipient: unknown): recipient is string => typeof recipient === 'string')
          : [];
        const outcomes: DeliveryOutcome[] = [];
        for (const [recipientIndex, recipient] of recipients.entries()) {
          try {
            const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                templateName: 'scheduled-report',
                recipientEmail: recipient,
                workspaceId: sch.workspace_id,
                idempotencyKey: `scheduled-report-${sch.id}-${formatDate(now)}-${recipient.toLowerCase()}`,
                templateData: {
                  reportName: report.name,
                  reportDescription: report.description,
                  columns,
                  previewRows: rows.slice(0, 10),
                  rowCount: rows.length,
                  generatedAt: formatDate(now),
                },
              }),
            });
            let sendPayload: unknown = null;
            try {
              sendPayload = await sendRes.json();
            } catch {
              // The classifier treats a missing/malformed success payload as a
              // failed delivery even when the endpoint returned HTTP 2xx.
            }
            const outcome = classifyTransactionalEmailResult(sendRes.ok, sendRes.status, sendPayload);
            outcomes.push(outcome);
            if (outcome.type !== 'delivered') {
              console.warn(
                `[send-scheduled-reports] schedule=${sch.id} recipient_index=${recipientIndex} outcome=${outcome.type} reason=${outcome.reason}`,
              );
            }
          } catch (err) {
            outcomes.push({ type: 'failed', reason: 'dispatch_exception' });
            console.error(
              `[send-scheduled-reports] schedule=${sch.id} recipient_index=${recipientIndex} dispatch threw:`,
              err,
            );
          }
        }

        const summary = summarizeDeliveryOutcomes(outcomes, recipients.length);
        await markRun(admin, sch.id, summary.status, summary.context);
        results.push({
          id: sch.id,
          recipients: recipients.length,
          delivered: summary.delivered,
          suppressed: summary.suppressed,
          failed: summary.failed,
          status: summary.status,
          rows: rows.length,
        });
      } catch (e) {
        console.error(`Schedule ${sch.id} failed:`, e);
        await markRun(admin, sch.id, 'error', (e as Error).message);
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error('send-scheduled-reports error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

async function markRun(admin: any, id: string, status: string, error: string | null) {
  const { error: updateErr } = await admin.from('enterprise_report_schedules').update({
    last_run_at: new Date().toISOString(),
    last_run_status: status,
    last_run_error: error,
  }).eq('id', id);
  if (updateErr) {
    console.error(`[send-scheduled-reports] markRun failed for schedule ${id}:`, updateErr.message);
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
