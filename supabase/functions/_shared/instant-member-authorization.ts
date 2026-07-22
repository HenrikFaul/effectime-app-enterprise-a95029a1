import {
  checkWorkspaceFeature,
  type FeatureRpcClient,
} from "./feature-entitlement.ts";

interface RpcError {
  message?: string;
}

interface PermissionRpcResult {
  data: unknown;
  error: RpcError | null;
}

function isPermissionRpcResult(value: unknown): value is PermissionRpcResult {
  return typeof value === "object" && value !== null && "data" in value &&
    "error" in value;
}

export interface WorkspacePermissionRpcClient {
  rpc(
    functionName: "has_workspace_permission",
    args: {
      _workspace_id: string;
      _user_id: string;
      _feature_key: "members";
      _minimum_access: "edit";
    },
  ): PromiseLike<PermissionRpcResult>;
}

export type InstantMemberAuthorizationResult =
  | { allowed: true }
  | {
    allowed: false;
    status: 403;
    reason: "forbidden";
    step: "members_permission" | "members_list" | "instant_member_create";
  }
  | {
    allowed: false;
    status: 503;
    reason: "authorization_unavailable";
    step:
      | "members_permission_lookup"
      | "members_permission_response"
      | "members_list_lookup"
      | "instant_member_create_lookup";
  };

const REQUIRED_FEATURES = ["members_list", "instant_member_create"] as const;

/**
 * Authorize service-role backed instant-member creation without granting the
 * service role's privileges to the caller. The permission RPC runs with the
 * caller JWT so its auth.uid() binding, active-membership check and configured
 * members:edit role permission remain authoritative. Tenant entitlements use
 * the canonical server-side resolver and every lookup/contract failure fails
 * closed without returning a database error or caller identifier.
 */
export async function checkInstantMemberCreationAuthorization(
  permissionClient: WorkspacePermissionRpcClient,
  entitlementClient: FeatureRpcClient,
  workspaceId: string,
  userId: string,
): Promise<InstantMemberAuthorizationResult> {
  let permissionResult: unknown;
  try {
    permissionResult = await permissionClient.rpc("has_workspace_permission", {
      _workspace_id: workspaceId,
      _user_id: userId,
      _feature_key: "members",
      _minimum_access: "edit",
    });
  } catch {
    return {
      allowed: false,
      status: 503,
      reason: "authorization_unavailable",
      step: "members_permission_lookup",
    };
  }

  if (!isPermissionRpcResult(permissionResult)) {
    return {
      allowed: false,
      status: 503,
      reason: "authorization_unavailable",
      step: "members_permission_response",
    };
  }
  if (permissionResult.error) {
    return {
      allowed: false,
      status: 503,
      reason: "authorization_unavailable",
      step: "members_permission_lookup",
    };
  }
  if (typeof permissionResult.data !== "boolean") {
    return {
      allowed: false,
      status: 503,
      reason: "authorization_unavailable",
      step: "members_permission_response",
    };
  }
  if (!permissionResult.data) {
    return {
      allowed: false,
      status: 403,
      reason: "forbidden",
      step: "members_permission",
    };
  }

  for (const featureKey of REQUIRED_FEATURES) {
    let entitlement;
    try {
      entitlement = await checkWorkspaceFeature(
        entitlementClient,
        workspaceId,
        featureKey,
      );
    } catch {
      return {
        allowed: false,
        status: 503,
        reason: "authorization_unavailable",
        step: `${featureKey}_lookup`,
      };
    }
    if (entitlement.enabled) continue;
    if (entitlement.reason === "lookup_error") {
      return {
        allowed: false,
        status: 503,
        reason: "authorization_unavailable",
        step: `${featureKey}_lookup`,
      };
    }
    return {
      allowed: false,
      status: 403,
      reason: "forbidden",
      step: featureKey,
    };
  }

  return { allowed: true };
}
