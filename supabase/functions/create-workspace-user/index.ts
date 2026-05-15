// Edge Function: create-workspace-user
// Creates a Supabase auth user with a real password and adds them as an
// active enterprise_membership in the given workspace.
// Called from InviteMemberDialog (mode = 'create') when the admin
// wants to provision a real user account instead of sending an invite link.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const {
      workspace_id, email, display_name, password,
      role, business_role, team, location,
    } = await req.json().catch(() => ({}));

    if (!workspace_id)  return jsonRes({ error: "workspace_id is required" }, 400);
    if (!email)         return jsonRes({ error: "email is required" }, 400);
    if (!display_name)  return jsonRes({ error: "display_name is required" }, 400);
    if (!password)      return jsonRes({ error: "password is required" }, 400);

    // Verify caller has owner or resourceAssistant role in the workspace
    const { data: callerMembership } = await admin
      .from("enterprise_memberships")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!callerMembership || !["owner", "resourceAssistant"].includes(callerMembership.role)) {
      return jsonRes({ error: "Insufficient permissions" }, 403);
    }

    // Validate password policy
    const { data: policyResult } = await admin.rpc("validate_password_policy", { _password: password });
    if (policyResult && !policyResult.ok) {
      return jsonRes({ error: "Password policy violation", failures: policyResult.failures }, 400);
    }

    const normEmail = email.toLowerCase().trim();
    let newUserId: string;
    let userAlreadyExisted = false;

    // Check if auth user already exists
    let existingAuthUserId: string | null = null;
    {
      let page = 1;
      outer: while (true) {
        const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        for (const u of authData?.users ?? []) {
          if ((u as any).email === normEmail) {
            existingAuthUserId = u.id;
            break outer;
          }
        }
        if ((authData?.users ?? []).length < 1000) break;
        page++;
      }
    }

    if (existingAuthUserId) {
      userAlreadyExisted = true;
      newUserId = existingAuthUserId;
      // Check if already a member of this workspace
      const { data: existing } = await admin
        .from("enterprise_memberships")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", newUserId)
        .maybeSingle();
      if (existing) {
        return jsonRes({ error: "User is already a member of this workspace" }, 409);
      }
    } else {
      // Create new auth user
      const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
        email: normEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name, source: "enterprise_direct_create", workspace_id },
      });
      if (createErr || !createdUser.user) {
        console.error("[create-workspace-user] auth.createUser failed:", createErr);
        return jsonRes({ error: createErr?.message ?? "Failed to create auth user" }, 500);
      }
      newUserId = createdUser.user.id;
    }

    // Insert enterprise_membership
    const { error: membershipError } = await admin
      .from("enterprise_memberships")
      .insert({
        workspace_id,
        user_id:        newUserId,
        role:           role ?? "member",
        status:         "active",
        joined_at:      new Date().toISOString(),
        business_role:  business_role ?? null,
        team:           team ?? null,
        location:       location ?? null,
      });

    if (membershipError) {
      console.error("[create-workspace-user] membership insert failed:", membershipError);
      if (!userAlreadyExisted) {
        await admin.auth.admin.deleteUser(newUserId).catch(() => null);
      }
      return jsonRes({ error: "Failed to create workspace membership" }, 500);
    }

    // Upsert profile (non-blocking)
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ user_id: newUserId, display_name }, { onConflict: "user_id" });
    if (profileError) {
      console.warn("[create-workspace-user] profile upsert failed:", profileError.message);
    }

    return jsonRes({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-workspace-user] unhandled error:", msg);
    return jsonRes({ error: msg }, 500);
  }
});
