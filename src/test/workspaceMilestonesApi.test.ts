import { describe, expect, it, vi } from "vitest";
import {
  loadWorkspaceMemberMilestones,
  WorkspaceMilestonesError,
  type WorkspaceMilestonesRpcClient,
} from "@/lib/workspaceMilestonesApi";

const WORKSPACE_ID = "10000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID = "20000000-0000-4000-8000-000000000001";
const VALID_ROW = {
  membership_id: MEMBERSHIP_ID,
  display_name: "  Ada Lovelace  ",
  milestone_type: "birthday",
  milestone_month: 12,
  milestone_day: 10,
};

function clientReturning(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => Promise.resolve({ data, error }));
  return { client: { rpc } as unknown as WorkspaceMilestonesRpcClient, rpc };
}

async function expectCode(promise: Promise<unknown>, code: WorkspaceMilestonesError["code"]) {
  await expect(promise).rejects.toMatchObject({
    name: "WorkspaceMilestonesError",
    code,
  });
}

describe("loadWorkspaceMemberMilestones", () => {
  it("calls only the versioned milestone RPC and decodes its minimal response", async () => {
    const { client, rpc } = clientReturning([VALID_ROW]);

    await expect(loadWorkspaceMemberMilestones(WORKSPACE_ID, { client })).resolves.toEqual([
      {
        membershipId: MEMBERSHIP_ID,
        displayName: "Ada Lovelace",
        type: "birthday",
        month: 12,
        day: 10,
      },
    ]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_workspace_member_milestones_v1", {
      p_workspace_id: WORKSPACE_ID,
    });
  });

  it("rejects an invalid workspace id before issuing a request", async () => {
    const { client, rpc } = clientReturning([]);

    await expectCode(
      loadWorkspaceMemberMilestones("not-a-workspace-id", { client }),
      "invalid-workspace-id",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps backend failures to a non-sensitive request error", async () => {
    const { client } = clientReturning(null, {
      message: "token=must-not-escape",
      details: "private database details",
    });

    const request = loadWorkspaceMemberMilestones(WORKSPACE_ID, { client });
    await expectCode(request, "request-failed");
    await expect(request).rejects.not.toThrow(/token|private database/i);
  });

  it.each([
    ["a non-array payload", { ...VALID_ROW }],
    ["an unexpected sensitive field", [{ ...VALID_ROW, preferences: { birthday: "1990-01-01" } }]],
    ["a null calendar day", [{ ...VALID_ROW, milestone_day: null }]],
    ["an impossible calendar date", [{ ...VALID_ROW, milestone_month: 4, milestone_day: 31 }]],
    ["an unknown milestone type", [{ ...VALID_ROW, milestone_type: "hire_date" }]],
    [
      "a duplicate membership",
      [VALID_ROW, { ...VALID_ROW, display_name: "Another representation" }],
    ],
  ])("fails closed for %s", async (_label, data) => {
    const { client } = clientReturning(data);
    await expectCode(loadWorkspaceMemberMilestones(WORKSPACE_ID, { client }), "invalid-response");
  });

  it("accepts both distinct milestone types for one membership and normalizes an empty name", async () => {
    const { client } = clientReturning([
      {
        ...VALID_ROW,
        display_name: "   ",
      },
      {
        ...VALID_ROW,
        milestone_type: "anniversary",
        milestone_month: 2,
        milestone_day: 29,
      },
    ]);

    await expect(loadWorkspaceMemberMilestones(WORKSPACE_ID, { client })).resolves.toEqual([
      {
        membershipId: MEMBERSHIP_ID,
        displayName: null,
        type: "birthday",
        month: 12,
        day: 10,
      },
      {
        membershipId: MEMBERSHIP_ID,
        displayName: "Ada Lovelace",
        type: "anniversary",
        month: 2,
        day: 29,
      },
    ]);
  });

  it("aborts a request when the caller scope is invalidated", async () => {
    const abortController = new AbortController();
    const client = {
      rpc: vi.fn(() => new Promise<never>(() => undefined)),
    } as unknown as WorkspaceMilestonesRpcClient;

    const request = loadWorkspaceMemberMilestones(WORKSPACE_ID, {
      client,
      signal: abortController.signal,
      timeoutMs: 1_000,
    });
    abortController.abort();

    await expectCode(request, "aborted");
  });

  it("times out a request that never settles", async () => {
    const client = {
      rpc: vi.fn(() => new Promise<never>(() => undefined)),
    } as unknown as WorkspaceMilestonesRpcClient;

    await expectCode(
      loadWorkspaceMemberMilestones(WORKSPACE_ID, { client, timeoutMs: 5 }),
      "timeout",
    );
  });
});
