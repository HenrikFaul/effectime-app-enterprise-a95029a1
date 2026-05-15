// Edge Function: security-admin
// Provides security and compliance operations for workspace administrators.
//
// Actions:
//   export-audit-log  – paginated audit log export with optional filters
//   list-sessions     – list workspace members with last_sign_in_at as session proxy
//   revoke-session    – sign out all sessions for a target user (global signout)
//   data-export-gdpr  – collect all personal data for a user (GDPR subject access)
//
// Auth: JWT required; caller must be workspace admin (owner or resourceAssistant role).

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
    // Action: export-audit-log
    // =========================================================
    if (action === 'export-audit-log') {
      const filters = body.filters || {}
      const limitVal = Math.min(Number(filters.limit) || 500, 1000)

      let q = admin
        .from('enterprise_audit_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limitVal)

      if (filters.action) {
        q = q.eq('action', filters.action)
      }
      if (filters.from) {
        q = q.gte('created_at', filters.from)
      }
      if (filters.to) {
        q = q.lte('created_at', filters.to)
      }

      const { data: events, error: eventsErr } = await q

      if (eventsErr) {
        return jsonRes({ error: `Failed to fetch audit log: ${eventsErr.message}` }, 500)
      }

      return jsonRes({
        audit_events: events || [],
        count: (events || []).length,
        filters: {
          action: filters.action || null,
          from: filters.from || null,
          to: filters.to || null,
          limit: limitVal,
        },
      })
    }

    // =========================================================
    // Action: list-sessions
    // =========================================================
    if (action === 'list-sessions') {
      // Fetch all active enterprise members for this workspace
      const { data: memberships, error: membErr } = await admin
        .from('enterprise_memberships')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id ( display_name )
        `)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')

      if (membErr) {
        return jsonRes({ error: `Failed to fetch memberships: ${membErr.message}` }, 500)
      }

      const members = memberships || []
      const userIds = members.map((m: any) => m.user_id)

      // Fetch auth users via admin API — batch by listing all users and filtering
      // (Supabase SDK does not support listUsers filtered by IDs directly)
      const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (authErr) {
        return jsonRes({ error: `Failed to fetch auth users: ${authErr.message}` }, 500)
      }

      const authUserMap = new Map(
        (authData?.users || [])
          .filter((u: any) => userIds.includes(u.id))
          .map((u: any) => [u.id, u]),
      )

      const users = members.map((m: any) => {
        const authUser = authUserMap.get(m.user_id) as any
        const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return {
          user_id: m.user_id,
          email: authUser?.email || null,
          display_name: profileData?.display_name || authUser?.user_metadata?.display_name || null,
          last_sign_in_at: authUser?.last_sign_in_at || null,
          role: m.role,
          app_metadata: authUser?.app_metadata || {},
        }
      })

      return jsonRes({ users })
    }

    // =========================================================
    // Action: revoke-session
    // =========================================================
    if (action === 'revoke-session') {
      const { targetUserId } = body
      if (!targetUserId) return jsonRes({ error: 'targetUserId is required' }, 400)

      // Verify the target user is a member of this workspace to prevent cross-workspace revocations
      const { data: targetMembership } = await admin
        .from('enterprise_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (!targetMembership) {
        return jsonRes({ error: 'Target user is not a member of this workspace' }, 404)
      }

      // Sign out all sessions globally for the target user
      const { error: signOutErr } = await admin.auth.admin.signOut(targetUserId, 'global')

      if (signOutErr) {
        return jsonRes({ error: `Failed to revoke sessions: ${signOutErr.message}` }, 500)
      }

      // Audit event
      const { error: auditErr } = await admin
        .from('enterprise_audit_events')
        .insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          action: 'security.session_revoked',
          target_type: 'user',
          target_id: targetUserId,
          metadata: {
            revoked_by: user.id,
            scope: 'global',
          },
        })

      if (auditErr) {
        // Non-fatal: log but do not fail the revocation
        console.error('security-admin revoke-session: failed to write audit event:', auditErr.message)
      }

      return jsonRes({ success: true })
    }

    // =========================================================
    // Action: data-export-gdpr
    // =========================================================
    if (action === 'data-export-gdpr') {
      const { targetUserId } = body
      if (!targetUserId) return jsonRes({ error: 'targetUserId is required' }, 400)

      // Verify the target user belongs to this workspace
      const { data: targetMembership } = await admin
        .from('enterprise_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (!targetMembership) {
        return jsonRes({ error: 'Target user is not a member of this workspace' }, 404)
      }

      // Collect all data in parallel
      const [
        membershipsRes,
        leaveRes,
        attendanceRes,
        wellbeingRes,
        auditRes,
      ] = await Promise.all([
        admin
          .from('enterprise_memberships')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', targetUserId),

        admin
          .from('leave_requests')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', targetUserId),

        admin
          .from('enterprise_attendance_periods')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('membership_id', targetMembership.id),

        admin
          .from('wellbeing_scores')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('membership_id', targetMembership.id),

        admin
          .from('enterprise_audit_events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('actor_id', targetUserId)
          .order('created_at', { ascending: false }),
      ])

      // Log non-fatal fetch errors but still return all available data
      if (membershipsRes.error) console.error('gdpr-export memberships error:', membershipsRes.error.message)
      if (leaveRes.error) console.error('gdpr-export leave_requests error:', leaveRes.error.message)
      if (attendanceRes.error) console.error('gdpr-export attendance error:', attendanceRes.error.message)
      if (wellbeingRes.error) console.error('gdpr-export wellbeing error:', wellbeingRes.error.message)
      if (auditRes.error) console.error('gdpr-export audit_events error:', auditRes.error.message)

      const generatedAt = new Date().toISOString()

      // Update gdpr_requests record if one exists for this user+workspace
      const { error: gdprUpdateErr } = await admin
        .from('gdpr_requests')
        .update({
          fulfilled_at: generatedAt,
          status: 'fulfilled',
        })
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
        .is('fulfilled_at', null)

      // Non-fatal: the table may not exist or no open request may be present
      if (gdprUpdateErr) {
        console.error('security-admin data-export-gdpr: failed to update gdpr_requests:', gdprUpdateErr.message)
      }

      return jsonRes({
        data: {
          memberships: membershipsRes.data || [],
          leave_requests: leaveRes.data || [],
          attendance: attendanceRes.data || [],
          wellbeing: wellbeingRes.data || [],
          audit_events: auditRes.data || [],
        },
        generated_at: generatedAt,
      })
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('security-admin error:', message)
    return jsonRes({ error: message || 'Internal server error' }, 500)
  }
})
