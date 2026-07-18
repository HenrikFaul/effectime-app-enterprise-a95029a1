import type { Json } from "../../../src/integrations/supabase/types.ts";

export const PAYROLL_CSV_PROVIDERS = [
  "generic",
  "datev",
  "bamboohr",
  "personio",
  "sap",
  "workday",
  "adp",
  "sage",
  "billingo",
  "szamlazz",
  "pohoda",
] as const;

export type PayrollCsvProvider = (typeof PAYROLL_CSV_PROVIDERS)[number];

export interface AttendanceMonthKey {
  year: number;
  month: number;
}

export interface MemberRateRow {
  membership_id: string;
  cost_rate: number;
  currency: string;
}

export interface MemberRate {
  costRate: number;
  currency: string;
}

export interface PayrollCsvMember {
  membership_id: string;
  display_name: string;
  regular_hours: number;
  overtime_hours: number;
  leave_days: number;
  gross_estimate: number;
  currency: string;
}

// Combined with 100 UUIDs per attendance query, 24 exact month predicates
// keep the encoded PostgREST URL comfortably below common 8 KiB proxy limits.
export const MAX_ATTENDANCE_MONTHS = 24;
export const PAYROLL_MEMBERSHIP_BATCH_SIZE = 100;
const ATTENDANCE_HOUR_KEYS = [
  "payroll_total_hours",
  "worked_hours",
  "regular_hours",
] as const;

function parseIsoDate(
  value: string,
): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Payroll period dates must use YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (
    year < 1 || month < 1 || month > 12 || day < 1 ||
    day > daysInMonth[month - 1]
  ) {
    throw new Error("Payroll period contains an invalid calendar date");
  }
  return { year, month, day };
}

/**
 * Return every attendance (year, month) key touched by an inclusive ISO date
 * range. Integer-only output makes the values safe to interpolate into a
 * PostgREST filter, including ranges that cross a year boundary.
 */
export function attendanceMonthKeys(
  startIso: string,
  endIso: string,
): AttendanceMonthKey[] {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const startDay = start.year * 10_000 + start.month * 100 + start.day;
  const endDay = end.year * 10_000 + end.month * 100 + end.day;
  if (endDay < startDay) {
    throw new Error("Payroll period end date precedes its start date");
  }

  const firstMonth = start.year * 12 + start.month - 1;
  const lastMonth = end.year * 12 + end.month - 1;
  const monthCount = lastMonth - firstMonth + 1;
  if (monthCount > MAX_ATTENDANCE_MONTHS) {
    throw new Error(
      `Payroll period spans more than ${MAX_ATTENDANCE_MONTHS} attendance months`,
    );
  }

  return Array.from({ length: monthCount }, (_, offset) => {
    const monthIndex = firstMonth + offset;
    return {
      year: Math.floor(monthIndex / 12),
      month: monthIndex % 12 + 1,
    };
  });
}

export function attendanceMonthOrFilter(
  startIso: string,
  endIso: string,
): string {
  return attendanceMonthKeys(startIso, endIso)
    .map(({ year, month }) => `and(year.eq.${year},month.eq.${month})`)
    .join(",");
}

/** Resolve attendance totals in canonical-to-legacy order. */
export function attendanceHours(totals: Json): number {
  if (typeof totals !== "object" || totals === null || Array.isArray(totals)) {
    return 0;
  }

  for (const key of ATTENDANCE_HOUR_KEYS) {
    const value = totals[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return 0;
}

/** Keep cost and currency from the same, already newest-first rate row. */
export function latestMemberRateMap(
  rows: readonly MemberRateRow[],
): Map<string, MemberRate> {
  const rates = new Map<string, MemberRate>();
  for (const row of rows) {
    if (rates.has(row.membership_id)) continue;
    const costRate = Number(row.cost_rate);
    if (!Number.isFinite(costRate) || costRate < 0) {
      throw new Error("Payroll cost rate must be a finite non-negative number");
    }
    rates.set(row.membership_id, {
      costRate,
      currency: normalizeCurrency(row.currency),
    });
  }
  return rates;
}

export function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Payroll currency must be a three-letter code");
  }
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Payroll currency must be a three-letter code");
  }
  return currency;
}

export function parseBaseWorkingHours(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Base working hours must be a finite non-negative number");
  }
  return value;
}

export function payrollCsvProvider(value: unknown): PayrollCsvProvider | null {
  return typeof value === "string" &&
      PAYROLL_CSV_PROVIDERS.includes(value as PayrollCsvProvider)
    ? value as PayrollCsvProvider
    : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
}

function exactObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return JSON.stringify(actual) === JSON.stringify(expected) ? record : null;
}

export function isPayrollLockRpcResult(
  value: unknown,
  expected: { periodId: string; hash: string; version: number },
): boolean {
  const result = exactObject(value, [
    "ok",
    "period_id",
    "status",
    "snapshot_hash",
    "snapshot_version",
  ]);
  return result !== null &&
    result.ok === true &&
    result.period_id === expected.periodId &&
    result.status === "locked" &&
    result.snapshot_hash === expected.hash &&
    result.snapshot_version === expected.version;
}

export function isPayrollExportRpcResult(
  value: unknown,
  expected: {
    periodId: string;
    provider: PayrollCsvProvider;
    hash: string;
    version: number;
  },
): boolean {
  const result = exactObject(value, [
    "ok",
    "period_id",
    "status",
    "provider",
    "snapshot_hash",
    "snapshot_version",
  ]);
  return result !== null &&
    result.ok === true &&
    result.period_id === expected.periodId &&
    result.status === "exported" &&
    result.provider === expected.provider &&
    result.snapshot_hash === expected.hash &&
    result.snapshot_version === expected.version;
}

/** Quote user-controlled CSV text and neutralize spreadsheet formulas. */
export function csvTextCell(value: string): string {
  const neutralized = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export function buildPayrollCsv(
  members: readonly PayrollCsvMember[],
  period: { name: string; start_date: string; end_date: string },
  provider: PayrollCsvProvider,
): string {
  const { name: periodName, start_date: periodStart, end_date: periodEnd } = period;
  const lines: string[] = [];

  switch (provider) {
    case "datev": {
      lines.push("Personalnummer;Name;Zeitraum;Normalstunden;Überstunden;Urlaubstage;Bruttolohn;Währung");
      for (const member of members) {
        lines.push([
          member.membership_id,
          csvTextCell(member.display_name),
          csvTextCell(periodName),
          String(member.regular_hours).replace(".", ","),
          String(member.overtime_hours).replace(".", ","),
          String(member.leave_days),
          String(member.gross_estimate).replace(".", ","),
          csvTextCell(normalizeCurrency(member.currency)),
        ].join(";"));
      }
      break;
    }
    case "bamboohr": {
      lines.push("Employee ID,Employee Name,Period,Regular Hours,Overtime Hours,Leave Days");
      for (const member of members) {
        lines.push([
          member.membership_id,
          csvTextCell(member.display_name),
          csvTextCell(periodName),
          String(member.regular_hours),
          String(member.overtime_hours),
          String(member.leave_days),
        ].join(","));
      }
      break;
    }
    case "personio": {
      lines.push("employee_id,name,period_start,period_end,hours,overtime,absences,gross");
      for (const member of members) {
        lines.push([
          member.membership_id,
          csvTextCell(member.display_name),
          periodStart,
          periodEnd,
          String(member.regular_hours),
          String(member.overtime_hours),
          String(member.leave_days),
          String(member.gross_estimate),
        ].join(","));
      }
      break;
    }
    case "sap":
    case "workday":
    case "adp":
    case "sage":
    case "billingo":
    case "szamlazz":
    case "pohoda":
    case "generic": {
      lines.push("ID,Name,Period Start,Period End,Regular Hours,Overtime Hours,Leave Days,Gross Estimate,Currency");
      for (const member of members) {
        lines.push([
          member.membership_id,
          csvTextCell(member.display_name),
          periodStart,
          periodEnd,
          String(member.regular_hours),
          String(member.overtime_hours),
          String(member.leave_days),
          String(member.gross_estimate),
          csvTextCell(normalizeCurrency(member.currency)),
        ].join(","));
      }
      break;
    }
  }
  return lines.join("\n");
}
