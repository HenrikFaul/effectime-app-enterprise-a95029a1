import { describe, expect, it } from "vitest";
import { resolveCanInviteMembers } from "@/components/enterprise/WorkspaceDashboard";

describe("workspace member invitation entitlement", () => {
  it("denies invitation when members_list is available but members_invite is disabled", () => {
    expect(
      resolveCanInviteMembers({
        isAdmin: true,
        featureAccessAvailable: true,
        membersTabEntitled: true,
        membersInviteEnabled: false,
      }),
    ).toBe(false);
  });

  it("allows an administrator when both the members tab and exact invite feature are enabled", () => {
    expect(
      resolveCanInviteMembers({
        isAdmin: true,
        featureAccessAvailable: true,
        membersTabEntitled: true,
        membersInviteEnabled: true,
      }),
    ).toBe(true);
  });

  it("fails closed during an entitlement outage even if the last feature values were enabled", () => {
    expect(
      resolveCanInviteMembers({
        isAdmin: true,
        featureAccessAvailable: false,
        membersTabEntitled: true,
        membersInviteEnabled: true,
      }),
    ).toBe(false);
  });

  it("preserves the workspace administrator role boundary", () => {
    expect(
      resolveCanInviteMembers({
        isAdmin: false,
        featureAccessAvailable: true,
        membersTabEntitled: true,
        membersInviteEnabled: true,
      }),
    ).toBe(false);
  });
});
