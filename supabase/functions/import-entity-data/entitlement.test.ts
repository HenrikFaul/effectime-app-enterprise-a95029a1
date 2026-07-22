import {
  hasMemberInvitationCandidate,
  type MembersInviteServiceClient,
  planMembersInviteInvitation,
  resolveMembersInviteEntitlement,
} from "./entitlement.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const workspaceId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";

function serviceClient(options: {
  tenantResult?: unknown;
  featureResult?: unknown;
  tenantThrow?: Error;
  featureThrow?: Error;
} = {}) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const query = {
    select(columns: "tenant_id") {
      calls.push({ name: "tenant_workspaces.select", args: columns });
      return query;
    },
    eq(column: "workspace_id", value: string) {
      calls.push({ name: "tenant_workspaces.eq", args: { column, value } });
      return query;
    },
    maybeSingle() {
      calls.push({ name: "tenant_workspaces.maybeSingle", args: null });
      if (options.tenantThrow) return Promise.reject(options.tenantThrow);
      return Promise.resolve(
        Object.hasOwn(options, "tenantResult")
          ? options.tenantResult
          : { data: { tenant_id: tenantId }, error: null },
      );
    },
  };

  return {
    calls,
    client: {
      from(table: "tenant_workspaces") {
        calls.push({ name: "from", args: table });
        return query;
      },
      rpc(
        functionName: "tenant_enabled_features",
        args: { _tenant_id: string },
      ) {
        calls.push({ name: functionName, args });
        if (options.featureThrow) return Promise.reject(options.featureThrow);
        return Promise.resolve(
          Object.hasOwn(options, "featureResult")
            ? options.featureResult
            : { data: [], error: null },
        );
      },
    } as MembersInviteServiceClient,
  };
}

Deno.test("members_invite resolver uses the authoritative tenant mapping and exact feature key", async () => {
  const harness = serviceClient({
    featureResult: {
      data: [
        { feature_key: "members_list", source: "tier" },
        { feature_key: "members_invite", source: "addon" },
      ],
      error: null,
    },
  });

  assertEquals(
    await resolveMembersInviteEntitlement(harness.client, workspaceId),
    { enabled: true, tenantId },
  );
  assertEquals(harness.calls, [
    { name: "from", args: "tenant_workspaces" },
    { name: "tenant_workspaces.select", args: "tenant_id" },
    {
      name: "tenant_workspaces.eq",
      args: { column: "workspace_id", value: workspaceId },
    },
    { name: "tenant_workspaces.maybeSingle", args: null },
    { name: "tenant_enabled_features", args: { _tenant_id: tenantId } },
  ]);
});

Deno.test("near-match feature keys remain disabled and disabled dry-runs remain blocked", async () => {
  const harness = serviceClient({
    featureResult: {
      data: [{ feature_key: "members_invite_preview", source: "override" }],
      error: null,
    },
  });

  const entitlement = await resolveMembersInviteEntitlement(
    harness.client,
    workspaceId,
  );
  assertEquals(entitlement, {
    enabled: false,
    reason: "feature_disabled",
    tenantId,
  });
  assertEquals(planMembersInviteInvitation(entitlement, true), {
    kind: "blocked",
    code: "FEATURE_DISABLED",
    message: "Member invitations are not enabled for this workspace",
  });
});

Deno.test("enabled dry-runs report only a dry-run plan and never request issuance", () => {
  assertEquals(
    planMembersInviteInvitation({ enabled: true, tenantId }, true),
    { kind: "dry_run" },
  );
  assertEquals(
    planMembersInviteInvitation({ enabled: true, tenantId }, false),
    { kind: "issue" },
  );
});

Deno.test("tenant lookup and malformed mapping responses fail closed", async () => {
  const lookupFailure = serviceClient({
    tenantResult: { data: null, error: { message: "mapping unavailable" } },
  });
  assertEquals(
    await resolveMembersInviteEntitlement(lookupFailure.client, workspaceId),
    {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_lookup",
      error: "mapping unavailable",
    },
  );

  const malformed = serviceClient({
    tenantResult: { data: { tenant_id: " " }, error: null },
  });
  assertEquals(
    await resolveMembersInviteEntitlement(malformed.client, workspaceId),
    {
      enabled: false,
      reason: "lookup_error",
      step: "tenant_response",
      error: "tenant_workspaces returned an invalid response",
    },
  );
});

Deno.test("malformed top-level lookup envelopes fail closed without throwing", async () => {
  for (const tenantResult of [null, [], { data: null, error: "raw failure" }]) {
    const malformedTenant = serviceClient({ tenantResult });
    assertEquals(
      await resolveMembersInviteEntitlement(
        malformedTenant.client,
        workspaceId,
      ),
      {
        enabled: false,
        reason: "lookup_error",
        step: "tenant_response",
        error: "tenant_workspaces returned an invalid response",
      },
    );
  }

  for (
    const featureResult of [null, [], { data: [], error: ["raw failure"] }]
  ) {
    const malformedFeature = serviceClient({ featureResult });
    assertEquals(
      await resolveMembersInviteEntitlement(
        malformedFeature.client,
        workspaceId,
      ),
      {
        enabled: false,
        reason: "lookup_error",
        step: "feature_response",
        error: "tenant_enabled_features returned an invalid response",
      },
    );
  }
});

Deno.test("feature lookup and malformed union rows fail closed even beside an enabled key", async () => {
  const lookupFailure = serviceClient({
    featureThrow: new Error("feature union offline"),
  });
  assertEquals(
    await resolveMembersInviteEntitlement(lookupFailure.client, workspaceId),
    {
      enabled: false,
      reason: "lookup_error",
      step: "feature_lookup",
      error: "feature union offline",
    },
  );

  const malformed = serviceClient({
    featureResult: {
      data: [
        { feature_key: "members_invite", source: "tier" },
        { feature_key: "calendar" },
      ],
      error: null,
    },
  });
  const entitlement = await resolveMembersInviteEntitlement(
    malformed.client,
    workspaceId,
  );
  assertEquals(entitlement, {
    enabled: false,
    reason: "lookup_error",
    step: "feature_response",
    error: "tenant_enabled_features returned an invalid response",
  });
  assertEquals(planMembersInviteInvitation(entitlement, true), {
    kind: "blocked",
    code: "ENTITLEMENT_UNAVAILABLE",
    message: "Member invitation entitlement is temporarily unavailable",
  });
});

Deno.test("existing-member-only imports do not require members_invite", () => {
  const users = new Map([
    ["existing@example.com", "existing-user"],
  ]);
  assertEquals(
    hasMemberInvitationCandidate(
      [{ email: "EXISTING@example.com" }],
      users,
      new Set(["existing-user"]),
    ),
    false,
  );
  assertEquals(
    hasMemberInvitationCandidate(
      [
        { email: "existing@example.com" },
        { email: "unknown@example.com" },
      ],
      users,
      new Set(["existing-user"]),
    ),
    true,
  );
});
