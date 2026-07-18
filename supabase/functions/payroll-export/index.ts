// Edge Function: payroll-export
// Calculates open payroll periods, atomically locks immutable calculation
// snapshots, and exports only hash-verified stored snapshots.

import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import type { Database, Json } from '../../../src/integrations/supabase/types.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkWorkspaceFeature } from '../_shared/feature-entitlement.ts'
import {
  attendanceHours,
  attendanceMonthOrFilter,
  buildPayrollCsv,
  isUuid,
  isPayrollExportRpcResult,
  isPayrollLockRpcResult,
  latestMemberRateMap,
  parseBaseWorkingHours,
  PAYROLL_MEMBERSHIP_BATCH_SIZE,
  payrollCsvProvider,
  type MemberRateRow,
} from './payroll-contract.ts'
import {
  createPayrollSnapshot,
  parseStoredPayrollSnapshot,
  payrollSnapshotCanonicalPayload,
  PAYROLL_SNAPSHOT_VERSION,
  PayrollSnapshotError,
  type PayrollMemberCalculation,
  type PayrollTotals,
} from './payroll-snapshot.ts'
import {
  fetchAllPayrollRows,
  MAX_PAYROLL_ATTENDANCE_ROWS,
  MAX_PAYROLL_LEAVE_ROWS,
  MAX_PAYROLL_MEMBERS,
  MAX_PAYROLL_RATE_ROWS,
} from './pagination.ts'
import { loadProfileNamesByUserId, type ProfileLookupClient } from './profile-lookup.ts'
import { requiredPayrollFeature } from './security.ts'

type DatabaseClient = SupabaseClient<Database>
type PayrollPeriod = Pick<
  Database['public']['Tables']['payroll_periods']['Row'],
  | 'id'
  | 'workspace_id'
  | 'name'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'calculation_snapshot'
  | 'calculation_hash'
  | 'calculation_version'
>
type Membership = Pick<
  Database['public']['Tables']['enterprise_memberships']['Row'],
  'id' | 'user_id' | 'base_working_hours'
>
type AttendancePeriod = Pick<
  Database['public']['Tables']['enterprise_attendance_periods']['Row'],
  'id' | 'membership_id' | 'year' | 'month' | 'totals'
>
type LeaveRequest = Pick<
  Database['public']['Tables']['leave_requests']['Row'],
  'id' | 'user_id' | 'start_date' | 'end_date'
>

class PayrollResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PayrollResponseError'
  }
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function countWorkdays(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) count++
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return count
}

function rangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd
}

async function loadPayrollPeriod(
  admin: DatabaseClient,
  workspaceId: string,
  periodId: string,
): Promise<PayrollPeriod> {
  const { data, error } = await admin
    .from('payroll_periods')
    .select(
      'id, workspace_id, name, start_date, end_date, status, calculation_snapshot, calculation_hash, calculation_version',
    )
    .eq('id', periodId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load payroll period: ${error.message}`)
  if (!data) {
    throw new PayrollResponseError('Payroll period not found', 404, 'PAYROLL_PERIOD_NOT_FOUND')
  }
  return data
}

function snapshotResponseError(error: PayrollSnapshotError): PayrollResponseError {
  const message = error.code === 'PAYROLL_SNAPSHOT_MISSING'
    ? 'Locked payroll period has no calculation snapshot and cannot be recalculated'
    : 'Stored payroll calculation snapshot failed integrity validation'
  return new PayrollResponseError(message, 409, error.code)
}

async function storedCalculation(period: PayrollPeriod): Promise<{
  members: PayrollMemberCalculation[]
  totals: PayrollTotals
}> {
  try {
    const snapshot = await parseStoredPayrollSnapshot(period)
    return { members: snapshot.members, totals: snapshot.totals }
  } catch (error) {
    if (error instanceof PayrollSnapshotError) throw snapshotResponseError(error)
    throw error
  }
}

async function calculateOpenPeriod(
  admin: DatabaseClient,
  period: PayrollPeriod,
) {
  if (period.status !== 'open') {
    throw new PayrollResponseError(
      'Only an open payroll period can be calculated from live data',
      409,
      'PAYROLL_PERIOD_NOT_OPEN',
    )
  }

  const members = await fetchAllPayrollRows<Membership>(
    'payroll memberships',
    (from, to) => admin
      .from('enterprise_memberships')
      .select('id, user_id, base_working_hours')
      .eq('workspace_id', period.workspace_id)
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: MAX_PAYROLL_MEMBERS },
  )
  const membershipIds = members.map((member) => member.id)
  const memberUserIds = members.map((member) => member.user_id)
  const profileNameByUserId = await loadProfileNamesByUserId(
    admin as unknown as ProfileLookupClient,
    memberUserIds,
  )

  const attendance: AttendancePeriod[] = []
  const monthFilter = attendanceMonthOrFilter(period.start_date, period.end_date)
  for (let offset = 0; offset < membershipIds.length; offset += PAYROLL_MEMBERSHIP_BATCH_SIZE) {
    const membershipBatch = membershipIds.slice(offset, offset + PAYROLL_MEMBERSHIP_BATCH_SIZE)
    const batch = await fetchAllPayrollRows<AttendancePeriod>(
      'payroll attendance rows',
      (from, to) => admin
        .from('enterprise_attendance_periods')
        .select('id, membership_id, year, month, totals')
        .eq('workspace_id', period.workspace_id)
        .in('membership_id', membershipBatch)
        .or(monthFilter)
        .order('membership_id', { ascending: true })
        .order('year', { ascending: true })
        .order('month', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      { maxRows: MAX_PAYROLL_ATTENDANCE_ROWS - attendance.length },
    )
    attendance.push(...batch)
  }

  const leaves = await fetchAllPayrollRows<LeaveRequest>(
    'approved payroll leave rows',
    (from, to) => admin
      .from('leave_requests')
      .select('id, user_id, start_date, end_date')
      .eq('workspace_id', period.workspace_id)
      .eq('status', 'approved')
      .lte('start_date', period.end_date)
      .gte('end_date', period.start_date)
      .order('user_id', { ascending: true })
      .order('start_date', { ascending: true })
      .order('end_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: MAX_PAYROLL_LEAVE_ROWS },
  )

  let rateMap = new Map<string, { costRate: number; currency: string }>()
  if (membershipIds.length > 0) {
    const rateRows: MemberRateRow[] = []
    for (let offset = 0; offset < membershipIds.length; offset += PAYROLL_MEMBERSHIP_BATCH_SIZE) {
      const membershipBatch = membershipIds.slice(offset, offset + PAYROLL_MEMBERSHIP_BATCH_SIZE)
      const batch = await fetchAllPayrollRows<MemberRateRow>(
        'payroll rate rows',
        (from, to) => admin
          .from('enterprise_member_rates')
          .select('id, membership_id, cost_rate, currency, effective_from')
          .eq('workspace_id', period.workspace_id)
          .in('membership_id', membershipBatch)
          .order('membership_id', { ascending: true })
          .order('effective_from', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
        { maxRows: MAX_PAYROLL_RATE_ROWS - rateRows.length },
      )
      rateRows.push(...batch)
    }
    rateMap = latestMemberRateMap(rateRows)
  }

  const attendanceHoursByMembership = new Map<string, number>()
  for (const row of attendance) {
    const accumulated = (attendanceHoursByMembership.get(row.membership_id) ?? 0) +
      attendanceHours(row.totals)
    if (!Number.isFinite(accumulated) || accumulated < 0) {
      throw new Error('Attendance hours exceeded the safe numeric range')
    }
    attendanceHoursByMembership.set(row.membership_id, accumulated)
  }
  const leavesByUser = new Map<string, LeaveRequest[]>()
  for (const leave of leaves) {
    const memberLeaves = leavesByUser.get(leave.user_id) ?? []
    memberLeaves.push(leave)
    leavesByUser.set(leave.user_id, memberLeaves)
  }

  const payrollMembers: PayrollMemberCalculation[] = []
  const missingProfiles: Array<{ membershipId: string; userId: string }> = []
  const workdays = countWorkdays(period.start_date, period.end_date)

  for (const member of members) {
    const baseHoursPerDay = parseBaseWorkingHours(member.base_working_hours)
    const memberRate = rateMap.get(member.id)
    const costRate = memberRate?.costRate ?? 0
    const totalHours = attendanceHoursByMembership.get(member.id) ?? 0
    const expectedHours = baseHoursPerDay * workdays
    if (!Number.isFinite(expectedHours) || expectedHours < 0) {
      throw new Error('Expected payroll hours exceeded the safe numeric range')
    }
    const regularHours = Math.min(totalHours, expectedHours)
    const overtimeHours = Math.max(0, totalHours - expectedHours)

    let leaveDays = 0
    for (const leave of leavesByUser.get(member.user_id) ?? []) {
      if (!rangesOverlap(
        leave.start_date,
        leave.end_date,
        period.start_date,
        period.end_date,
      )) continue
      const overlapStart = leave.start_date > period.start_date
        ? leave.start_date
        : period.start_date
      const overlapEnd = leave.end_date < period.end_date
        ? leave.end_date
        : period.end_date
      leaveDays += countWorkdays(overlapStart, overlapEnd)
    }

    const grossEstimate = totalHours * costRate
    if (!Number.isFinite(grossEstimate) || grossEstimate < 0) {
      throw new Error('Payroll gross estimate exceeded the safe numeric range')
    }
    const profileDisplayName = profileNameByUserId.get(member.user_id)
    const displayName = profileDisplayName?.trim() || 'Unknown'
    if (!profileDisplayName?.trim()) {
      missingProfiles.push({ membershipId: member.id, userId: member.user_id })
    }
    payrollMembers.push({
      membership_id: member.id,
      display_name: displayName,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      leave_days: leaveDays,
      gross_estimate: Math.round(grossEstimate * 100) / 100,
      currency: memberRate?.currency ?? 'EUR',
    })
  }

  payrollMembers.sort((left, right) =>
    left.membership_id < right.membership_id
      ? -1
      : left.membership_id > right.membership_id
      ? 1
      : 0
  )
  const totals: PayrollTotals = {
    total_hours: Math.round(payrollMembers.reduce(
      (sum, member) => sum + member.regular_hours + member.overtime_hours,
      0,
    ) * 100) / 100,
    total_overtime: Math.round(payrollMembers.reduce(
      (sum, member) => sum + member.overtime_hours,
      0,
    ) * 100) / 100,
    total_gross: Math.round(payrollMembers.reduce(
      (sum, member) => sum + member.gross_estimate,
      0,
    ) * 100) / 100,
    member_count: payrollMembers.length,
  }
  return { members: payrollMembers, totals, period, missingProfiles }
}

async function calculatePeriod(
  admin: DatabaseClient,
  workspaceId: string,
  periodId: string,
) {
  const period = await loadPayrollPeriod(admin, workspaceId, periodId)
  if (period.status === 'locked' || period.status === 'exported') {
    const stored = await storedCalculation(period)
    return { ...stored, period, missingProfiles: [] }
  }
  return calculateOpenPeriod(admin, period)
}

async function auditMissingProfiles(
  admin: DatabaseClient,
  workspaceId: string,
  periodId: string,
  actorId: string,
  missingProfiles: Array<{ membershipId: string; userId: string }>,
): Promise<void> {
  if (missingProfiles.length === 0) return
  const rows: Database['public']['Tables']['enterprise_audit_events']['Insert'][] = missingProfiles.map(
    ({ membershipId, userId }) => ({
      workspace_id: workspaceId,
      actor_id: actorId,
      action: 'payroll.export.member_profile_missing',
      target_type: 'enterprise_membership',
      target_id: membershipId,
      affected_user_id: userId,
      metadata: { membership_id: membershipId, user_id: userId, period_id: periodId },
    }),
  )
  try {
    const { error } = await admin.from('enterprise_audit_events').insert(rows)
    if (error) console.warn('[payroll-export] missing-profile audit insert failed:', error.message)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.warn('[payroll-export] missing-profile audit insert threw:', message)
  }
}

function rpcFailure(
  operation: string,
  error: { code?: string; message?: string },
): PayrollResponseError {
  switch (error.code) {
    case '42501':
      return new PayrollResponseError('Forbidden payroll operation', 403, 'PAYROLL_FORBIDDEN')
    case 'P0002':
      return new PayrollResponseError('Payroll period not found', 404, 'PAYROLL_PERIOD_NOT_FOUND')
    case '55000':
      return new PayrollResponseError(
        `Payroll period cannot be ${operation} in its current state`,
        409,
        'PAYROLL_PERIOD_STATE_CONFLICT',
      )
    case '22023':
      return new PayrollResponseError('Invalid payroll operation payload', 400, 'PAYROLL_INVALID_PAYLOAD')
    default:
      return new PayrollResponseError(`Failed to ${operation} payroll period`, 500, 'INTERNAL_ERROR')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonRes({ error: 'Unauthorized' }, 401)

    const userClient = createClient<Database>(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonRes({ error: 'Unauthorized' }, 401)

    const admin = createClient<Database>(supabaseUrl, serviceKey)
    const parsedBody: unknown = await req.json().catch(() => null)
    if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
      return jsonRes({ error: 'A JSON object body is required' }, 400)
    }
    const body = parsedBody as Record<string, unknown>
    const { action, workspaceId } = body
    if (!isUuid(workspaceId)) return jsonRes({ error: 'A valid workspaceId is required' }, 400)

    const { data: adminMembership, error: membershipError } = await admin
      .from('enterprise_memberships')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'resourceAssistant'])
      .maybeSingle()
    if (membershipError) {
      console.error(
        `[payroll-export] membership lookup failed workspace=${workspaceId} user=${user.id}: ${membershipError.message}`,
      )
      return jsonRes({ error: 'Workspace authorization is temporarily unavailable' }, 503)
    }
    if (!adminMembership) return jsonRes({ error: 'Forbidden: workspace admin role required' }, 403)

    const requiredFeature = requiredPayrollFeature(action)
    if (!requiredFeature) return jsonRes({ error: 'Unknown payroll action' }, 400)
    const entitlement = await checkWorkspaceFeature(admin, workspaceId, requiredFeature)
    if (!entitlement.enabled) {
      if (entitlement.reason === 'lookup_error') {
        console.error(
          `[payroll-export] entitlement lookup failed workspace=${workspaceId} feature=${requiredFeature} step=${entitlement.step}: ${entitlement.error}`,
        )
        return jsonRes({ error: 'Feature entitlement is temporarily unavailable' }, 503)
      }
      return jsonRes({ error: `Feature '${requiredFeature}' is not enabled for this workspace` }, 403)
    }

    if (action === 'calculate-period') {
      const { periodId } = body
      if (!isUuid(periodId)) return jsonRes({ error: 'A valid periodId is required' }, 400)
      const calculation = await calculatePeriod(admin, workspaceId, periodId)
      await auditMissingProfiles(
        admin,
        workspaceId,
        periodId,
        user.id,
        calculation.missingProfiles,
      )
      return jsonRes({ members: calculation.members, totals: calculation.totals })
    }

    if (action === 'lock-period') {
      const { periodId } = body
      if (!isUuid(periodId)) return jsonRes({ error: 'A valid periodId is required' }, 400)
      const period = await loadPayrollPeriod(admin, workspaceId, periodId)
      if (period.status !== 'open') {
        return jsonRes({
          error: 'Payroll period is no longer open and cannot be locked',
          code: 'PAYROLL_PERIOD_STATE_CONFLICT',
        }, 409)
      }
      const calculation = await calculateOpenPeriod(admin, period)
      const snapshot = await createPayrollSnapshot({
        id: period.id,
        workspace_id: period.workspace_id,
        name: period.name,
        start_date: period.start_date,
        end_date: period.end_date,
      }, calculation.members, calculation.totals)

      const { data, error } = await admin.rpc('lock_payroll_period_snapshot', {
        _actor_id: user.id,
        _canonical_payload: payrollSnapshotCanonicalPayload(snapshot),
        _period_id: periodId,
        _snapshot: snapshot as unknown as Json,
        _snapshot_hash: snapshot.hash,
        _snapshot_version: PAYROLL_SNAPSHOT_VERSION,
        _workspace_id: workspaceId,
      })
      if (error) {
        console.error('[payroll-export] atomic lock RPC failed:', error.message)
        throw rpcFailure('locked', error)
      }
      if (!isPayrollLockRpcResult(data, {
        periodId,
        hash: snapshot.hash,
        version: PAYROLL_SNAPSHOT_VERSION,
      })) {
        console.error('[payroll-export] atomic lock RPC returned an invalid contract')
        throw new PayrollResponseError(
          'Payroll lock confirmation failed validation',
          500,
          'PAYROLL_RPC_INVALID_RESPONSE',
        )
      }
      await auditMissingProfiles(
        admin,
        workspaceId,
        periodId,
        user.id,
        calculation.missingProfiles,
      )
      return jsonRes({
        success: true,
        snapshot_hash: snapshot.hash,
        snapshot_version: PAYROLL_SNAPSHOT_VERSION,
      })
    }

    if (action === 'export-csv') {
      const { periodId } = body
      if (!isUuid(periodId)) return jsonRes({ error: 'A valid periodId is required' }, 400)
      const provider = payrollCsvProvider(body.provider ?? 'generic')
      if (!provider) {
        return jsonRes({
          error: 'Unsupported payroll CSV provider',
          code: 'UNSUPPORTED_PAYROLL_PROVIDER',
        }, 400)
      }
      const period = await loadPayrollPeriod(admin, workspaceId, periodId)
      if (period.status !== 'locked' && period.status !== 'exported') {
        return jsonRes({
          error: 'Payroll period must be locked before export',
          code: 'PAYROLL_PERIOD_NOT_LOCKED',
        }, 409)
      }
      const calculation = await storedCalculation(period)
      const csv = buildPayrollCsv(calculation.members, period, provider)
      const safeProvider = provider.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const safePeriodName = period.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const filename = `payroll_${safePeriodName}_${safeProvider}.csv`

      const { data, error } = await admin.rpc('mark_payroll_period_exported', {
        _actor_id: user.id,
        _period_id: periodId,
        _provider: provider,
        _workspace_id: workspaceId,
      })
      if (error) {
        console.error('[payroll-export] atomic export RPC failed:', error.message)
        throw rpcFailure('exported', error)
      }
      if (!isPayrollExportRpcResult(data, {
        periodId,
        provider,
        hash: period.calculation_hash!,
        version: period.calculation_version!,
      })) {
        console.error('[payroll-export] atomic export RPC returned an invalid contract')
        throw new PayrollResponseError(
          'Payroll export confirmation failed validation',
          500,
          'PAYROLL_RPC_INVALID_RESPONSE',
        )
      }
      return jsonRes({ csv, filename })
    }

    if (action === 'export-api') {
      return jsonRes({
        error: 'Direct payroll provider API export is not implemented',
        code: 'PAYROLL_PROVIDER_API_NOT_IMPLEMENTED',
      }, 501)
    }
    return jsonRes({ error: 'Unknown payroll action' }, 400)
  } catch (error: unknown) {
    if (error instanceof PayrollResponseError) {
      return jsonRes({ error: error.message, code: error.code }, error.status)
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('payroll-export error:', message)
    return jsonRes({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)
  }
})
