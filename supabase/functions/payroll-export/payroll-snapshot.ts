import { isUuid, normalizeCurrency } from "./payroll-contract.ts";

export const PAYROLL_SNAPSHOT_VERSION = 1;

export interface PayrollMemberCalculation {
  membership_id: string;
  display_name: string;
  regular_hours: number;
  overtime_hours: number;
  leave_days: number;
  gross_estimate: number;
  currency: string;
}

export interface PayrollTotals {
  total_hours: number;
  total_overtime: number;
  total_gross: number;
  member_count: number;
}

export interface PayrollSnapshotPeriod {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "locked";
}

export interface PayrollSnapshotPayload {
  version: typeof PAYROLL_SNAPSHOT_VERSION;
  period: PayrollSnapshotPeriod;
  members: PayrollMemberCalculation[];
  totals: PayrollTotals;
}

export interface PayrollSnapshot extends PayrollSnapshotPayload {
  hash: string;
}

export interface StoredPayrollPeriodExpectation {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  calculation_snapshot: unknown;
  calculation_hash: string | null;
  calculation_version: number | null;
}

export class PayrollSnapshotError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PAYROLL_SNAPSHOT_MISSING"
      | "PAYROLL_SNAPSHOT_INVALID",
  ) {
    super(message);
    this.name = "PayrollSnapshotError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new PayrollSnapshotError(
      `${label} must be an object`,
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new PayrollSnapshotError(
      `${label} has an unexpected shape`,
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return value;
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new PayrollSnapshotError(
      `${label} must be a finite non-negative number`,
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new PayrollSnapshotError(
      "Snapshot contains a non-finite number",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return value;
}

export function canonicalPayrollJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function payrollSnapshotHash(
  payload: PayrollSnapshotPayload,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalPayrollJson(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseMember(value: unknown): PayrollMemberCalculation {
  const member = requireExactKeys(value, [
    "membership_id",
    "display_name",
    "regular_hours",
    "overtime_hours",
    "leave_days",
    "gross_estimate",
    "currency",
  ], "Payroll snapshot member");
  if (!isUuid(member.membership_id)) {
    throw new PayrollSnapshotError(
      "Snapshot member has an invalid membership id",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  if (typeof member.display_name !== "string" || !member.display_name.trim()) {
    throw new PayrollSnapshotError(
      "Snapshot member has an invalid display name",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const leaveDays = finiteNonNegative(member.leave_days, "leave_days");
  if (!Number.isSafeInteger(leaveDays)) {
    throw new PayrollSnapshotError(
      "leave_days must be a non-negative integer",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  let currency: string;
  try {
    currency = normalizeCurrency(member.currency);
  } catch (error) {
    throw new PayrollSnapshotError(
      error instanceof Error ? error.message : "Invalid payroll currency",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  if (currency !== member.currency) {
    throw new PayrollSnapshotError(
      "Snapshot currency must use normalized ISO format",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }

  return {
    membership_id: member.membership_id,
    display_name: member.display_name,
    regular_hours: finiteNonNegative(member.regular_hours, "regular_hours"),
    overtime_hours: finiteNonNegative(member.overtime_hours, "overtime_hours"),
    leave_days: leaveDays,
    gross_estimate: finiteNonNegative(member.gross_estimate, "gross_estimate"),
    currency,
  };
}

function parseTotals(value: unknown, members: PayrollMemberCalculation[]): PayrollTotals {
  const totals = requireExactKeys(value, [
    "total_hours",
    "total_overtime",
    "total_gross",
    "member_count",
  ], "Payroll snapshot totals");
  const memberCount = finiteNonNegative(totals.member_count, "member_count");
  if (!Number.isSafeInteger(memberCount) || memberCount !== members.length) {
    throw new PayrollSnapshotError(
      "Snapshot member_count does not match members",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const parsed: PayrollTotals = {
    total_hours: finiteNonNegative(totals.total_hours, "total_hours"),
    total_overtime: finiteNonNegative(totals.total_overtime, "total_overtime"),
    total_gross: finiteNonNegative(totals.total_gross, "total_gross"),
    member_count: memberCount,
  };
  const expected = {
    total_hours: roundMoney(
      members.reduce(
        (sum, member) => sum + member.regular_hours + member.overtime_hours,
        0,
      ),
    ),
    total_overtime: roundMoney(
      members.reduce((sum, member) => sum + member.overtime_hours, 0),
    ),
    total_gross: roundMoney(
      members.reduce((sum, member) => sum + member.gross_estimate, 0),
    ),
    member_count: members.length,
  };
  if (canonicalPayrollJson(parsed) !== canonicalPayrollJson(expected)) {
    throw new PayrollSnapshotError(
      "Snapshot totals do not match member calculations",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return parsed;
}

function parsePayload(value: unknown): PayrollSnapshotPayload {
  const snapshot = requireExactKeys(value, [
    "version",
    "period",
    "members",
    "totals",
  ], "Payroll snapshot payload");
  if (snapshot.version !== PAYROLL_SNAPSHOT_VERSION) {
    throw new PayrollSnapshotError(
      "Unsupported payroll snapshot version",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const period = requireExactKeys(snapshot.period, [
    "id",
    "workspace_id",
    "name",
    "start_date",
    "end_date",
    "status",
  ], "Payroll snapshot period");
  if (
    !isUuid(period.id) || !isUuid(period.workspace_id) ||
    typeof period.name !== "string" || !period.name.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(period.start_date)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(period.end_date)) ||
    period.status !== "locked"
  ) {
    throw new PayrollSnapshotError(
      "Snapshot period metadata is invalid",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  if (!Array.isArray(snapshot.members)) {
    throw new PayrollSnapshotError(
      "Payroll snapshot members must be an array",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const members = snapshot.members.map(parseMember);
  const sortedIds = members.map((member) => member.membership_id);
  if (
    new Set(sortedIds).size !== sortedIds.length ||
    JSON.stringify(sortedIds) !== JSON.stringify([...sortedIds].sort())
  ) {
    throw new PayrollSnapshotError(
      "Snapshot members must be unique and sorted by membership id",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return {
    version: PAYROLL_SNAPSHOT_VERSION,
    period: {
      id: period.id,
      workspace_id: period.workspace_id,
      name: period.name,
      start_date: period.start_date as string,
      end_date: period.end_date as string,
      status: "locked",
    },
    members,
    totals: parseTotals(snapshot.totals, members),
  };
}

export async function createPayrollSnapshot(
  period: Omit<PayrollSnapshotPeriod, "status">,
  members: readonly PayrollMemberCalculation[],
  totals: PayrollTotals,
): Promise<PayrollSnapshot> {
  const payload = parsePayload({
    version: PAYROLL_SNAPSHOT_VERSION,
    period: { ...period, status: "locked" },
    members: [...members].sort((left, right) =>
      left.membership_id < right.membership_id
        ? -1
        : left.membership_id > right.membership_id
        ? 1
        : 0
    ),
    totals,
  });
  return { ...payload, hash: await payrollSnapshotHash(payload) };
}

export function payrollSnapshotCanonicalPayload(
  snapshot: PayrollSnapshot,
): string {
  return canonicalPayrollJson({
    version: snapshot.version,
    period: snapshot.period,
    members: snapshot.members,
    totals: snapshot.totals,
  });
}

export async function parseStoredPayrollSnapshot(
  expected: StoredPayrollPeriodExpectation,
): Promise<PayrollSnapshot> {
  if (
    expected.calculation_snapshot == null ||
    expected.calculation_hash == null ||
    expected.calculation_version == null
  ) {
    throw new PayrollSnapshotError(
      "Locked payroll period has no calculation snapshot",
      "PAYROLL_SNAPSHOT_MISSING",
    );
  }
  if (expected.status !== "locked" && expected.status !== "exported") {
    throw new PayrollSnapshotError(
      "Stored snapshots are only valid for locked or exported periods",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const snapshot = requireExactKeys(expected.calculation_snapshot, [
    "version",
    "hash",
    "period",
    "members",
    "totals",
  ], "Stored payroll snapshot");
  if (
    typeof snapshot.hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(snapshot.hash) ||
    snapshot.hash !== expected.calculation_hash ||
    snapshot.version !== expected.calculation_version
  ) {
    throw new PayrollSnapshotError(
      "Stored payroll snapshot metadata does not match its columns",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const payload = parsePayload({
    version: snapshot.version,
    period: snapshot.period,
    members: snapshot.members,
    totals: snapshot.totals,
  });
  if (
    payload.period.id !== expected.id ||
    payload.period.workspace_id !== expected.workspace_id ||
    payload.period.name !== expected.name ||
    payload.period.start_date !== expected.start_date ||
    payload.period.end_date !== expected.end_date
  ) {
    throw new PayrollSnapshotError(
      "Stored payroll snapshot period metadata no longer matches its row",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  const calculatedHash = await payrollSnapshotHash(payload);
  if (calculatedHash !== snapshot.hash) {
    throw new PayrollSnapshotError(
      "Stored payroll snapshot hash verification failed",
      "PAYROLL_SNAPSHOT_INVALID",
    );
  }
  return { ...payload, hash: snapshot.hash };
}
