import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeWorkspaceProfileDisplayName,
  loadWorkspaceMemberProfileEditSnapshot,
  saveWorkspaceMemberProfile,
  updateMyWorkspaceProfileDisplayName,
  WorkspaceMemberProfileError,
  WorkspaceMemberProfileReadError,
  type SaveWorkspaceMemberProfileInput,
  type SaveWorkspaceMemberProfileRpcClient,
  type WorkspaceMemberProfileReadRpcClient,
  type WorkspaceMemberProfileRpcClient,
} from "@/lib/workspaceMemberProfileApi";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "a1000000-0000-4000-8000-000000000001";
const OFFICE_ID = "b1000000-0000-4000-8000-000000000001";
const AUDIT_EVENT_ID = "c1000000-0000-4000-8000-000000000001";
const PROFILE_REVISION = 7;

function clientWithResponse(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  return { client: { rpc } as WorkspaceMemberProfileRpcClient, rpc };
}

const validSaveInput = (): SaveWorkspaceMemberProfileInput => ({
  workspaceId: WORKSPACE_ID,
  membershipId: MEMBERSHIP_ID,
  expectedProfileRevision: PROFILE_REVISION,
  location: " Budapest HQ ",
  city: " Budapest ",
  officeId: OFFICE_ID,
  baseWorkingHours: 7.5,
  roleAllocations: [
    { businessRole: " Engineering ", percentage: 60, isPriority: true },
    { businessRole: "QA", percentage: 40, isPriority: false },
  ],
  displayName: " Ada Lovelace ",
  expectedDisplayName: "Ada Byron",
});

const validSaveResponse = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  workspace_id: WORKSPACE_ID,
  membership_id: MEMBERSHIP_ID,
  profile_revision: PROFILE_REVISION + 1,
  changed: true,
  allocation_count: 2,
  display_name_updated: true,
  audit_event_id: AUDIT_EVENT_ID,
  ...overrides,
});

function saveClientWithResponse(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  return { client: { rpc } as SaveWorkspaceMemberProfileRpcClient, rpc };
}

function readClientWithResponse(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  return { client: { rpc } as WorkspaceMemberProfileReadRpcClient, rpc };
}

const validReadResponse = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  workspace_id: WORKSPACE_ID,
  membership_id: MEMBERSHIP_ID,
  status: "active",
  display_name: "Ada Lovelace",
  business_role: "Engineering",
  location: "Remote",
  city: null,
  office_id: OFFICE_ID,
  base_working_hours: 4,
  profile_revision: PROFILE_REVISION,
  role_allocations: [
    { business_role: "Engineering", percentage: 60, is_priority: true },
    { business_role: "QA", percentage: 40, is_priority: false },
  ],
  ...overrides,
});

async function expectSaveError(
  input: SaveWorkspaceMemberProfileInput,
  code: "invalid-input" | "aborted" | "timeout" | "conflict" | "request-failed" | "invalid-response",
  client?: SaveWorkspaceMemberProfileRpcClient,
) {
  await expect(saveWorkspaceMemberProfile(input, { client })).rejects.toMatchObject({ code });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("workspace member profile API", () => {
  it("shares one trim, length, and control-character display-name contract without rewriting Unicode", () => {
    expect(canonicalizeWorkspaceProfileDisplayName("  Ａｄａ  ")).toBe("Ａｄａ");
    expect(canonicalizeWorkspaceProfileDisplayName("   ")).toBeUndefined();
    expect(canonicalizeWorkspaceProfileDisplayName("x".repeat(201))).toBeUndefined();
    expect(canonicalizeWorkspaceProfileDisplayName("Ada\nLovelace")).toBeUndefined();
    expect(canonicalizeWorkspaceProfileDisplayName("Ada\u0085Lovelace")).toBeUndefined();
    expect(canonicalizeWorkspaceProfileDisplayName("Ada\ud800Lovelace")).toBeUndefined();
    expect(canonicalizeWorkspaceProfileDisplayName("\u00a0\ufeffAda\u00a0")).toBe("Ada");
  });

  it("calls only the self-profile workspace-bound rename RPC with a normalized name", async () => {
    const { client, rpc } = clientWithResponse({ data: "Ada Lovelace", error: null });

    await expect(
      updateMyWorkspaceProfileDisplayName(WORKSPACE_ID, MEMBERSHIP_ID, "  Ada Lovelace  ", {
        client,
      }),
    ).resolves.toBe("Ada Lovelace");
    expect(rpc).toHaveBeenCalledWith("update_my_workspace_profile_display_name_v1", {
      p_workspace_id: WORKSPACE_ID,
      p_membership_id: MEMBERSHIP_ID,
      p_display_name: "Ada Lovelace",
    });
  });

  it.each([
    ["bad workspace", "not-a-uuid", MEMBERSHIP_ID, "Ada"],
    ["bad membership", WORKSPACE_ID, "not-a-uuid", "Ada"],
    ["empty name", WORKSPACE_ID, MEMBERSHIP_ID, "   "],
    ["control character", WORKSPACE_ID, MEMBERSHIP_ID, "Ada\nLovelace"],
    ["oversized name", WORKSPACE_ID, MEMBERSHIP_ID, "a".repeat(201)],
  ])("rejects %s before making a request", async (_label, workspaceId, membershipId, name) => {
    const { client, rpc } = clientWithResponse({ data: name, error: null });

    await expect(
      updateMyWorkspaceProfileDisplayName(workspaceId, membershipId, name, { client }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps backend failures to a bounded error", async () => {
    const { client } = clientWithResponse({
      data: null,
      error: { message: "private backend detail" },
    });

    await expect(
      updateMyWorkspaceProfileDisplayName(WORKSPACE_ID, MEMBERSHIP_ID, "Ada", { client }),
    ).rejects.toMatchObject({ code: "request-failed" });
  });

  it("rejects a response that does not echo the normalized committed value", async () => {
    const { client } = clientWithResponse({ data: "Different", error: null });

    await expect(
      updateMyWorkspaceProfileDisplayName(WORKSPACE_ID, MEMBERSHIP_ID, "Ada", { client }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("fails closed when the mutation exceeds its timeout", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn(() => new Promise<never>(() => undefined));
    const request = updateMyWorkspaceProfileDisplayName(WORKSPACE_ID, MEMBERSHIP_ID, "Ada", {
      client: { rpc } as WorkspaceMemberProfileRpcClient,
      timeoutMs: 25,
    });
    const assertion = expect(request).rejects.toMatchObject({
      code: "timeout",
    });

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
});

describe("atomic workspace member profile edit snapshot", () => {
  it("loads metadata, revision, and allocations through one exact RPC", async () => {
    const { client, rpc } = readClientWithResponse({ data: validReadResponse(), error: null });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).resolves.toEqual({
      ok: true,
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      status: "active",
      displayName: "Ada Lovelace",
      businessRole: "Engineering",
      location: "Remote",
      city: null,
      officeId: OFFICE_ID,
      baseWorkingHours: 4,
      profileRevision: PROFILE_REVISION,
      roleAllocations: [
        { businessRole: "Engineering", percentage: 60, isPriority: true },
        { businessRole: "QA", percentage: 40, isPriority: false },
      ],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_workspace_member_profile_edit_snapshot_v1", {
      p_workspace_id: WORKSPACE_ID,
      p_membership_id: MEMBERSHIP_ID,
    });
  });

  it("preserves schema-valid legacy working-hour precision for explicit UI repair", async () => {
    const { client } = readClientWithResponse({
      data: validReadResponse({ base_working_hours: 8.123 }),
      error: null,
    });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).resolves.toMatchObject({ baseWorkingHours: 8.123 });
  });

  it("canonicalizes UUID input and correlated response IDs", async () => {
    const uppercaseWorkspaceId = WORKSPACE_ID.toUpperCase();
    const uppercaseMembershipId = MEMBERSHIP_ID.toUpperCase();
    const { client, rpc } = readClientWithResponse({ data: validReadResponse(), error: null });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(uppercaseWorkspaceId, uppercaseMembershipId, { client }),
    ).resolves.toMatchObject({ workspaceId: WORKSPACE_ID, membershipId: MEMBERSHIP_ID });
    expect(rpc).toHaveBeenCalledWith(
      "get_workspace_member_profile_edit_snapshot_v1",
      { p_workspace_id: WORKSPACE_ID, p_membership_id: MEMBERSHIP_ID },
    );
  });

  it.each([
    ["invalid workspace", "bad", MEMBERSHIP_ID, undefined],
    ["invalid membership", WORKSPACE_ID, "bad", undefined],
    ["zero timeout", WORKSPACE_ID, MEMBERSHIP_ID, 0],
    ["fractional timeout", WORKSPACE_ID, MEMBERSHIP_ID, 1.5],
  ])("rejects %s before issuing the read RPC", async (_label, workspaceId, membershipId, timeoutMs) => {
    const { client, rpc } = readClientWithResponse({ data: validReadResponse(), error: null });
    await expect(
      loadWorkspaceMemberProfileEditSnapshot(workspaceId, membershipId, { client, timeoutMs }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["non-object", null],
    ["extra key", validReadResponse({ private_detail: "secret" })],
    ["mismatched workspace", validReadResponse({ workspace_id: OFFICE_ID })],
    ["mismatched membership", validReadResponse({ membership_id: OFFICE_ID })],
    ["blank status", validReadResponse({ status: " " })],
    ["non-string display name", validReadResponse({ display_name: 42 })],
    ["oversized display name", validReadResponse({ display_name: "x".repeat(10_001) })],
    ["control character in display name", validReadResponse({ display_name: "Ada\u0000Lovelace" })],
    ["invalid office UUID", validReadResponse({ office_id: "bad" })],
    ["unsafe revision", validReadResponse({ profile_revision: Number.MAX_SAFE_INTEGER + 1 })],
    ["negative revision", validReadResponse({ profile_revision: -1 })],
    ["invalid hours", validReadResponse({ base_working_hours: 24.001 })],
    ["null allocations", validReadResponse({ role_allocations: null })],
    ["allocation extra key", validReadResponse({
      role_allocations: [{
        business_role: "Engineering",
        percentage: 100,
        is_priority: true,
        private_detail: true,
      }],
    })],
  ])("rejects an exact read-response violation: %s", async (_label, data) => {
    const { client } = readClientWithResponse({ data, error: null });
    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("decodes legacy allocation invariants so the UI can review them fail-closed", async () => {
    const { client } = readClientWithResponse({
      data: validReadResponse({
        role_allocations: [
          { business_role: "Engineering", percentage: 60, is_priority: false },
          { business_role: "QA", percentage: 30, is_priority: false },
        ],
      }),
      error: null,
    });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).resolves.toMatchObject({
      roleAllocations: [
        { businessRole: "Engineering", percentage: 60, isPriority: false },
        { businessRole: "QA", percentage: 30, isPriority: false },
      ],
    });
  });

  it("preserves schema-valid legacy text and normalized-duplicate role names for remediation", async () => {
    const legacyLocation = `  ${"L".repeat(250)}\n`;
    const { client } = readClientWithResponse({
      data: validReadResponse({
        business_role: "  Engineering  ",
        location: legacyLocation,
        role_allocations: [
          { business_role: "Engineering", percentage: 50, is_priority: true },
          { business_role: "Ｅｎｇｉｎｅｅｒｉｎｇ", percentage: 50, is_priority: false },
        ],
      }),
      error: null,
    });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).resolves.toMatchObject({
      businessRole: "  Engineering  ",
      location: legacyLocation,
      roleAllocations: [
        { businessRole: "Engineering", percentage: 50, isPriority: true },
        { businessRole: "Ｅｎｇｉｎｅｅｒｉｎｇ", percentage: 50, isPriority: false },
      ],
    });
  });

  it("requires the profile_revision response key", async () => {
    const response = validReadResponse();
    const { profile_revision: _removed, ...missingRevision } = response;
    const { client } = readClientWithResponse({ data: missingRevision, error: null });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("requires the PII-minimal display_name response key", async () => {
    const response = validReadResponse();
    const { display_name: _removed, ...missingDisplayName } = response;
    const { client } = readClientWithResponse({ data: missingDisplayName, error: null });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("accepts a PII-minimal null name and preserves an exact self-name baseline", async () => {
    const { client: nonSelfClient } = readClientWithResponse({
      data: validReadResponse({ display_name: null }),
      error: null,
    });
    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, {
        client: nonSelfClient,
      }),
    ).resolves.toMatchObject({ displayName: null });

    const { client: selfClient } = readClientWithResponse({
      data: validReadResponse({ display_name: "  Ada Lovelace  " }),
      error: null,
    });
    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, {
        client: selfClient,
      }),
    ).resolves.toMatchObject({ displayName: "  Ada Lovelace  " });
  });

  it("maps raw backend details to a bounded read error", async () => {
    const { client } = readClientWithResponse({
      data: null,
      error: { message: "private tenant and policy detail" },
    });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, { client }),
    ).rejects.toMatchObject({
      code: "request-failed",
      message: "Workspace member profile load failed: request-failed",
    });
  });

  it("rejects a pre-aborted read without issuing an RPC", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, rpc } = readClientWithResponse({ data: validReadResponse(), error: null });

    await expect(
      loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, {
        client,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(WorkspaceMemberProfileReadError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("composes caller abort for an in-flight snapshot read", async () => {
    let forwardedSignal: AbortSignal | undefined;
    const pending = new Promise<{ data: unknown; error: unknown }>(() => undefined);
    const rpc = vi.fn(() => Object.assign(pending, {
      abortSignal: vi.fn((signal: AbortSignal) => {
        forwardedSignal = signal;
        return pending;
      }),
    }));
    const controller = new AbortController();
    const request = loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, {
      client: { rpc } as WorkspaceMemberProfileReadRpcClient,
      signal: controller.signal,
    });
    const assertion = expect(request).rejects.toMatchObject({ code: "aborted" });

    controller.abort();
    await assertion;
    expect(forwardedSignal?.aborted).toBe(true);
  });

  it("enforces the bounded snapshot-read timeout", async () => {
    vi.useFakeTimers();
    let forwardedSignal: AbortSignal | undefined;
    const pending = new Promise<{ data: unknown; error: unknown }>(() => undefined);
    const rpc = vi.fn(() => Object.assign(pending, {
      abortSignal: vi.fn((signal: AbortSignal) => {
        forwardedSignal = signal;
        return pending;
      }),
    }));
    const request = loadWorkspaceMemberProfileEditSnapshot(WORKSPACE_ID, MEMBERSHIP_ID, {
      client: { rpc } as WorkspaceMemberProfileReadRpcClient,
      timeoutMs: 25,
    });
    const assertion = expect(request).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(forwardedSignal?.aborted).toBe(true);
  });
});

describe("atomic workspace member profile save", () => {
  it("sends one canonical full-snapshot RPC payload and decodes its exact receipt", async () => {
    const { client, rpc } = saveClientWithResponse({
      data: validSaveResponse(),
      error: null,
    });

    await expect(saveWorkspaceMemberProfile(validSaveInput(), { client })).resolves.toEqual({
      ok: true,
      workspaceId: WORKSPACE_ID,
      membershipId: MEMBERSHIP_ID,
      profileRevision: PROFILE_REVISION + 1,
      changed: true,
      allocationCount: 2,
      displayNameUpdated: true,
      auditEventId: AUDIT_EVENT_ID,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_workspace_member_profile_v1", {
      p_workspace_id: WORKSPACE_ID,
      p_membership_id: MEMBERSHIP_ID,
      p_expected_profile_revision: PROFILE_REVISION,
      p_location: "Budapest HQ",
      p_city: "Budapest",
      p_office_id: OFFICE_ID,
      p_base_working_hours: 7.5,
      p_role_allocations: [
        { business_role: "Engineering", percentage: 60, is_priority: true },
        { business_role: "QA", percentage: 40, is_priority: false },
      ],
      p_display_name: "Ada Lovelace",
      p_expected_display_name: "Ada Byron",
    });
  });

  it("canonicalizes uppercase UUID input before payload and receipt correlation", async () => {
    const uppercaseWorkspaceId = "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF";
    const canonicalWorkspaceId = uppercaseWorkspaceId.toLowerCase();
    const input = {
      ...validSaveInput(),
      workspaceId: uppercaseWorkspaceId,
      membershipId: MEMBERSHIP_ID.toUpperCase(),
      officeId: OFFICE_ID.toUpperCase(),
    };
    const { client, rpc } = saveClientWithResponse({
      data: validSaveResponse({ workspace_id: canonicalWorkspaceId }),
      error: null,
    });

    await expect(saveWorkspaceMemberProfile(input, { client })).resolves.toMatchObject({
      workspaceId: canonicalWorkspaceId,
      membershipId: MEMBERSHIP_ID,
      profileRevision: PROFILE_REVISION + 1,
      auditEventId: AUDIT_EVENT_ID,
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workspace_member_profile_v1",
      expect.objectContaining({
        p_workspace_id: canonicalWorkspaceId,
        p_membership_id: MEMBERSHIP_ID,
        p_expected_profile_revision: PROFILE_REVISION,
        p_office_id: OFFICE_ID,
      }),
    );
  });

  it("supports creating a self name from an authoritative null baseline", async () => {
    const input = { ...validSaveInput(), expectedDisplayName: null };
    const { client, rpc } = saveClientWithResponse({
      data: validSaveResponse(),
      error: null,
    });

    await expect(saveWorkspaceMemberProfile(input, { client })).resolves.toMatchObject({
      displayNameUpdated: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workspace_member_profile_v1",
      expect.objectContaining({
        p_display_name: "Ada Lovelace",
        p_expected_display_name: null,
      }),
    );
  });

  it("preserves the exact authoritative display-name baseline for comparison", async () => {
    const input = { ...validSaveInput(), expectedDisplayName: "  Ada Byron  " };
    const { client, rpc } = saveClientWithResponse({
      data: validSaveResponse(),
      error: null,
    });

    await saveWorkspaceMemberProfile(input, { client });
    expect(rpc).toHaveBeenCalledWith(
      "save_workspace_member_profile_v1",
      expect.objectContaining({ p_expected_display_name: "  Ada Byron  " }),
    );
  });

  it("canonicalizes blank optional text to null and sends an explicit empty allocation snapshot", async () => {
    const input: SaveWorkspaceMemberProfileInput = {
      ...validSaveInput(),
      location: "   ",
      city: "\u2003",
      officeId: null,
      baseWorkingHours: 0,
      roleAllocations: [],
      displayName: null,
    };
    const { client, rpc } = saveClientWithResponse({
      data: validSaveResponse({ allocation_count: 0, display_name_updated: false }),
      error: null,
    });

    await expect(saveWorkspaceMemberProfile(input, { client })).resolves.toMatchObject({
      allocationCount: 0,
      displayNameUpdated: false,
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workspace_member_profile_v1",
      expect.objectContaining({
        p_location: null,
        p_city: null,
        p_office_id: null,
        p_base_working_hours: 0,
        p_role_allocations: [],
        p_display_name: null,
        p_expected_display_name: null,
      }),
    );
  });

  it("accepts the exact no-op receipt without fabricating an audit event", async () => {
    const { client } = saveClientWithResponse({
      data: validSaveResponse({
        changed: false,
        display_name_updated: false,
        audit_event_id: null,
        profile_revision: PROFILE_REVISION,
      }),
      error: null,
    });

    await expect(saveWorkspaceMemberProfile(validSaveInput(), { client })).resolves.toMatchObject({
      changed: false,
      profileRevision: PROFILE_REVISION,
      displayNameUpdated: false,
      auditEventId: null,
    });
  });

  it.each([
    ["null command", null],
    ["invalid workspace UUID", { workspaceId: "not-a-uuid" }],
    ["invalid membership UUID", { membershipId: "not-a-uuid" }],
    ["negative profile revision", { expectedProfileRevision: -1 }],
    ["fractional profile revision", { expectedProfileRevision: 1.5 }],
    ["unsafe profile revision", { expectedProfileRevision: Number.MAX_SAFE_INTEGER + 1 }],
    ["invalid office UUID", { officeId: "not-a-uuid" }],
    ["non-string location", { location: 12 }],
    ["oversized location", { location: "x".repeat(201) }],
    ["control character in city", { city: "Buda\nPest" }],
    ["negative working hours", { baseWorkingHours: -0.01 }],
    ["working hours above 24", { baseWorkingHours: 24.01 }],
    ["non-finite working hours", { baseWorkingHours: Number.NaN }],
    ["working hours with more than two decimals", { baseWorkingHours: 7.501 }],
    ["blank requested display name", { displayName: "   " }],
    ["oversized requested display name", { displayName: "x".repeat(201) }],
    ["control character in display name", { displayName: "Ada\u0000Lovelace" }],
    ["non-string expected display name", { expectedDisplayName: 42 }],
    ["oversized expected display name", { expectedDisplayName: "x".repeat(10_001) }],
    ["control character in expected display name", { expectedDisplayName: "Ada\u0000Byron" }],
    ["missing expected display name", { expectedDisplayName: undefined }],
    ["non-array allocation snapshot", { roleAllocations: {} }],
    [
      "non-NFKC allocation role",
      {
        roleAllocations: [{ businessRole: "Ｅngineering", percentage: 100, isPriority: true }],
      },
    ],
    [
      "too many allocations",
      {
        roleAllocations: Array.from({ length: 21 }, (_, index) => ({
          businessRole: `Role ${index}`,
          percentage: index === 0 ? 100 : 0,
          isPriority: index === 0,
        })),
      },
    ],
    [
      "allocation with an extra UI-only key",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 100, isPriority: true, locked: true },
        ],
      },
    ],
    [
      "blank role",
      { roleAllocations: [{ businessRole: " ", percentage: 100, isPriority: true }] },
    ],
    [
      "oversized role",
      {
        roleAllocations: [
          { businessRole: "x".repeat(201), percentage: 100, isPriority: true },
        ],
      },
    ],
    [
      "control character in role",
      {
        roleAllocations: [
          { businessRole: "Engineer\nLead", percentage: 100, isPriority: true },
        ],
      },
    ],
    [
      "duplicate canonical role",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 50, isPriority: true },
          { businessRole: " Engineering ", percentage: 50, isPriority: false },
        ],
      },
    ],
    [
      "case-insensitive normalized duplicate role",
      {
        roleAllocations: [
          { businessRole: "Developer", percentage: 50, isPriority: true },
          { businessRole: " developer ", percentage: 50, isPriority: false },
        ],
      },
    ],
    [
      "NFKC-equivalent duplicate role",
      {
        roleAllocations: [
          { businessRole: "Developer", percentage: 50, isPriority: true },
          { businessRole: "Ｄｅｖｅｌｏｐｅｒ", percentage: 50, isPriority: false },
        ],
      },
    ],
    [
      "non-finite percentage",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: Number.NaN, isPriority: true },
        ],
      },
    ],
    [
      "percentage outside range",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 100.01, isPriority: true },
        ],
      },
    ],
    [
      "percentage with more than two decimals",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 99.999, isPriority: true },
        ],
      },
    ],
    [
      "allocation total other than exactly 100.00",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 99.99, isPriority: true },
        ],
      },
    ],
    [
      "missing priority",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 100, isPriority: false },
        ],
      },
    ],
    [
      "multiple priorities",
      {
        roleAllocations: [
          { businessRole: "Engineering", percentage: 50, isPriority: true },
          { businessRole: "QA", percentage: 50, isPriority: true },
        ],
      },
    ],
  ])("rejects %s before issuing an RPC", async (_label, overrides) => {
    const { client, rpc } = saveClientWithResponse({ data: validSaveResponse(), error: null });
    const input =
      overrides === null
        ? (null as unknown as SaveWorkspaceMemberProfileInput)
        : ({ ...validSaveInput(), ...overrides } as SaveWorkspaceMemberProfileInput);

    await expectSaveError(input, "invalid-input", client);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["non-object payload", null],
    ["extra response key", validSaveResponse({ internal_detail: "private" })],
    ["missing response key", (() => {
      const response = validSaveResponse();
      const { audit_event_id: _removed, ...missingKey } = response;
      return missingKey;
    })()],
    ["false ok flag", validSaveResponse({ ok: false })],
    ["invalid workspace UUID", validSaveResponse({ workspace_id: "bad" })],
    ["mismatched workspace", validSaveResponse({ workspace_id: OFFICE_ID })],
    ["invalid membership UUID", validSaveResponse({ membership_id: "bad" })],
    ["mismatched membership", validSaveResponse({ membership_id: OFFICE_ID })],
    ["missing profile revision", (() => {
      const response = validSaveResponse();
      const { profile_revision: _removed, ...missingRevision } = response;
      return missingRevision;
    })()],
    ["negative profile revision", validSaveResponse({ profile_revision: -1 })],
    ["fractional profile revision", validSaveResponse({ profile_revision: 1.5 })],
    ["unsafe profile revision", validSaveResponse({ profile_revision: Number.MAX_SAFE_INTEGER + 1 })],
    ["changed receipt without revision advance", validSaveResponse({ profile_revision: PROFILE_REVISION })],
    ["non-boolean changed", validSaveResponse({ changed: "yes" })],
    ["NaN allocation count", validSaveResponse({ allocation_count: Number.NaN })],
    ["fractional allocation count", validSaveResponse({ allocation_count: 1.5 })],
    ["negative allocation count", validSaveResponse({ allocation_count: -1 })],
    ["mismatched allocation count", validSaveResponse({ allocation_count: 1 })],
    ["non-boolean display-name result", validSaveResponse({ display_name_updated: 1 })],
    ["invalid audit event UUID", validSaveResponse({ audit_event_id: "private" })],
    ["changed receipt without an audit event", validSaveResponse({ audit_event_id: null })],
    [
      "no-op receipt with an audit event",
      validSaveResponse({ changed: false, display_name_updated: false, profile_revision: PROFILE_REVISION }),
    ],
    [
      "no-op receipt claiming a display-name update",
      validSaveResponse({ changed: false, display_name_updated: true, audit_event_id: null, profile_revision: PROFILE_REVISION }),
    ],
    [
      "no-op receipt with revision advance",
      validSaveResponse({ changed: false, display_name_updated: false, audit_event_id: null }),
    ],
  ])("rejects an exact-response contract violation: %s", async (_label, data) => {
    const { client } = saveClientWithResponse({ data, error: null });
    await expectSaveError(validSaveInput(), "invalid-response", client);
  });

  it("rejects a display-name update claim when no name change was requested", async () => {
    const input = { ...validSaveInput(), displayName: null };
    const { client } = saveClientWithResponse({ data: validSaveResponse(), error: null });

    await expectSaveError(input, "invalid-response", client);
  });

  it("maps backend details to a bounded request-failed error", async () => {
    const { client } = saveClientWithResponse({
      data: null,
      error: { message: "private database policy and tenant identifiers" },
    });

    try {
      await saveWorkspaceMemberProfile(validSaveInput(), { client });
      throw new Error("expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceMemberProfileError);
      expect(error).toMatchObject({ code: "request-failed" });
      expect((error as Error).message).toBe(
        "Workspace member profile update failed: request-failed",
      );
      expect((error as Error).message).not.toContain("private");
    }
  });

  it.each(["40001", "40P01", "55P03"])(
    "maps retryable SQLSTATE %s to a bounded conflict without exposing backend details",
    async (code) => {
    const { client } = saveClientWithResponse({
      data: null,
      error: { code, message: "stale revision 7; current revision is 9" },
    });

    await expect(saveWorkspaceMemberProfile(validSaveInput(), { client })).rejects.toMatchObject({
      code: "conflict",
      message: "Workspace member profile update failed: conflict",
    });
    },
  );

  it("maps thrown transport details to the same bounded error", async () => {
    const rpc = vi.fn(() => Promise.reject(new Error("secret upstream response")));

    await expect(
      saveWorkspaceMemberProfile(validSaveInput(), {
        client: { rpc } as SaveWorkspaceMemberProfileRpcClient,
      }),
    ).rejects.toMatchObject({
      code: "request-failed",
      message: "Workspace member profile update failed: request-failed",
    });
  });

  it("rejects a pre-aborted caller signal without issuing an RPC", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, rpc } = saveClientWithResponse({ data: validSaveResponse(), error: null });

    await expect(
      saveWorkspaceMemberProfile(validSaveInput(), { client, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("composes and forwards an in-flight caller AbortSignal", async () => {
    let forwardedSignal: AbortSignal | undefined;
    const pending = new Promise<{ data: unknown; error: unknown }>(() => undefined);
    const rpc = vi.fn(() =>
      Object.assign(pending, {
        abortSignal: vi.fn((signal: AbortSignal) => {
          forwardedSignal = signal;
          return pending;
        }),
      }),
    );
    const controller = new AbortController();
    const request = saveWorkspaceMemberProfile(validSaveInput(), {
      client: { rpc } as SaveWorkspaceMemberProfileRpcClient,
      signal: controller.signal,
    });
    const assertion = expect(request).rejects.toMatchObject({ code: "aborted" });

    controller.abort();
    await assertion;
    expect(forwardedSignal?.aborted).toBe(true);
  });

  it("enforces the bounded timeout and forwards the composed signal", async () => {
    vi.useFakeTimers();
    let forwardedSignal: AbortSignal | undefined;
    const pending = new Promise<{ data: unknown; error: unknown }>(() => undefined);
    const rpc = vi.fn(() =>
      Object.assign(pending, {
        abortSignal: vi.fn((signal: AbortSignal) => {
          forwardedSignal = signal;
          return pending;
        }),
      }),
    );
    const request = saveWorkspaceMemberProfile(validSaveInput(), {
      client: { rpc } as SaveWorkspaceMemberProfileRpcClient,
      timeoutMs: 25,
    });
    const assertion = expect(request).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(forwardedSignal?.aborted).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid timeout %s without issuing an RPC",
    async (timeoutMs) => {
      const { client, rpc } = saveClientWithResponse({ data: validSaveResponse(), error: null });
      await expect(
        saveWorkspaceMemberProfile(validSaveInput(), { client, timeoutMs }),
      ).rejects.toMatchObject({ code: "invalid-input" });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
});
