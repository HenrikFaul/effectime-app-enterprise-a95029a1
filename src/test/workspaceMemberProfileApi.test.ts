import { afterEach, describe, expect, it, vi } from "vitest";
import {
  updateMyWorkspaceProfileDisplayName,
  type WorkspaceMemberProfileRpcClient,
} from "@/lib/workspaceMemberProfileApi";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "a1000000-0000-4000-8000-000000000001";

function clientWithResponse(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  return { client: { rpc } as WorkspaceMemberProfileRpcClient, rpc };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("workspace member profile API", () => {
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
