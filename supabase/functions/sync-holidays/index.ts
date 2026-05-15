// Edge function: sync Hungarian public holidays from szunetnapok.hu API
// into a workspace's enterprise_holidays table.
//
// POST { workspace_id: string, year?: number }
// Auth: requires JWT of an authenticated workspace owner/resourceAssistant.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SzunetNapokEntry {
  datum: string // YYYY-MM-DD
  nev: string
  munkanap?: number | string // 0 = munkaszüneti, 1 = áthelyezett munkanap
  tipus?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('SZUNETNAPOK_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SZUNETNAPOK_API_KEY missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const isCron = body?.cron === true
    const explicitWorkspaceId = body?.workspace_id as string | undefined
    const year = (body?.year as number | undefined) ?? new Date().getFullYear()

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // === CRON MODE ===
    // Triggered by pg_cron with a shared secret header. Iterates over all
    // workspaces with holidays_auto_sync = true and syncs them.
    if (isCron) {
      const cronToken = Deno.env.get('CRON_TRIGGER_TOKEN') || serviceKey
      const provided = req.headers.get('x-cron-token') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '')
      if (!provided || provided !== cronToken) {
        return new Response(JSON.stringify({ error: 'Forbidden (invalid cron token)' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: workspaces } = await supabaseAdmin
        .from('enterprise_workspaces')
        .select('id, name')
        .eq('holidays_auto_sync', true)

      const results: Array<{ workspace_id: string; inserted: number; skipped: number; error?: string }> = []
      for (const ws of (workspaces || [])) {
        try {
          const r = await syncForWorkspace(supabaseAdmin, ws.id, year, apiKey)
          results.push({ workspace_id: ws.id, inserted: r.inserted, skipped: r.skipped })
        } catch (e) {
          results.push({ workspace_id: ws.id, inserted: 0, skipped: 0, error: e instanceof Error ? e.message : 'unknown' })
        }
      }
      return new Response(JSON.stringify({ ok: true, cron: true, year, count: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === USER MODE ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.slice(7)
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    if (!explicitWorkspaceId) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const workspaceId = explicitWorkspaceId

    // Authorization: must be owner/resourceAssistant
    const { data: roleCheck, error: roleErr } = await supabaseAdmin.rpc('has_enterprise_role', {
      _workspace_id: workspaceId,
      _user_id: userId,
      _roles: ['owner', 'resourceAssistant'],
    })
    if (roleErr) {
      console.error('[sync-holidays] Role check RPC failed:', roleErr.message)
      return new Response(JSON.stringify({ error: 'Authorization check failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const result = await syncForWorkspace(supabaseAdmin, workspaceId, year, apiKey)
    return new Response(
      JSON.stringify({ ok: true, year, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('sync-holidays error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Reusable sync logic so user-mode and cron-mode share the same upsert path.
async function syncForWorkspace(
  supabaseAdmin: any,
  workspaceId: string,
  year: number,
  apiKey: string,
): Promise<{ total: number; inserted: number; skipped: number }> {
  const apiUrl = `https://szunetnapok.hu/api/${apiKey}/${year}/`
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`Holiday API ${res.status}`)
  const json = await res.json() as { napok?: SzunetNapokEntry[] } | SzunetNapokEntry[]
  const entries: SzunetNapokEntry[] = Array.isArray(json) ? json : (json.napok || [])

  const holidays = entries.filter(e => {
    const wn = typeof e.munkanap === 'string' ? parseInt(e.munkanap) : (e.munkanap ?? 0)
    return wn === 0 // 0 = munkaszüneti nap; 1 = pótolt munkanap
  })

  let inserted = 0, skipped = 0
  for (const h of holidays) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('enterprise_holidays')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('holiday_date', h.datum)
      .maybeSingle()
    if (existingErr) throw new Error(`Duplicate check failed for ${h.datum}: ${existingErr.message}`)
    if (existing) { skipped++; continue }
    const { error: insErr } = await supabaseAdmin.from('enterprise_holidays').insert({
      workspace_id: workspaceId,
      holiday_date: h.datum,
      name: h.nev,
      is_recurring: false,
    })
    if (insErr) {
      console.error(`[sync-holidays] Insert failed for ${h.datum}:`, insErr.message)
    } else {
      inserted++
    }
  }

  const { error: syncUpdateErr } = await supabaseAdmin
    .from('enterprise_workspaces')
    .update({ holidays_last_sync_at: new Date().toISOString() })
    .eq('id', workspaceId)
  if (syncUpdateErr) {
    console.error('[sync-holidays] Failed to update holidays_last_sync_at:', syncUpdateErr.message)
  }

  return { total: holidays.length, inserted, skipped }
}
