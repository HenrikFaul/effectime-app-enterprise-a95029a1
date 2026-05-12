// Edge Function: superadmin-hub
// ─────────────────────────────────────────────────────────────────────────────
// Central control plane for platform superadmins (user_roles.role = 'admin').
//
// Actions:
//   platform-overview    – aggregated platform-wide stats
//   list-workspaces      – all enterprise workspaces with member counts
//   workspace-action     – archive / unarchive / recovery / delete a workspace
//   list-feature-flags   – all rows from platform_feature_flags
//   toggle-feature-flag  – enable / disable a single feature flag
//   list-cron-jobs       – pg_cron job list (soft-fail if inaccessible)
//   trigger-edge-function – invoke an allowlisted edge function
//   locale-registry      – locales list with workspace counts + flag status
//   email-queue-status   – counts and recent rows from email_queue
//   platform-version     – runtime / environment metadata
//
// Auth: JWT required; caller must have role = 'admin' in user_roles.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import { corsHeaders } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Count rows that are older than `days` days ago in the given date string column. */
function countRecentFromArray(rows: any[], dateColumn: string, days: number): number {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return rows.filter((r) => r[dateColumn] && new Date(r[dateColumn]) >= cutoff).length
}

// ---------------------------------------------------------------------------
// Locale metadata (static — extend as new locales ship)
// ---------------------------------------------------------------------------

const KNOWN_LOCALES: { code: string; label_native: string; label_english: string; flag: string }[] = [
  { code: 'en', label_native: 'English', label_english: 'English', flag: '🇬🇧' },
  { code: 'hu', label_native: 'Magyar', label_english: 'Hungarian', flag: '🇭🇺' },
  { code: 'cs', label_native: 'Čeština', label_english: 'Czech', flag: '🇨🇿' },
  { code: 'sk', label_native: 'Slovenčina', label_english: 'Slovak', flag: '🇸🇰' },
  { code: 'pl', label_native: 'Polski', label_english: 'Polish', flag: '🇵🇱' },
]

// ---------------------------------------------------------------------------
// Edge-function invocation allowlist
// ---------------------------------------------------------------------------

const ALLOWED_EDGE_FUNCTIONS: string[] = [
  'sync-holidays',
  'ms365-sync',
  'send-scheduled-reports',
  'cleanup-temp-users',
  'cleanup-demo-workspace',
]

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // ── 1. JWT authentication ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonRes({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonRes({ error: 'Unauthorized' }, 401)

    // ── 2. Platform admin check ──────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleRow) return jsonRes({ error: 'Forbidden: superadmin role required' }, 403)

    // ── 3. Parse body ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (!action) return jsonRes({ error: 'action is required' }, 400)

    // =========================================================================
    // Action: platform-overview
    // =========================================================================
    if (action === 'platform-overview') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // ── Workspace counts ──────────────────────────────────────────────────
      const [
        totalWsRes,
        activeWsRes,
        archivedWsRes,
        recoveryWsRes,
        newWsRes,
      ] = await Promise.all([
        admin.from('enterprise_workspaces').select('id', { count: 'exact', head: true }),
        admin.from('enterprise_workspaces').select('id', { count: 'exact', head: true }).eq('is_archived', false),
        admin.from('enterprise_workspaces').select('id', { count: 'exact', head: true }).eq('is_archived', true),
        admin.from('enterprise_workspaces').select('id', { count: 'exact', head: true }).eq('recovery_mode', true),
        admin.from('enterprise_workspaces').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      ])

      // ── Membership count ──────────────────────────────────────────────────
      const { count: totalMemberships } = await admin
        .from('enterprise_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

      // ── Profiles ──────────────────────────────────────────────────────────
      const { count: totalProfiles } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })

      // ── Auth users ───────────────────────────────────────────────────────
      let totalAuthUsers = 0
      let newAuthUsers30d  = 0
      try {
        const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 10000 })
        const allAuthUsers = (authData?.users || []).filter((u: any) => !u.deleted_at)
        totalAuthUsers = allAuthUsers.length
        newAuthUsers30d = countRecentFromArray(allAuthUsers, 'created_at', 30)
      } catch (e: unknown) {
        console.error('platform-overview: auth.admin.listUsers failed:', (e as Error).message)
      }

      // ── Feature flags ─────────────────────────────────────────────────────
      let flagsEnabled = 0
      try {
        const { count } = await admin
          .from('platform_feature_flags')
          .select('id', { count: 'exact', head: true })
          .eq('enabled', true)
        flagsEnabled = count ?? 0
      } catch (e: unknown) {
        console.error('platform-overview: feature flags count failed:', (e as Error).message)
      }

      // ── Email queue ───────────────────────────────────────────────────────
      let emailQueue = { pending: 0, sent: 0, failed: 0 }
      try {
        const { data: queueRows, error: queueErr } = await admin
          .from('email_queue')
          .select('status')
        if (!queueErr && queueRows) {
          for (const row of queueRows as any[]) {
            const s = row.status as string
            if (s === 'pending') emailQueue.pending++
            else if (s === 'sent') emailQueue.sent++
            else if (s === 'failed') emailQueue.failed++
          }
        }
      } catch (e: unknown) {
        console.error('platform-overview: email_queue count failed (table may not exist):', (e as Error).message)
      }

      return jsonRes({
        workspaces: {
          total:         totalWsRes.count ?? 0,
          active:        activeWsRes.count ?? 0,
          archived:      archivedWsRes.count ?? 0,
          recovery_mode: recoveryWsRes.count ?? 0,
          new_30d:       newWsRes.count ?? 0,
        },
        users: {
          total_auth:     totalAuthUsers,
          total_profiles: totalProfiles ?? 0,
          total_members:  totalMemberships ?? 0,
          new_30d:        newAuthUsers30d,
        },
        features: {
          flags_enabled: flagsEnabled,
        },
        email_queue: emailQueue,
      })
    }

    // =========================================================================
    // Action: list-workspaces
    // =========================================================================
    if (action === 'list-workspaces') {
      // Fetch workspaces
      const { data: workspaces, error: wsErr } = await admin
        .from('enterprise_workspaces')
        .select(`
          id,
          name,
          description,
          timezone,
          locale,
          created_at,
          is_archived,
          recovery_mode,
          recovery_mode_reason,
          created_by
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (wsErr) return jsonRes({ error: `Failed to fetch workspaces: ${wsErr.message}` }, 500)

      const wsRows = workspaces || []
      const wsIds  = wsRows.map((w: any) => w.id)

      // Member counts per workspace (active only)
      const { data: memberRows } = await admin
        .from('enterprise_memberships')
        .select('workspace_id')
        .in('workspace_id', wsIds)
        .eq('status', 'active')

      const memberCountMap = new Map<string, number>()
      for (const m of memberRows || []) {
        const wid = (m as any).workspace_id
        memberCountMap.set(wid, (memberCountMap.get(wid) ?? 0) + 1)
      }

      // Collect unique owner user IDs to look up emails
      const ownerIds = [...new Set(wsRows.map((w: any) => w.created_by).filter(Boolean))] as string[]
      const ownerEmailMap = new Map<string, string>()

      if (ownerIds.length > 0) {
        try {
          // Attempt to resolve emails from profiles first (display_name only there),
          // then fall back to auth.admin to get email addresses.
          const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 10000 })
          for (const u of authData?.users || []) {
            if (ownerIds.includes(u.id)) {
              ownerEmailMap.set(u.id, (u as any).email || '')
            }
          }
        } catch (e: unknown) {
          console.error('list-workspaces: could not resolve owner emails:', (e as Error).message)
        }
      }

      const result = wsRows.map((w: any) => ({
        workspace: {
          id:                   w.id,
          name:                 w.name,
          description:          w.description,
          timezone:             w.timezone,
          locale:               w.locale,
          created_at:           w.created_at,
          is_archived:          w.is_archived,
          recovery_mode:        w.recovery_mode,
          recovery_mode_reason: w.recovery_mode_reason,
        },
        member_count: memberCountMap.get(w.id) ?? 0,
        created_by:   w.created_by,
        owner_email:  ownerEmailMap.get(w.created_by) ?? null,
      }))

      return jsonRes({ workspaces: result, total: result.length })
    }

    // =========================================================================
    // Action: workspace-action
    // =========================================================================
    if (action === 'workspace-action') {
      const { workspace_id, action_type, reason } = body

      if (!workspace_id) return jsonRes({ error: 'workspace_id is required' }, 400)
      if (!action_type)  return jsonRes({ error: 'action_type is required' }, 400)

      const validActionTypes = ['archive', 'unarchive', 'enable_recovery', 'disable_recovery', 'delete']
      if (!validActionTypes.includes(action_type)) {
        return jsonRes({ error: `Invalid action_type. Must be one of: ${validActionTypes.join(', ')}` }, 400)
      }

      let updatePayload: Record<string, unknown> = {}

      if (action_type === 'archive') {
        updatePayload = { is_archived: true }
      } else if (action_type === 'unarchive') {
        updatePayload = { is_archived: false }
      } else if (action_type === 'enable_recovery') {
        updatePayload = {
          recovery_mode:              true,
          recovery_mode_reason:       reason ?? null,
          recovery_mode_activated_at: new Date().toISOString(),
          recovery_mode_activated_by: user.id,
        }
      } else if (action_type === 'disable_recovery') {
        updatePayload = {
          recovery_mode:        false,
          recovery_mode_reason: null,
        }
      } else if (action_type === 'delete') {
        // Hard delete — cascades handle membership / audit cleanup at DB level
        const { error: delErr } = await admin
          .from('enterprise_workspaces')
          .delete()
          .eq('id', workspace_id)

        if (delErr) return jsonRes({ error: `Failed to delete workspace: ${delErr.message}` }, 500)

        // Audit
        await admin.from('enterprise_audit_events').insert({
          workspace_id: workspace_id,
          actor_id: user.id,
          action: 'superadmin.workspace.delete',
          metadata: { reason: reason ?? null },
        }).then(({ error: auditErr }) => {
          if (auditErr) console.error('workspace-action delete audit failed:', auditErr.message)
        })

        return jsonRes({ success: true, action_type })
      }

      // Apply update for non-delete action types
      const { error: updateErr } = await admin
        .from('enterprise_workspaces')
        .update(updatePayload)
        .eq('id', workspace_id)

      if (updateErr) return jsonRes({ error: `Failed to ${action_type}: ${updateErr.message}` }, 500)

      // Audit
      const { error: auditErr } = await admin.from('enterprise_audit_events').insert({
        workspace_id: workspace_id,
        actor_id:     user.id,
        action:       `superadmin.workspace.${action_type}`,
        metadata:     { reason: reason ?? null },
      })

      if (auditErr) {
        console.error(`workspace-action ${action_type} audit failed:`, auditErr.message)
      }

      return jsonRes({ success: true, action_type })
    }

    // =========================================================================
    // Action: list-feature-flags
    // =========================================================================
    if (action === 'list-feature-flags') {
      const { data: flags, error: flagsErr } = await admin
        .from('platform_feature_flags')
        .select('id, key, description, enabled, category, notes, updated_by, updated_at')
        .order('category', { ascending: true })
        .order('key',      { ascending: true })

      if (flagsErr) return jsonRes({ error: `Failed to fetch feature flags: ${flagsErr.message}` }, 500)

      return jsonRes({ flags: flags || [], total: (flags || []).length })
    }

    // =========================================================================
    // Action: toggle-feature-flag
    // =========================================================================
    if (action === 'toggle-feature-flag') {
      const { flag_id, enabled } = body

      if (!flag_id)           return jsonRes({ error: 'flag_id is required' }, 400)
      if (typeof enabled !== 'boolean') return jsonRes({ error: 'enabled must be a boolean' }, 400)

      const { data: updated, error: updateErr } = await admin
        .from('platform_feature_flags')
        .update({
          enabled,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flag_id)
        .select('id, key, description, enabled, category, notes, updated_by, updated_at')
        .maybeSingle()

      if (updateErr) return jsonRes({ error: `Failed to toggle flag: ${updateErr.message}` }, 500)
      if (!updated)  return jsonRes({ error: 'Feature flag not found' }, 404)

      return jsonRes({ flag: updated })
    }

    // =========================================================================
    // Action: list-cron-jobs
    // =========================================================================
    if (action === 'list-cron-jobs') {
      try {
        const { data: jobs, error: cronErr } = await admin
          .from('cron.job')   // pg_cron exposes this via the cron schema
          .select('jobid, jobname, schedule, command, nodename, nodeport, database, username, active')
          .order('jobname', { ascending: true })

        if (cronErr) {
          console.error('list-cron-jobs: query failed:', cronErr.message)
          return jsonRes({ jobs: [], error: 'pg_cron not accessible' })
        }

        return jsonRes({ jobs: jobs || [], total: (jobs || []).length })
      } catch (e: unknown) {
        console.error('list-cron-jobs: exception:', (e as Error).message)
        return jsonRes({ jobs: [], error: 'pg_cron not accessible' })
      }
    }

    // =========================================================================
    // Action: trigger-edge-function
    // =========================================================================
    if (action === 'trigger-edge-function') {
      const { function_name, payload } = body

      if (!function_name) return jsonRes({ error: 'function_name is required' }, 400)

      if (!ALLOWED_EDGE_FUNCTIONS.includes(function_name)) {
        return jsonRes(
          {
            error: `Function '${function_name}' is not in the allowed list.`,
            allowed: ALLOWED_EDGE_FUNCTIONS,
          },
          400,
        )
      }

      let invokeResult: { data: unknown; error: unknown }
      try {
        invokeResult = await admin.functions.invoke(function_name, {
          body: payload || {},
        })
      } catch (e: unknown) {
        const msg = (e as Error).message
        console.error(`trigger-edge-function: invoke '${function_name}' threw:`, msg)

        // Audit even on invocation failure
        await admin.from('enterprise_audit_events').insert({
          workspace_id: null,
          actor_id:     user.id,
          action:       'superadmin.job.triggered',
          metadata:     { function_name, success: false, error: msg },
        }).then(({ error: auditErr }) => {
          if (auditErr) console.error('trigger-edge-function audit (throw path) failed:', auditErr.message)
        })

        return jsonRes({ success: false, error: msg })
      }

      const { data: invokeData, error: invokeErr } = invokeResult

      // Audit
      await admin.from('enterprise_audit_events').insert({
        workspace_id: null,
        actor_id:     user.id,
        action:       'superadmin.job.triggered',
        metadata:     {
          function_name,
          success: !invokeErr,
          error:   invokeErr ? String(invokeErr) : null,
        },
      }).then(({ error: auditErr }) => {
        if (auditErr) console.error('trigger-edge-function audit failed:', auditErr.message)
      })

      if (invokeErr) {
        return jsonRes({ success: false, error: String(invokeErr) })
      }

      return jsonRes({ success: true, data: invokeData })
    }

    // =========================================================================
    // Action: locale-registry
    // =========================================================================
    if (action === 'locale-registry') {
      // Count workspaces per locale
      const { data: wsLocaleRows } = await admin
        .from('enterprise_workspaces')
        .select('locale')
        .eq('is_archived', false)

      const localeCountMap = new Map<string, number>()
      for (const row of wsLocaleRows || []) {
        const code = (row as any).locale as string | null
        if (code) localeCountMap.set(code, (localeCountMap.get(code) ?? 0) + 1)
      }

      // Feature flag overrides for locales (key pattern: 'locale.<code>')
      const { data: flagRows } = await admin
        .from('platform_feature_flags')
        .select('key, enabled')
        .like('key', 'locale.%')

      const localeFlagMap = new Map<string, boolean>()
      for (const flag of flagRows || []) {
        const parts = ((flag as any).key as string).split('.')
        if (parts.length === 2) localeFlagMap.set(parts[1], (flag as any).enabled as boolean)
      }

      const locales = KNOWN_LOCALES.map(({ code, label_native, label_english, flag }) => ({
        code,
        label_native,
        label_english,
        flag,
        workspace_count: localeCountMap.get(code) ?? 0,
        // If a locale flag exists, use it; otherwise default to enabled
        is_enabled: localeFlagMap.has(code) ? localeFlagMap.get(code)! : true,
      }))

      return jsonRes({ locales })
    }

    // =========================================================================
    // Action: email-queue-status
    // =========================================================================
    if (action === 'email-queue-status') {
      try {
        const { data: rows, error: queueErr } = await admin
          .from('email_queue')
          .select('id, recipient, subject, status, created_at, sent_at, error')
          .order('created_at', { ascending: false })

        if (queueErr) {
          console.error('email-queue-status: query failed (table may not exist):', queueErr.message)
          return jsonRes({ counts: { pending: 0, sent: 0, failed: 0 }, recent: [] })
        }

        const allRows = rows || []
        const counts = { pending: 0, sent: 0, failed: 0 }
        for (const row of allRows as any[]) {
          const s = row.status as string
          if (s === 'pending') counts.pending++
          else if (s === 'sent') counts.sent++
          else if (s === 'failed') counts.failed++
        }

        const recent = allRows.slice(0, 10).map((row: any) => ({
          id:         row.id,
          recipient:  row.recipient,
          subject:    row.subject,
          status:     row.status,
          created_at: row.created_at,
          sent_at:    row.sent_at,
          error:      row.error,
        }))

        return jsonRes({ counts, recent })
      } catch (e: unknown) {
        console.error('email-queue-status: exception (table may not exist):', (e as Error).message)
        return jsonRes({ counts: { pending: 0, sent: 0, failed: 0 }, recent: [] })
      }
    }

    // =========================================================================
    // Action: platform-version
    // =========================================================================
    if (action === 'platform-version') {
      const supabaseProjectUrl = Deno.env.get('SUPABASE_URL') ?? null

      // Best-effort: count known edge functions from the static list we ship
      const knownFunctions = [
        'admin',
        'auth-email-hook',
        'cleanup-demo-workspace',
        'cleanup-temp-users',
        'create-instant-enterprise-member',
        'data-migration',
        'delete-account',
        'handle-email-suppression',
        'handle-email-unsubscribe',
        'help-regenerator',
        'import-entity-data',
        'jira-devops-proxy',
        'join-event',
        'leave-ical',
        'ms365-sync',
        'payroll-export',
        'preview-transactional-email',
        'process-email-queue',
        'run-report',
        'security-admin',
        'seed-demo-workspace',
        'send-scheduled-reports',
        'send-transactional-email',
        'superadmin-hub',
        'sync-holidays',
      ]

      return jsonRes({
        timestamp:      new Date().toISOString(),
        supabase_url:   supabaseProjectUrl,
        function_count: knownFunctions.length,
        functions:      knownFunctions,
        runtime:        'Deno (Supabase Edge Runtime)',
        note:           'CHANGELOG not available from edge function — read from versioning files',
      })
    }

    // ── Unknown action ────────────────────────────────────────────────────────
    return jsonRes(
      {
        error: `Unknown action: ${action}`,
        available_actions: [
          'platform-overview',
          'list-workspaces',
          'workspace-action',
          'list-feature-flags',
          'toggle-feature-flag',
          'list-cron-jobs',
          'trigger-edge-function',
          'locale-registry',
          'email-queue-status',
          'platform-version',
        ],
      },
      400,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('superadmin-hub: unhandled error:', message)
    return jsonRes({ error: 'Internal server error' }, 500)
  }
})
