/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import {
  BLOCKING_AUTH_USER_REFERENCES,
  findWorkspacesWithoutAnotherActiveOwner,
  getReauthenticationStatus,
  validateDeletionRequestBody,
} from "./security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DatabaseError = {
  code?: string;
  message: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function throwOnDatabaseError(
  operation: string,
  error: DatabaseError | null | undefined,
): void {
  if (!error) return;

  console.error("delete-account database operation failed", {
    operation,
    code: error.code ?? "unknown",
    message: error.message,
  });
  throw new Error(`Database operation failed: ${operation}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
      { Allow: "POST, OPTIONS" },
    );
  }

  const contentType = req.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return jsonResponse(
      { error: "Content-Type must be application/json", code: "UNSUPPORTED_MEDIA_TYPE" },
      415,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const reauthenticationStatus = getReauthenticationStatus(authHeader);
  if (reauthenticationStatus === "invalid") {
    return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("delete-account is missing required Supabase environment variables");
      return jsonResponse(
        { error: "Account deletion is temporarily unavailable", code: "SERVER_MISCONFIGURED" },
        500,
      );
    }

    // Identity is established only by Supabase Auth. JWT payload parsing above is
    // used solely to inspect the optional standard OIDC auth_time claim.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    // Existing Supabase sessions do not currently prove auth_time. Preserve those
    // clients, but require fresh authentication when the identity provider supplies it.
    if (reauthenticationStatus === "required") {
      return jsonResponse(
        {
          error: "Recent authentication is required before deleting the account",
          code: "REAUTHENTICATION_REQUIRED",
        },
        401,
      );
    }

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return jsonResponse(
        { error: "Request body must be valid JSON", code: "INVALID_REQUEST_BODY" },
        400,
      );
    }

    const validatedBody = validateDeletionRequestBody(requestBody);
    if (!validatedBody.ok) {
      return jsonResponse(
        { error: validatedBody.error, code: validatedBody.code },
        400,
      );
    }

    if (!user.email || !user.created_at) {
      console.error("delete-account cannot create the required audit record", {
        userId: user.id,
        hasEmail: Boolean(user.email),
        hasCreatedAt: Boolean(user.created_at),
      });
      return jsonResponse(
        { error: "Account metadata is incomplete", code: "ACCOUNT_METADATA_INCOMPLETE" },
        409,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Ownership is represented by active enterprise memberships. created_by has
    // no auth FK, so include creator workspaces as a drift-safe orphan check too.
    const { data: activeOwnerMemberships, error: activeOwnerMembershipsError } =
      await adminClient
        .from("enterprise_memberships")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .eq("status", "active");
    throwOnDatabaseError("select active owner memberships", activeOwnerMembershipsError);

    const { data: createdWorkspaces, error: createdWorkspacesError } = await adminClient
      .from("enterprise_workspaces")
      .select("id")
      .eq("created_by", user.id);
    throwOnDatabaseError("select created workspaces", createdWorkspacesError);

    const activeOwnerWorkspaceIds = (activeOwnerMemberships ?? []).map(
      (membership) => membership.workspace_id,
    );
    const createdWorkspaceIds = (createdWorkspaces ?? []).map((workspace) => workspace.id);
    const candidateWorkspaceIds = findWorkspacesWithoutAnotherActiveOwner(
      activeOwnerWorkspaceIds,
      createdWorkspaceIds,
      [],
    );

    let otherActiveOwnerWorkspaceIds: string[] = [];
    if (candidateWorkspaceIds.length > 0) {
      const { data: otherActiveOwners, error: otherActiveOwnersError } = await adminClient
        .from("enterprise_memberships")
        .select("workspace_id")
        .in("workspace_id", candidateWorkspaceIds)
        .eq("role", "owner")
        .eq("status", "active")
        .neq("user_id", user.id);
      throwOnDatabaseError("select remaining active owners", otherActiveOwnersError);
      otherActiveOwnerWorkspaceIds = (otherActiveOwners ?? []).map(
        (membership) => membership.workspace_id,
      );
    }

    const ownerlessWorkspaceIds = findWorkspacesWithoutAnotherActiveOwner(
      activeOwnerWorkspaceIds,
      createdWorkspaceIds,
      otherActiveOwnerWorkspaceIds,
    );
    if (ownerlessWorkspaceIds.length > 0) {
      return jsonResponse(
        {
          error: "Transfer workspace ownership before deleting this account",
          code: "SOLE_WORKSPACE_OWNER",
          blocking_workspace_count: ownerlessWorkspaceIds.length,
        },
        409,
      );
    }

    // Later migrations introduced auth.users foreign keys without ON DELETE
    // semantics. Do not begin a multi-step deletion that is guaranteed to fail
    // after already removing memberships or social data. The final treatment
    // (delete vs anonymize vs retain) requires the audited transactional
    // account-deletion workflow tracked in PROJECT_AUDIT.md.
    let blockingReferenceCount = 0;
    for (const reference of BLOCKING_AUTH_USER_REFERENCES) {
      const { count, error: referenceError } = await adminClient
        .from(reference.table)
        .select("id", { count: "exact", head: true })
        .eq(reference.column, user.id);
      throwOnDatabaseError(
        `preflight ${reference.table}.${reference.column}`,
        referenceError,
      );
      blockingReferenceCount += count ?? 0;
    }
    if (blockingReferenceCount > 0) {
      return jsonResponse(
        {
          error: "Account data requires retention-aware cleanup before deletion",
          code: "ACCOUNT_DATA_REQUIRES_REVIEW",
          blocking_reference_count: blockingReferenceCount,
        },
        409,
      );
    }

    // These relations have user UUID columns without auth.users foreign keys in
    // the current schema. Other legacy account data is covered by declared
    // ON DELETE CASCADE constraints and is intentionally not duplicated here.
    const { error: shareTokenDeleteError } = await adminClient
      .from("event_share_tokens")
      .delete()
      .eq("created_by", user.id);
    throwOnDatabaseError("delete created event share tokens", shareTokenDeleteError);

    const { error: ownFavoritesDeleteError } = await adminClient
      .from("favorites")
      .delete()
      .eq("user_id", user.id);
    throwOnDatabaseError("delete owned favorites", ownFavoritesDeleteError);

    const { error: receivedFavoritesDeleteError } = await adminClient
      .from("favorites")
      .delete()
      .eq("favorite_user_id", user.id);
    throwOnDatabaseError("delete received favorites", receivedFavoritesDeleteError);

    const { error: requestedFriendshipsDeleteError } = await adminClient
      .from("friendships")
      .delete()
      .eq("requester_id", user.id);
    throwOnDatabaseError("delete requested friendships", requestedFriendshipsDeleteError);

    const { error: receivedFriendshipsDeleteError } = await adminClient
      .from("friendships")
      .delete()
      .eq("addressee_id", user.id);
    throwOnDatabaseError("delete received friendships", receivedFriendshipsDeleteError);

    const { error: membershipDeleteError } = await adminClient
      .from("enterprise_memberships")
      .delete()
      .eq("user_id", user.id);
    throwOnDatabaseError("delete enterprise memberships", membershipDeleteError);

    const { error: authUserDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (authUserDeleteError) {
      console.error("delete-account auth user deletion failed", {
        code: authUserDeleteError.code ?? "unknown",
        message: authUserDeleteError.message,
      });
      throw new Error("Auth user deletion failed");
    }

    // Log only after the irreversible auth deletion succeeds, so account_deletions
    // never claims that a failed request completed. A log failure cannot be retried
    // by the now-deleted user, therefore return a truthful success with an alert flag.
    const { error: auditInsertError } = await adminClient.from("account_deletions").insert({
      user_id: user.id,
      email: user.email,
      account_created_at: user.created_at,
      deletion_reason: validatedBody.reason,
    });
    if (auditInsertError) {
      console.error("delete-account completed but audit logging failed", {
        userId: user.id,
        code: auditInsertError.code ?? "unknown",
        message: auditInsertError.message,
      });
      return jsonResponse({ success: true, audit_logged: false });
    }

    return jsonResponse({ success: true, audit_logged: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("delete-account failed", { message });
    return jsonResponse(
      { error: "Failed to delete account", code: "ACCOUNT_DELETION_FAILED" },
      500,
    );
  }
});
