// Demo Workspace Cleanup
// ----------------------
// Deletes a workspace AND removes the demo personas (auth.users) seeded for it.
// Without this step, deleting the workspace would leave orphan auth.users
// (memberships cascade away with the workspace, but the auth user records remain).
//
// Authorization: only the workspace owner may call this. The demo seeding
// stamped `enterprise_workspaces.settings.demo_user_ids` so we know exactly
// which auth users to delete.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authz = req.headers.get('Authorization');
    if (!authz) return jsonRes({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authz } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonRes({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const workspaceId: string = (body?.workspace_id ?? '').toString();
    if (!workspaceId) return jsonRes({ error: 'workspace_id kötelező' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is the workspace owner
    const { data: ws } = await admin
      .from('enterprise_workspaces')
      .select('id, created_by, settings')
      .eq('id', workspaceId)
      .maybeSingle();
    if (!ws) return jsonRes({ error: 'Munkaterület nem található' }, 404);
    if ((ws as any).created_by !== userId) {
      return jsonRes({ error: 'Csak a munkaterület tulajdonosa törölheti.' }, 403);
    }

    const settings = ((ws as any).settings ?? {}) as Record<string, unknown>;
    const demoUserIds: string[] = Array.isArray((settings as any).demo_user_ids)
      ? ((settings as any).demo_user_ids as string[])
      : [];

    // Delete the workspace first (cascades all workspace-scoped tables via FK)
    const { error: delErr } = await admin
      .from('enterprise_workspaces')
      .delete()
      .eq('id', workspaceId);
    if (delErr) return jsonRes({ error: 'Workspace törlés sikertelen: ' + delErr.message }, 500);

    // Delete demo personas (auth.users). Cascades profiles via FK.
    let deletedUsers = 0;
    for (const uid of demoUserIds) {
      try {
        const { error } = await admin.auth.admin.deleteUser(uid);
        if (!error) deletedUsers += 1;
      } catch (e) {
        console.warn('[cleanup-demo-workspace] deleteUser failed', uid, e);
      }
    }

    return jsonRes({ ok: true, deleted_users: deletedUsers, deleted_workspace: workspaceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cleanup-demo-workspace] error:', msg);
    return jsonRes({ ok: false, error: msg }, 500);
  }
});
