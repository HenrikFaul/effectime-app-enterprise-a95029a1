export type WorkspaceFeatureEntitlement =
  | { enabled: true; tenantId: string }
  | {
    enabled: false;
    reason: 'workspace_unmapped' | 'feature_disabled';
    tenantId?: string;
  }
  | {
    enabled: false;
    reason: 'lookup_error';
    step: 'tenant_lookup' | 'tenant_response' | 'feature_lookup' | 'feature_response';
    error: string;
  };

interface RpcError {
  message?: string;
}

interface RpcResult {
  data: unknown;
  error: RpcError | null;
}

export interface FeatureRpcClient {
  rpc<FunctionName extends keyof FeatureRpcArgs>(
    functionName: FunctionName,
    args: FeatureRpcArgs[FunctionName],
  ): PromiseLike<RpcResult>;
}

interface FeatureRpcArgs {
  tenant_id_for_workspace: { _workspace_id: string };
  tenant_enabled_features: { _tenant_id: string };
}

function errorMessage(error: RpcError | null): string {
  return error?.message?.trim() || 'Unknown database error';
}

function thrownMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'Unknown database error';
}

/**
 * Resolve a workspace's tenant and evaluate one tier/add-on entitlement.
 *
 * The result deliberately separates a disabled entitlement (403 at an HTTP
 * boundary) from an RPC/contract failure (503). Callers must treat every
 * non-enabled result as fail-closed.
 */
export async function checkWorkspaceFeature(
  client: FeatureRpcClient,
  workspaceId: string,
  featureKey: string,
): Promise<WorkspaceFeatureEntitlement> {
  let tenantResult: RpcResult;
  try {
    tenantResult = await client.rpc('tenant_id_for_workspace', {
      _workspace_id: workspaceId,
    });
  } catch (error) {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'tenant_lookup',
      error: thrownMessage(error),
    };
  }
  if (tenantResult.error) {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'tenant_lookup',
      error: errorMessage(tenantResult.error),
    };
  }
  if (tenantResult.data === null || tenantResult.data === undefined || tenantResult.data === '') {
    return { enabled: false, reason: 'workspace_unmapped' };
  }
  if (typeof tenantResult.data !== 'string') {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'tenant_response',
      error: 'tenant_id_for_workspace returned an invalid response',
    };
  }

  const tenantId = tenantResult.data;
  let featureResult: RpcResult;
  try {
    featureResult = await client.rpc('tenant_enabled_features', {
      _tenant_id: tenantId,
    });
  } catch (error) {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'feature_lookup',
      error: thrownMessage(error),
    };
  }
  if (featureResult.error) {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'feature_lookup',
      error: errorMessage(featureResult.error),
    };
  }
  if (!Array.isArray(featureResult.data)) {
    return {
      enabled: false,
      reason: 'lookup_error',
      step: 'feature_response',
      error: 'tenant_enabled_features returned an invalid response',
    };
  }

  const enabled = featureResult.data.some((row) =>
    typeof row === 'object'
    && row !== null
    && 'feature_key' in row
    && row.feature_key === featureKey
  );
  return enabled
    ? { enabled: true, tenantId }
    : { enabled: false, reason: 'feature_disabled', tenantId };
}
