const MEMBERS_INVITE_FEATURE_KEY = "members_invite";
export const CSV_IMPORT_REQUIRED_FEATURE_KEYS = [
  "csv_import",
  "members_list",
] as const;
const ENABLED_FEATURE_SOURCES = new Set(["tier", "addon", "override"]);

interface LookupError {
  message?: string;
}

interface LookupResult {
  data: unknown;
  error: LookupError | null;
}

interface TenantWorkspaceQuery {
  select(columns: "tenant_id"): TenantWorkspaceQuery;
  eq(column: "workspace_id", value: string): TenantWorkspaceQuery;
  maybeSingle(): PromiseLike<unknown>;
}

export interface TenantFeatureServiceClient {
  from(table: "tenant_workspaces"): TenantWorkspaceQuery;
  rpc(
    functionName: "tenant_enabled_features",
    args: { _tenant_id: string },
  ): PromiseLike<unknown>;
}

export type MembersInviteServiceClient = TenantFeatureServiceClient;

export type TenantFeatureEntitlement =
  | { enabled: true; tenantId: string }
  | {
    enabled: false;
    reason: "feature_disabled";
    tenantId: string;
    missingFeatureKeys: string[];
  }
  | {
    enabled: false;
    reason: "lookup_error";
    step:
      | "tenant_lookup"
      | "tenant_response"
      | "feature_lookup"
      | "feature_response";
    error: string;
  };

export type MembersInviteEntitlement =
  | { enabled: true; tenantId: string }
  | { enabled: false; reason: "feature_disabled"; tenantId: string }
  | {
    enabled: false;
    reason: "lookup_error";
    step:
      | "tenant_lookup"
      | "tenant_response"
      | "feature_lookup"
      | "feature_response";
    error: string;
  };

export type MembersInviteInvitationPlan =
  | {
    kind: "blocked";
    code: "FEATURE_DISABLED" | "ENTITLEMENT_UNAVAILABLE";
    message: string;
  }
  | { kind: "dry_run" }
  | { kind: "issue" };

export type CsvImportAccessPlan =
  | { kind: "allowed" }
  | {
    kind: "blocked";
    status: 403 | 503;
    code: "FEATURE_DISABLED" | "ENTITLEMENT_UNAVAILABLE";
    message: string;
  };

export function hasMemberInvitationCandidate(
  rows: Array<Record<string, unknown>>,
  userIdByEmail: ReadonlyMap<string, unknown>,
  existingUserIds: ReadonlySet<unknown>,
): boolean {
  return rows.some((row) => {
    const email = String(row.email || "").toLowerCase();
    if (!email) return false;
    const userId = userIdByEmail.get(email);
    return !userId || !existingUserIds.has(userId);
  });
}

function lookupErrorMessage(error: LookupError | null): string {
  return error?.message?.trim() || "Unknown database error";
}

function thrownMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Unknown database error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLookupResult(value: unknown): LookupResult | null {
  if (
    !isRecord(value) ||
    !("data" in value) ||
    !("error" in value) ||
    (value.error !== null &&
      (!isRecord(value.error) ||
        (value.error.message !== undefined &&
          typeof value.error.message !== "string")))
  ) {
    return null;
  }

  return {
    data: value.data,
    error: value.error as LookupError | null,
  };
}

function isEnabledFeatureRow(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.feature_key === "string" &&
    value.feature_key.trim().length > 0 &&
    typeof value.source === "string" &&
    ENABLED_FEATURE_SOURCES.has(value.source);
}

/**
 * Resolve exact required features from the service-only tenant mapping and
 * feature-union boundaries. Every lookup or response-contract failure is
 * explicit so callers can fail closed instead of treating it as a disabled
 * feature or an empty result.
 */
export async function resolveTenantFeatureEntitlement(
  client: TenantFeatureServiceClient,
  workspaceId: string,
  requiredFeatureKeys: readonly string[],
): Promise<TenantFeatureEntitlement> {
  let tenantEnvelope: unknown;
  try {
    tenantEnvelope = await client
      .from("tenant_workspaces")
      .select("tenant_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
  } catch (error) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_lookup",
      error: thrownMessage(error),
    };
  }

  const tenantResult = parseLookupResult(tenantEnvelope);
  if (!tenantResult) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_response",
      error: "tenant_workspaces returned an invalid response",
    };
  }

  if (tenantResult.error) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_lookup",
      error: lookupErrorMessage(tenantResult.error),
    };
  }
  if (
    !isRecord(tenantResult.data) ||
    typeof tenantResult.data.tenant_id !== "string" ||
    tenantResult.data.tenant_id.trim().length === 0
  ) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_response",
      error: "tenant_workspaces returned an invalid response",
    };
  }

  const tenantId = tenantResult.data.tenant_id.trim();
  let featureEnvelope: unknown;
  try {
    featureEnvelope = await client.rpc("tenant_enabled_features", {
      _tenant_id: tenantId,
    });
  } catch (error) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "feature_lookup",
      error: thrownMessage(error),
    };
  }

  const featureResult = parseLookupResult(featureEnvelope);
  if (!featureResult) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "feature_response",
      error: "tenant_enabled_features returned an invalid response",
    };
  }

  if (featureResult.error) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "feature_lookup",
      error: lookupErrorMessage(featureResult.error),
    };
  }
  if (
    !Array.isArray(featureResult.data) ||
    !featureResult.data.every(isEnabledFeatureRow)
  ) {
    return {
      enabled: false,
      reason: "lookup_error",
      step: "feature_response",
      error: "tenant_enabled_features returned an invalid response",
    };
  }

  const enabledFeatureKeys = new Set(
    featureResult.data.map((row) =>
      (row as Record<string, unknown>).feature_key as string
    ),
  );
  const missingFeatureKeys = [...new Set(requiredFeatureKeys)].filter(
    (featureKey) => !enabledFeatureKeys.has(featureKey),
  );

  return missingFeatureKeys.length === 0 ? { enabled: true, tenantId } : {
    enabled: false,
    reason: "feature_disabled",
    tenantId,
    missingFeatureKeys,
  };
}

/** Preserve the invitation-specific result contract for existing callers. */
export async function resolveMembersInviteEntitlement(
  client: MembersInviteServiceClient,
  workspaceId: string,
): Promise<MembersInviteEntitlement> {
  const entitlement = await resolveTenantFeatureEntitlement(
    client,
    workspaceId,
    [MEMBERS_INVITE_FEATURE_KEY],
  );
  if (entitlement.enabled || entitlement.reason === "lookup_error") {
    return entitlement;
  }
  return {
    enabled: false,
    reason: "feature_disabled",
    tenantId: entitlement.tenantId,
  };
}

/** Require the import feature and its documented members-list dependency. */
export function resolveCsvImportEntitlement(
  client: TenantFeatureServiceClient,
  workspaceId: string,
): Promise<TenantFeatureEntitlement> {
  return resolveTenantFeatureEntitlement(
    client,
    workspaceId,
    CSV_IMPORT_REQUIRED_FEATURE_KEYS,
  );
}

/** Convert internal resolution details into a stable, sanitized HTTP plan. */
export function planCsvImportAccess(
  entitlement: TenantFeatureEntitlement,
): CsvImportAccessPlan {
  if (entitlement.enabled) return { kind: "allowed" };
  if (entitlement.reason === "lookup_error") {
    return {
      kind: "blocked",
      status: 503,
      code: "ENTITLEMENT_UNAVAILABLE",
      message: "CSV import entitlement is temporarily unavailable",
    };
  }
  return {
    kind: "blocked",
    status: 403,
    code: "FEATURE_DISABLED",
    message: "CSV import is not enabled for this workspace",
  };
}

/**
 * Decide the row path before any dry-run success is counted or invitation RPC
 * is invoked. This is deliberately fail-closed for unresolved entitlements.
 */
export function planMembersInviteInvitation(
  entitlement: MembersInviteEntitlement,
  dryRun: boolean,
): MembersInviteInvitationPlan {
  if (!entitlement.enabled) {
    if (entitlement.reason === "lookup_error") {
      return {
        kind: "blocked",
        code: "ENTITLEMENT_UNAVAILABLE",
        message: "Member invitation entitlement is temporarily unavailable",
      };
    }
    return {
      kind: "blocked",
      code: "FEATURE_DISABLED",
      message: "Member invitations are not enabled for this workspace",
    };
  }
  return dryRun ? { kind: "dry_run" } : { kind: "issue" };
}
