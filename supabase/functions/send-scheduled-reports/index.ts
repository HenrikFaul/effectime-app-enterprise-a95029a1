// Edge function: send-scheduled-reports
// Triggered hourly by pg_cron. Finds active schedules due in this hour,
// runs the underlying report, builds a CSV + HTML summary, and dispatches
// transactional emails to each recipient.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

        const csv = buildCsv(columns, rows);
        const html = buildHtml(report.name, report.description, columns, rows);

        // Send to each recipient
        for (const recipient of sch.recipients) {
          await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: recipient,
              subject: `📊 ${report.name} — ${formatDate(now)}`,
              html,
              attachments: [{
                filename: `${slugify(report.name)}-${formatDate(now)}.csv`,
                content: btoa(unescape(encodeURIComponent(csv))),
                contentType: 'text/csv',
              }],
              template_name: 'scheduled_report',
            }),
          }).catch(err => console.error('Email send error:', err));
        }

        await markRun(admin, sch.id, 'success', null);
        results.push({ id: sch.id, recipients: sch.recipients.length, rows: rows.length });
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
  await admin.from('enterprise_report_schedules').update({
    last_run_at: new Date().toISOString(),
    last_run_status: status,
    last_run_error: error,
  }).eq('id', id);
}

function buildCsv(columns: string[], rows: any[]): string {
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function buildHtml(name: string, desc: string | null, columns: string[], rows: any[]): string {
  const preview = rows.slice(0, 10);
  const headerCells = columns.map(c => `<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">${escapeHtml(c)}</th>`).join('');
  const bodyRows = preview.map(r =>
    `<tr>${columns.map(c => `<td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:13px;">${escapeHtml(r[c])}</td>`).join('')}</tr>`
  ).join('');
  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:22px;margin:0 0 8px;">📊 ${escapeHtml(name)}</h1>
      ${desc ? `<p style="color:#6b7280;margin:0 0 16px;">${escapeHtml(desc)}</p>` : ''}
      <p style="color:#6b7280;font-size:13px;">Automatikus riport · ${rows.length} sor · A teljes adatkészlet a CSV mellékletben található.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${rows.length > 10 ? `<p style="color:#9ca3af;font-size:12px;margin-top:8px;">+${rows.length - 10} további sor a CSV-ben…</p>` : ''}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:11px;">Syncfolk · Riport ütemezés</p>
    </div>
  `;
}

function escapeHtml(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
