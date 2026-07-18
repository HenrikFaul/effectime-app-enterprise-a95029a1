import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const auditLogSource = readFileSync(
  join(process.cwd(), "src", "components", "enterprise", "AuditLog.tsx"),
  "utf8",
);

const allowedAuditEventColumns = [
  "id",
  "action",
  "actor_id",
  "affected_user_id",
  "created_at",
  "metadata",
];

describe("AuditLog client-side data minimization contract", () => {
  it("requests only the fields rendered by the audit log", () => {
    const auditSelect = auditLogSource.match(
      /\.from\(['"]enterprise_audit_events['"]\)\s*\.select\(\s*(['"])([^'"]+)\1\s*\)/s,
    );

    expect(auditSelect).not.toBeNull();

    const selectedColumns = auditSelect![2].split(",").map((column) => column.trim());
    expect(selectedColumns).toEqual(allowedAuditEventColumns);
  });

  it("does not expose the full audit row or protected state snapshots to the browser", () => {
    expect(auditLogSource).not.toMatch(
      /\.from\(['"]enterprise_audit_events['"]\)\s*\.select\(\s*['"]\*['"]\s*\)/s,
    );
    expect(allowedAuditEventColumns).not.toContain("prev_state");
    expect(allowedAuditEventColumns).not.toContain("new_state");
    expect(allowedAuditEventColumns).not.toContain("ip_address");
    expect(allowedAuditEventColumns).not.toContain("user_agent");
  });
});
