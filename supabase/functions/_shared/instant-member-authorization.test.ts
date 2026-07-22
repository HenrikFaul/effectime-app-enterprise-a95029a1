import {
  checkInstantMemberCreationAuthorization,
  type WorkspacePermissionRpcClient,
} from "./instant-member-authorization.ts";
import type { FeatureRpcClient } from "./feature-entitlement.ts";

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function permissionClient(result: RpcResult | PromiseLike<RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  return {
    calls,
    client: {
      rpc(name: "has_workspace_permission", args: unknown) {
        calls.push({ name, args });
        return Promise.resolve(result);
      },
    } as WorkspacePermissionRpcClient,
  };
}

function featureClient(...results: RpcResult[]) {
  const calls: Array<{ name: string; args: unknown }> = [];
  return {
    calls,
    client: {
      rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return Promise.resolve(results.shift() ?? { data: null, error: null });
      },
    } as FeatureRpcClient,
  };
}

function enabledFeatureResults(featureKey: string): RpcResult[] {
  return [
    { data: "tenant-1", error: null },
    { data: [{ feature_key: featureKey }], error: null },
  ];
}

Deno.test("instant member authorization binds canonical members:edit permission to the caller", async () => {
  const permission = permissionClient({ data: true, error: null });
  const features = featureClient(
    ...enabledFeatureResults("members_list"),
    ...enabledFeatureResults("instant_member_create"),
  );

  const result = await checkInstantMemberCreationAuthorization(
    permission.client,
    features.client,
    "workspace-1",
    "user-1",
  );

  assertEquals(result, { allowed: true });
  assertEquals(permission.calls, [{
    name: "has_workspace_permission",
    args: {
      _workspace_id: "workspace-1",
      _user_id: "user-1",
      _feature_key: "members",
      _minimum_access: "edit",
    },
  }]);
  assertEquals(features.calls.map((call) => call.name), [
    "tenant_id_for_workspace",
    "tenant_enabled_features",
    "tenant_id_for_workspace",
    "tenant_enabled_features",
  ]);
});

Deno.test("instant member authorization denies missing active membership or members:edit permission before entitlement reads", async () => {
  const permission = permissionClient({ data: false, error: null });
  const features = featureClient();

  assertEquals(
    await checkInstantMemberCreationAuthorization(
      permission.client,
      features.client,
      "workspace-1",
      "user-1",
    ),
    {
      allowed: false,
      status: 403,
      reason: "forbidden",
      step: "members_permission",
    },
  );
  assertEquals(features.calls, []);
});

Deno.test("instant member authorization requires both members_list and instant_member_create", async () => {
  const membersListMissing = featureClient(
    { data: "tenant-1", error: null },
    { data: [{ feature_key: "instant_member_create" }], error: null },
  );
  assertEquals(
    await checkInstantMemberCreationAuthorization(
      permissionClient({ data: true, error: null }).client,
      membersListMissing.client,
      "workspace-1",
      "user-1",
    ),
    { allowed: false, status: 403, reason: "forbidden", step: "members_list" },
  );

  const instantCreateMissing = featureClient(
    ...enabledFeatureResults("members_list"),
    { data: "tenant-1", error: null },
    { data: [{ feature_key: "members_list" }], error: null },
  );
  assertEquals(
    await checkInstantMemberCreationAuthorization(
      permissionClient({ data: true, error: null }).client,
      instantCreateMissing.client,
      "workspace-1",
      "user-1",
    ),
    {
      allowed: false,
      status: 403,
      reason: "forbidden",
      step: "instant_member_create",
    },
  );
});

Deno.test("instant member authorization maps permission failures and malformed responses to sanitized 503 results", async () => {
  const rawError = "permission backend leaked user@example.test";
  for (
    const result of [
      permissionClient({ data: null, error: { message: rawError } }),
      permissionClient({ data: "true", error: null }),
      {
        client: {
          rpc: () => Promise.reject(new Error(rawError)),
        } as WorkspacePermissionRpcClient,
      },
      {
        client: {
          rpc: () => Promise.resolve(null),
        } as unknown as WorkspacePermissionRpcClient,
      },
    ]
  ) {
    const authorization = await checkInstantMemberCreationAuthorization(
      result.client,
      featureClient().client,
      "workspace-1",
      "user-1",
    );
    if (authorization.allowed || authorization.status !== 503) {
      throw new Error(
        "Permission dependency failures must fail closed with 503",
      );
    }
    if (JSON.stringify(authorization).includes(rawError)) {
      throw new Error("Raw permission errors must not escape the helper");
    }
  }
});

Deno.test("instant member authorization maps entitlement lookup failures to sanitized 503 results", async () => {
  const rawError = "tenant lookup leaked user@example.test";
  const features = featureClient({ data: null, error: { message: rawError } });
  const result = await checkInstantMemberCreationAuthorization(
    permissionClient({ data: true, error: null }).client,
    features.client,
    "workspace-1",
    "user-1",
  );

  assertEquals(result, {
    allowed: false,
    status: 503,
    reason: "authorization_unavailable",
    step: "members_list_lookup",
  });
  if (JSON.stringify(result).includes(rawError)) {
    throw new Error("Raw entitlement errors must not escape the helper");
  }

  const malformedResult = await checkInstantMemberCreationAuthorization(
    permissionClient({ data: true, error: null }).client,
    {
      rpc: () => Promise.resolve(null),
    } as unknown as FeatureRpcClient,
    "workspace-1",
    "user-1",
  );
  assertEquals(malformedResult, {
    allowed: false,
    status: 503,
    reason: "authorization_unavailable",
    step: "members_list_lookup",
  });
});
