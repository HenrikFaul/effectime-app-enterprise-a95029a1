import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { corsHeaders } from '../_shared/cors.ts'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import {
  getBearerToken,
  hasServiceRoleCredential,
  safeAppOrigin,
} from '../_shared/request-security.ts'
import { createStructuredLogger } from '../_shared/structured-logger.ts'

const logger = createStructuredLogger({ service: 'send-transactional-email' })

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "Effectime"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to the email provider's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "notify.effectime.app"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "effectime.app"
const APP_ORIGIN = safeAppOrigin(Deno.env.get('APP_ORIGIN') || Deno.env.get('SITE_URL'))

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    logger.error('missing_configuration', {
      missing: [
        !supabaseUrl ? 'SUPABASE_URL' : null,
        !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
        !supabaseAnonKey ? 'SUPABASE_ANON_KEY' : null,
      ].filter(Boolean),
    })
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let recipientUserId: string | null = null
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  let workspaceId: string | null = null
  let invitationId: string | null = null
  let leaveRequestId: string | null = null
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email || ''
    recipientUserId = body.recipientUserId || body.recipient_user_id || null
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    workspaceId = body.workspaceId || body.workspace_id || null
    invitationId = body.invitationId || body.invitation_id || null
    leaveRequestId = body.leaveRequestId || body.leave_request_id || null
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    logger.warn('template_not_found', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS). Every user-mode
  // request is authorized against the concrete invitation/request before this
  // client is used for recipient lookup or queue writes.
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const internalServiceCall = hasServiceRoleCredential(req, supabaseServiceKey)

  if (!internalServiceCall) {
    const bearer = getBearerToken(req)
    if (!bearer) return jsonResponse({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401)

    if (!workspaceId) return jsonResponse({ error: 'workspaceId is required' }, 400)

    if (templateName === 'enterprise-invite') {
      if (!invitationId) return jsonResponse({ error: 'invitationId is required' }, 400)
      const { data: membership, error: membershipError } = await supabase
        .from('enterprise_memberships')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (membershipError) return jsonResponse({ error: 'Authorization check failed' }, 500)
      if (!membership || !['owner', 'resourceAssistant'].includes(membership.role)) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }

      const { data: invitation, error: invitationError } = await supabase
        .from('enterprise_invitations')
        .select('id, workspace_id, email, token, role, expires_at, accepted_at')
        .eq('id', invitationId)
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .maybeSingle()
      if (invitationError) return jsonResponse({ error: 'Invitation lookup failed' }, 500)
      if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
        return jsonResponse({ error: 'Invitation is missing or expired' }, 404)
      }

      const { data: workspace } = await supabase
        .from('enterprise_workspaces')
        .select('name')
        .eq('id', workspaceId)
        .maybeSingle()
      recipientEmail = invitation.email
      recipientUserId = null
      // Reissuing an invitation preserves its row id but rotates the token.
      // Include a non-secret token fingerprint so the provider sends the new
      // message instead of deduplicating it against the now-invalid old link.
      const tokenFingerprint = (await sha256Hex(invitation.token)).slice(0, 16)
      idempotencyKey = `enterprise-invite-${invitation.id}-${tokenFingerprint}`
      const invitePath = `/app?invite=${encodeURIComponent(invitation.token)}`
      templateData = {
        ...templateData,
        workspaceName: workspace?.name || templateData.workspaceName || 'Effectime Enterprise',
        inviteeEmail: invitation.email,
        roleLabel: invitation.role,
        signInUrl: `${APP_ORIGIN}/auth?redirect=${encodeURIComponent(invitePath)}`,
        expiresAt: new Date(invitation.expires_at).toLocaleDateString('hu-HU'),
      }
    } else if (templateName === 'leave-decision') {
      if (!leaveRequestId) return jsonResponse({ error: 'leaveRequestId is required' }, 400)
      const { data: membership, error: membershipError } = await supabase
        .from('enterprise_memberships')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (membershipError || !membership) return jsonResponse({ error: 'Forbidden' }, 403)

      let canApprove = membership.role === 'owner'
      if (!canApprove) {
        const { data: permission } = await supabase
          .from('enterprise_role_permissions')
          .select('access_level')
          .eq('workspace_id', workspaceId)
          .eq('role_key', membership.role)
          .eq('feature_key', 'approvals')
          .maybeSingle()
        canApprove = permission?.access_level === 'edit'
      }
      if (!canApprove) return jsonResponse({ error: 'Forbidden' }, 403)

      const { data: leaveRequest, error: leaveError } = await supabase
        .from('leave_requests')
        .select('id, user_id, status, start_date, end_date, leave_type')
        .eq('id', leaveRequestId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (leaveError) return jsonResponse({ error: 'Leave request lookup failed' }, 500)
      if (!leaveRequest || !['approved', 'rejected'].includes(leaveRequest.status)) {
        return jsonResponse({ error: 'Leave request is not decided' }, 409)
      }

      recipientEmail = ''
      recipientUserId = leaveRequest.user_id
      idempotencyKey = `leave-decision-${leaveRequest.id}-${leaveRequest.status}`
      templateData = {
        ...templateData,
        decision: leaveRequest.status,
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        leaveType: leaveRequest.leave_type,
      }
    } else {
      return jsonResponse({ error: 'Template is restricted to internal callers' }, 403)
    }
  }

  if (JSON.stringify(templateData).length > 100_000) {
    return jsonResponse({ error: 'templateData is too large' }, 413)
  }

  // If recipientUserId is provided but no email, look up email from auth.users.
  if (!recipientEmail && recipientUserId) {
    const { data: recipientData, error: recipientError } = await supabase.auth.admin.getUserById(recipientUserId)
    if (recipientError) return jsonResponse({ error: 'Recipient lookup failed' }, 500)
    if (recipientData?.user?.email) recipientEmail = recipientData.user.email
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = (template.to || recipientEmail).trim().toLowerCase()

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveRecipient)) {
    return jsonResponse({ error: 'Invalid recipient email' }, 400)
  }
  idempotencyKey = String(idempotencyKey).slice(0, 200)

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    logger.error('email_suppression_check_failed', {
      error: suppressionError,
      effectiveRecipient,
      messageId,
      templateName,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    logger.info('email_suppressed', { effectiveRecipient, messageId, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    logger.error('unsubscribe_token_lookup_failed', {
      error: tokenLookupError,
      email: normalizedEmail,
      messageId,
      templateName,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      logger.error('unsubscribe_token_create_failed', {
        error: tokenError,
        messageId,
        templateName,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      logger.error('unsubscribe_token_readback_failed', {
        error: reReadError,
        email: normalizedEmail,
        messageId,
        templateName,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    logger.warn('unsubscribe_token_state_inconsistent', {
      email: normalizedEmail,
      messageId,
      templateName,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    logger.error('transactional_email_enqueue_failed', {
      error: enqueueError,
      effectiveRecipient,
      messageId,
      templateName,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  logger.info('transactional_email_enqueued', {
    effectiveRecipient,
    messageId,
    templateName,
  })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
