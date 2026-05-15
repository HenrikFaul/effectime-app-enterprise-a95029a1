// Edge Function: payroll-export
// Handles payroll period calculation, multi-provider CSV export, period locking,
// and a placeholder for direct API push to external payroll systems.
//
// Actions:
//   calculate-period  – compute per-member hours/overtime/leave/gross for a payroll period
//   export-csv        – generate provider-formatted CSV and mark the period as exported
//   lock-period       – lock an open payroll period with a full audit trail
//   export-api        – placeholder for future provider API push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import { corsHeaders } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Count working days (Mon–Fri) between two ISO date strings, inclusive. */
function countWorkdays(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getUTCDay()
    if (day !== 0 && day !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

/** Return true when two date ranges overlap (inclusive, ISO string dates). */
function rangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

// ---------------------------------------------------------------------------
// Core: calculate-period logic (shared by calculate-period and export-csv)
// ---------------------------------------------------------------------------

async function calculatePeriod(admin: ReturnType<typeof createClient>, workspaceId: string, periodId: string) {
  // 1. Load the payroll period
  const { data: period, error: periodErr } = await admin
    .from('payroll_periods')
    .select('id, name, start_date, end_date, currency')
    .eq('id', periodId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (periodErr) throw new Error(`Failed to load payroll period: ${periodErr.message}`)
  if (!period) throw new Error('Payroll period not found')

  const { start_date: periodStart, end_date: periodEnd, name: periodName, currency: periodCurrency } = period

  // 2. Load active members with their profiles and latest cost rate
  const { data: memberships, error: membErr } = await admin
    .from('enterprise_memberships')
    .select(`
      id,
      user_id,
      base_working_hours,
      profiles:user_id ( display_name )
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  if (membErr) throw new Error(`Failed to load memberships: ${membErr.message}`)
  const members = memberships || []

  // 3. Load attendance periods that overlap the payroll period
  const { data: attendancePeriods, error: attErr } = await admin
    .from('enterprise_attendance_periods')
    .select('membership_id, start_date, end_date, totals')
    .eq('workspace_id', workspaceId)
    .lte('start_date', periodEnd)
    .gte('end_date', periodStart)

  if (attErr) throw new Error(`Failed to load attendance periods: ${attErr.message}`)
  const attendance = attendancePeriods || []

  // 4. Load approved leave requests that overlap the payroll period
  const { data: leaveRequests, error: leaveErr } = await admin
    .from('leave_requests')
    .select('user_id, start_date, end_date, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    .lte('start_date', periodEnd)
    .gte('end_date', periodStart)

  if (leaveErr) throw new Error(`Failed to load leave requests: ${leaveErr.message}`)
  const leaves = leaveRequests || []

  // 5. Load latest cost rate per membership
  const membershipIds = members.map((m: any) => m.id)
  let rateMap = new Map<string, number>()
  if (membershipIds.length > 0) {
    const { data: rates, error: rateErr } = await admin
      .from('enterprise_member_rates')
      .select('membership_id, cost_rate, effective_from')
      .in('membership_id', membershipIds)
      .order('effective_from', { ascending: false })

    if (rateErr) throw new Error(`Failed to load member rates: ${rateErr.message}`)
    // Keep only the most-recent rate per membership
    for (const r of rates || []) {
      if (!rateMap.has(r.membership_id)) {
        rateMap.set(r.membership_id, Number(r.cost_rate) || 0)
      }
    }
  }

  // 6. Compute per-member figures
  const payrollMembers: Array<{
    membership_id: string
    display_name: string
    regular_hours: number
    overtime_hours: number
    leave_days: number
    gross_estimate: number
    currency: string
  }> = []

  const workdays = countWorkdays(periodStart, periodEnd)

  for (const m of members) {
    const memberAttendance = attendance.filter((a: any) => a.membership_id === m.id)
    const baseHoursPerDay: number = Number(m.base_working_hours) || 8
    const costRate: number = rateMap.get(m.id) || 0

    // Sum hours from attendance totals JSONB where period overlaps payroll period
    let totalHours = 0
    for (const a of memberAttendance) {
      if (rangesOverlap(a.start_date, a.end_date, periodStart, periodEnd)) {
        const totalsHours = Number(a.totals?.hours) || 0
        totalHours += totalsHours
      }
    }

    // Overtime = max(0, total_hours - base_working_hours * workdays)
    const expectedHours = baseHoursPerDay * workdays
    const regularHours = Math.min(totalHours, expectedHours)
    const overtimeHours = Math.max(0, totalHours - expectedHours)

    // Count approved leave days overlapping the period
    const memberLeaves = leaves.filter((l: any) => l.user_id === m.user_id)
    let leaveDays = 0
    for (const l of memberLeaves) {
      if (rangesOverlap(l.start_date, l.end_date, periodStart, periodEnd)) {
        // Count calendar days of the leave that fall within the payroll period
        const overlapStart = l.start_date > periodStart ? l.start_date : periodStart
        const overlapEnd = l.end_date < periodEnd ? l.end_date : periodEnd
        leaveDays += countWorkdays(overlapStart, overlapEnd)
      }
    }

    const grossEstimate = totalHours * costRate

    const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    const displayName: string = profileData?.display_name || 'Unknown'

    // If the profile is missing or its display_name is empty, payroll data
    // would land in downstream systems as "Unknown". Surface this loudly
    // via an audit-event so ops can investigate (B-32 / LESSON-DOD-001).
    // Fire-and-forget — never block payroll export on audit-write failure.
    if (!profileData?.display_name) {
      try {
        admin.from('enterprise_audit_events').insert({
          workspace_id: workspaceId,
          actor_id: null,
          action: 'payroll.export.member_profile_missing',
          metadata: { membership_id: m.id, user_id: m.user_id, period_id: periodId },
        }).then(({ error: auditErr }: { error: unknown }) => {
          if (auditErr) console.warn('[payroll-export] audit insert failed', auditErr)
        })
      } catch (e) {
        console.warn('[payroll-export] audit insert threw', e)
      }
    }

    payrollMembers.push({
      membership_id: m.id,
      display_name: displayName,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      leave_days: leaveDays,
      gross_estimate: Math.round(grossEstimate * 100) / 100,
      currency: periodCurrency || 'EUR',
    })
  }

  const totals = {
    total_hours: Math.round(payrollMembers.reduce((s, m) => s + m.regular_hours + m.overtime_hours, 0) * 100) / 100,
    total_overtime: Math.round(payrollMembers.reduce((s, m) => s + m.overtime_hours, 0) * 100) / 100,
    total_gross: Math.round(payrollMembers.reduce((s, m) => s + m.gross_estimate, 0) * 100) / 100,
    member_count: payrollMembers.length,
  }

  return { members: payrollMembers, totals, period }
}

// ---------------------------------------------------------------------------
// CSV generators per provider
// ---------------------------------------------------------------------------

function buildCsv(
  members: Array<{
    membership_id: string
    display_name: string
    regular_hours: number
    overtime_hours: number
    leave_days: number
    gross_estimate: number
    currency: string
  }>,
  period: { name: string; start_date: string; end_date: string },
  provider: string,
): string {
  const { name: periodName, start_date: periodStart, end_date: periodEnd } = period
  const lines: string[] = []

  switch (provider) {
    case 'datev': {
      // Semicolon-delimited, German headers
      lines.push('Personalnummer;Name;Zeitraum;Normalstunden;Überstunden;Urlaubstage;Bruttolohn;Währung')
      for (const m of members) {
        const cols = [
          m.membership_id,
          `"${m.display_name.replace(/"/g, '""')}"`,
          `"${periodName}"`,
          String(m.regular_hours).replace('.', ','),
          String(m.overtime_hours).replace('.', ','),
          String(m.leave_days),
          String(m.gross_estimate).replace('.', ','),
          m.currency,
        ]
        lines.push(cols.join(';'))
      }
      break
    }

    case 'bamboohr': {
      // Comma-delimited, BambooHR field names
      lines.push('Employee ID,Employee Name,Period,Regular Hours,Overtime Hours,Leave Days')
      for (const m of members) {
        const cols = [
          m.membership_id,
          `"${m.display_name.replace(/"/g, '""')}"`,
          `"${periodName}"`,
          String(m.regular_hours),
          String(m.overtime_hours),
          String(m.leave_days),
        ]
        lines.push(cols.join(','))
      }
      break
    }

    case 'personio': {
      // Comma-delimited, Personio field names
      lines.push('employee_id,name,period_start,period_end,hours,overtime,absences,gross')
      for (const m of members) {
        const cols = [
          m.membership_id,
          `"${m.display_name.replace(/"/g, '""')}"`,
          periodStart,
          periodEnd,
          String(m.regular_hours),
          String(m.overtime_hours),
          String(m.leave_days),
          String(m.gross_estimate),
        ]
        lines.push(cols.join(','))
      }
      break
    }

    default: {
      // Generic / fallback: comma-delimited with full columns
      lines.push('ID,Name,Period Start,Period End,Regular Hours,Overtime Hours,Leave Days,Gross Estimate,Currency')
      for (const m of members) {
        const cols = [
          m.membership_id,
          `"${m.display_name.replace(/"/g, '""')}"`,
          periodStart,
          periodEnd,
          String(m.regular_hours),
          String(m.overtime_hours),
          String(m.leave_days),
          String(m.gross_estimate),
          m.currency,
        ]
        lines.push(cols.join(','))
      }
      break
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // --- Auth: validate JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonRes({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonRes({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({}))
    const { action, workspaceId } = body

    if (!workspaceId) return jsonRes({ error: 'workspaceId is required' }, 400)

    // --- Auth: workspace admin check (owner or resourceAssistant) ---
    const { data: adminMembership } = await admin
      .from('enterprise_memberships')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'resourceAssistant'])
      .maybeSingle()

    if (!adminMembership) return jsonRes({ error: 'Forbidden: workspace admin role required' }, 403)

    // =========================================================
    // Action: calculate-period
    // =========================================================
    if (action === 'calculate-period') {
      const { periodId } = body
      if (!periodId) return jsonRes({ error: 'periodId is required' }, 400)

      const { members, totals } = await calculatePeriod(admin, workspaceId, periodId)
      return jsonRes({ members, totals })
    }

    // =========================================================
    // Action: export-csv
    // =========================================================
    if (action === 'export-csv') {
      const { periodId, provider = 'generic' } = body
      if (!periodId) return jsonRes({ error: 'periodId is required' }, 400)

      const { members, period } = await calculatePeriod(admin, workspaceId, periodId)

      const csv = buildCsv(members, period, provider)

      // Safe filename: replace non-alphanumeric chars with underscores
      const safeProvider = String(provider).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const safePeriodName = String(period.name).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const filename = `payroll_${safePeriodName}_${safeProvider}.csv`

      // Mark period as exported
      const { error: updateErr } = await admin
        .from('payroll_periods')
        .update({
          exported_at: new Date().toISOString(),
          exported_to: provider,
        })
        .eq('id', periodId)
        .eq('workspace_id', workspaceId)

      if (updateErr) {
        console.error('payroll-export: failed to update exported_at:', updateErr.message)
      }

      return jsonRes({ csv, filename })
    }

    // =========================================================
    // Action: lock-period
    // =========================================================
    if (action === 'lock-period') {
      const { periodId, userId } = body
      if (!periodId) return jsonRes({ error: 'periodId is required' }, 400)
      if (!userId) return jsonRes({ error: 'userId is required' }, 400)

      // Validate the period is still open
      const { data: existing, error: fetchErr } = await admin
        .from('payroll_periods')
        .select('id, status, name, start_date, end_date')
        .eq('id', periodId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (fetchErr) return jsonRes({ error: `Failed to fetch period: ${fetchErr.message}` }, 500)
      if (!existing) return jsonRes({ error: 'Payroll period not found' }, 404)
      if (existing.status !== 'open') {
        return jsonRes({ error: `Period is already '${existing.status}' and cannot be locked` }, 409)
      }

      const now = new Date().toISOString()

      // Lock the period
      const { error: lockErr } = await admin
        .from('payroll_periods')
        .update({
          status: 'locked',
          locked_by: userId,
          locked_at: now,
        })
        .eq('id', periodId)
        .eq('workspace_id', workspaceId)

      if (lockErr) return jsonRes({ error: `Failed to lock period: ${lockErr.message}` }, 500)

      // Insert audit event
      const { error: auditErr } = await admin
        .from('enterprise_audit_events')
        .insert({
          workspace_id: workspaceId,
          actor_id: userId,
          action: 'payroll.period_locked',
          target_type: 'payroll_period',
          target_id: periodId,
          metadata: {
            period_name: existing.name,
            start_date: existing.start_date,
            end_date: existing.end_date,
          },
        })

      if (auditErr) {
        // Non-fatal: log but do not fail the lock
        console.error('payroll-export lock-period: failed to write audit event:', auditErr.message)
      }

      return jsonRes({ success: true })
    }

    // =========================================================
    // Action: export-api (placeholder)
    // =========================================================
    if (action === 'export-api') {
      // Future: integrate with provider REST APIs using credentials
      // stored in payroll_export_configs. For now return a clear message.
      return jsonRes({
        success: false,
        message: 'Direct API push requires provider credentials configured in payroll_export_configs',
      })
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('payroll-export error:', message)
    return jsonRes({ error: message || 'Internal server error' }, 500)
  }
})
