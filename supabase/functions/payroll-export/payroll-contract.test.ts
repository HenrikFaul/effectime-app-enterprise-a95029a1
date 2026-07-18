import {
  attendanceHours,
  attendanceMonthKeys,
  attendanceMonthOrFilter,
  buildPayrollCsv,
  csvTextCell,
  isUuid,
  isPayrollExportRpcResult,
  isPayrollLockRpcResult,
  latestMemberRateMap,
  parseBaseWorkingHours,
  payrollCsvProvider,
} from "./payroll-contract.ts";
import {
  createPayrollSnapshot,
  parseStoredPayrollSnapshot,
  payrollSnapshotCanonicalPayload,
  PayrollSnapshotError,
} from "./payroll-snapshot.ts";
import { fetchAllPayrollRows } from "./pagination.ts";

function assertEquals(
  actual: unknown,
  expected: unknown,
  message?: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message ??
        `Expected ${JSON.stringify(expected)}, received ${
          JSON.stringify(actual)
        }`,
    );
  }
}

function assertThrows(fn: () => unknown, expectedMessage: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected an error containing: ${expectedMessage}`);
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) return;
    throw error;
  }
  throw new Error(`Expected a rejection containing: ${expectedMessage}`);
}

Deno.test("attendance month keys stay exact across a year boundary", () => {
  assertEquals(attendanceMonthKeys("2025-12-20", "2026-02-03"), [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ]);
  assertEquals(
    attendanceMonthOrFilter("2025-12-20", "2026-01-03"),
    "and(year.eq.2025,month.eq.12),and(year.eq.2026,month.eq.1)",
  );
});

Deno.test("attendance month keys reject malformed, impossible and reversed dates", () => {
  assertThrows(
    () => attendanceMonthKeys("2026-2-01", "2026-02-28"),
    "YYYY-MM-DD",
  );
  assertThrows(
    () => attendanceMonthKeys("2026-02-30", "2026-03-01"),
    "invalid calendar date",
  );
  assertThrows(
    () => attendanceMonthKeys("2026-03-01", "2026-02-28"),
    "precedes",
  );
  assertThrows(
    () => attendanceMonthKeys("2024-01-01", "2026-01-01"),
    "more than 24 attendance months",
  );
});

Deno.test("attendance hours use canonical then compatible legacy totals", () => {
  assertEquals(
    attendanceHours({
      payroll_total_hours: 7,
      worked_hours: 6,
      regular_hours: 5,
    }),
    7,
  );
  assertEquals(attendanceHours({ worked_hours: "6.5", regular_hours: 5 }), 5);
  assertEquals(attendanceHours({ regular_hours: 4 }), 4);
  assertEquals(
    attendanceHours({ payroll_total_hours: "6.5", worked_hours: 3 }),
    3,
  );
  assertEquals(
    attendanceHours({ payroll_total_hours: -1, worked_hours: 2 }),
    2,
  );
  assertEquals(
    attendanceHours({ payroll_total_hours: NaN, regular_hours: 1 }),
    1,
  );
  assertEquals(
    attendanceHours({ payroll_total_hours: true, worked_hours: 2 }),
    2,
  );
  assertEquals(attendanceHours(null), 0);
});

Deno.test("latest member rates keep cost and currency from the same newest row", () => {
  const rates = latestMemberRateMap([
    { membership_id: "member-1", cost_rate: 25, currency: "HUF" },
    { membership_id: "member-1", cost_rate: 20, currency: "EUR" },
    { membership_id: "member-2", cost_rate: 30, currency: " USD " },
  ]);

  assertEquals(rates.get("member-1"), { costRate: 25, currency: "HUF" });
  assertEquals(rates.get("member-2"), { costRate: 30, currency: "USD" });
});

Deno.test("currency normalization is uppercase and fails closed for formulas", () => {
  const rates = latestMemberRateMap([
    { membership_id: "member-1", cost_rate: 10, currency: " usd " },
  ]);
  assertEquals(rates.get("member-1"), { costRate: 10, currency: "USD" });
  assertThrows(
    () => latestMemberRateMap([
      { membership_id: "member-1", cost_rate: 10, currency: "=US" },
    ]),
    "three-letter code",
  );
  assertThrows(
    () => latestMemberRateMap([
      { membership_id: "member-1", cost_rate: -1, currency: "EUR" },
    ]),
    "finite non-negative",
  );
});

Deno.test("zero base working hours remain zero and invalid values fail closed", () => {
  assertEquals(parseBaseWorkingHours(0), 0);
  assertEquals(parseBaseWorkingHours(8), 8);
  assertThrows(() => parseBaseWorkingHours(-1), "finite non-negative");
  assertThrows(() => parseBaseWorkingHours(Number.NaN), "finite non-negative");
  assertThrows(() => parseBaseWorkingHours("8"), "finite non-negative");
});

Deno.test("CSV provider selection is an exact allowlist", () => {
  assertEquals(payrollCsvProvider("generic"), "generic");
  assertEquals(payrollCsvProvider("datev"), "datev");
  assertEquals(payrollCsvProvider("sap"), "sap");
  assertEquals(payrollCsvProvider("workday"), "workday");
  assertEquals(payrollCsvProvider("adp"), "adp");
  assertEquals(payrollCsvProvider("sage"), "sage");
  assertEquals(payrollCsvProvider("billingo"), "billingo");
  assertEquals(payrollCsvProvider("szamlazz"), "szamlazz");
  assertEquals(payrollCsvProvider("pohoda"), "pohoda");
  assertEquals(payrollCsvProvider("DATEV"), null);
  assertEquals(payrollCsvProvider("../../datev"), null);
  assertEquals(payrollCsvProvider(null), null);
});

Deno.test("payroll identifiers require canonical UUID text", () => {
  assertEquals(isUuid("22ad500a-1782-7333-7128-63558cd00001"), true);
  assertEquals(isUuid("22AD500A-1782-7333-7128-63558CD00001"), true);
  assertEquals(isUuid("workspace-1"), false);
  assertEquals(isUuid({ id: "22ad500a-1782-7333-7128-63558cd00001" }), false);
});

Deno.test("atomic payroll RPC responses are strict and bound to expectations", () => {
  const periodId = "22ad500a-1782-7333-7128-63558cd00001";
  const hash = "a".repeat(64);
  const lock = {
    ok: true,
    period_id: periodId,
    status: "locked",
    snapshot_hash: hash,
    snapshot_version: 1,
  };
  assertEquals(isPayrollLockRpcResult(lock, { periodId, hash, version: 1 }), true);
  assertEquals(isPayrollLockRpcResult({ ...lock, snapshot_hash: "b".repeat(64) }, {
    periodId,
    hash,
    version: 1,
  }), false);
  assertEquals(isPayrollLockRpcResult({ ...lock, unexpected: true }, {
    periodId,
    hash,
    version: 1,
  }), false);

  const exported = {
    ...lock,
    status: "exported",
    provider: "generic",
  };
  assertEquals(isPayrollExportRpcResult(exported, {
    periodId,
    provider: "generic",
    hash,
    version: 1,
  }), true);
  assertEquals(isPayrollExportRpcResult({ ...exported, provider: "datev" }, {
    periodId,
    provider: "generic",
    hash,
    version: 1,
  }), false);
});

Deno.test("CSV text escaping quotes cells and neutralizes spreadsheet formulas", () => {
  assertEquals(csvTextCell('Ada "Payroll"'), '"Ada ""Payroll"""');
  assertEquals(
    csvTextCell('=HYPERLINK("https://example.test")'),
    '"\'=HYPERLINK(""https://example.test"")"',
  );
  assertEquals(csvTextCell("  +SUM(1,1)"), '"\'  +SUM(1,1)"');
  assertEquals(csvTextCell("Normal name"), '"Normal name"');
});

Deno.test("CSV currency cells are normalized and quoted", () => {
  const member = {
    membership_id: "22ad500a-1782-7333-7128-63558cd00001",
    display_name: "Ada",
    regular_hours: 8,
    overtime_hours: 0,
    leave_days: 0,
    gross_estimate: 80,
    currency: " eur ",
  };
  const period = {
    name: "July",
    start_date: "2026-07-01",
    end_date: "2026-07-31",
  };
  const csv = buildPayrollCsv([
    {
      ...member,
    },
  ], period, "generic");
  assertEquals(csv.split("\n")[1].endsWith(',"EUR"'), true);
  const datev = buildPayrollCsv([member], period, "datev");
  assertEquals(datev.split("\n")[1].endsWith(';"EUR"'), true);
  assertThrows(
    () => buildPayrollCsv([{ ...member, currency: "=US" }], period, "generic"),
    "three-letter code",
  );
});

Deno.test("pagination returns every row beyond the PostgREST default cap", async () => {
  const source = Array.from({ length: 1001 }, (_, index) => ({ id: index }));
  const ranges: Array<[number, number]> = [];
  const rows = await fetchAllPayrollRows(
    "test rows",
    (from, to) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: source.slice(from, to + 1), error: null });
    },
    { pageSize: 1000, maxRows: 2000 },
  );
  assertEquals(rows.length, 1001);
  assertEquals(rows[1000], { id: 1000 });
  assertEquals(ranges, [[0, 999], [1000, 1999]]);
});

Deno.test("pagination probes and rejects a result above the explicit maximum", async () => {
  const source = Array.from({ length: 1001 }, (_, index) => ({ id: index }));
  await assertRejects(
    () => fetchAllPayrollRows(
      "test rows",
      (from, to) => Promise.resolve({
        data: source.slice(from, to + 1),
        error: null,
      }),
      { pageSize: 1000, maxRows: 1000 },
    ),
    "exceeds the safe limit of 1000 rows",
  );
});

Deno.test("snapshot round-trip verifies deterministic ordering and SHA-256", async () => {
  const period = {
    id: "22ad500a-1782-7333-7128-63558cd00001",
    workspace_id: "22ad500a-1782-7333-7128-63558cd00002",
    name: "2026 July",
    start_date: "2026-07-01",
    end_date: "2026-07-31",
  };
  const members = [
    {
      membership_id: "22ad500a-1782-7333-7128-63558cd00004",
      display_name: "Grace",
      regular_hours: 4,
      overtime_hours: 1,
      leave_days: 0,
      gross_estimate: 50,
      currency: "USD",
    },
    {
      membership_id: "22ad500a-1782-7333-7128-63558cd00003",
      display_name: "Ada",
      regular_hours: 8,
      overtime_hours: 0,
      leave_days: 1,
      gross_estimate: 80,
      currency: "EUR",
    },
  ];
  const totals = {
    total_hours: 13,
    total_overtime: 1,
    total_gross: 130,
    member_count: 2,
  };
  const snapshot = await createPayrollSnapshot(period, members, totals);
  assertEquals(/^[0-9a-f]{64}$/.test(snapshot.hash), true);
  assertEquals(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(payrollSnapshotCanonicalPayload(snapshot)),
    ).then((digest) => [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")),
    snapshot.hash,
  );
  assertEquals(snapshot.members.map((member) => member.membership_id), [
    "22ad500a-1782-7333-7128-63558cd00003",
    "22ad500a-1782-7333-7128-63558cd00004",
  ]);
  const parsed = await parseStoredPayrollSnapshot({
    ...period,
    status: "exported",
    calculation_snapshot: snapshot,
    calculation_hash: snapshot.hash,
    calculation_version: snapshot.version,
  });
  assertEquals(parsed, snapshot);

  await assertRejects(
    () => parseStoredPayrollSnapshot({
      ...period,
      status: "locked",
      calculation_snapshot: {
        ...snapshot,
        totals: { ...snapshot.totals, total_gross: 131 },
      },
      calculation_hash: snapshot.hash,
      calculation_version: snapshot.version,
    }),
    "totals do not match",
  );
  await assertRejects(
    () => parseStoredPayrollSnapshot({
      ...period,
      status: "locked",
      calculation_snapshot: {
        ...snapshot,
        members: snapshot.members.map((member, index) =>
          index === 0 ? { ...member, display_name: "Tampered" } : member
        ),
      },
      calculation_hash: snapshot.hash,
      calculation_version: snapshot.version,
    }),
    "hash verification failed",
  );
});

Deno.test("legacy locked periods without a snapshot fail explicitly", async () => {
  try {
    await parseStoredPayrollSnapshot({
      id: "22ad500a-1782-7333-7128-63558cd00001",
      workspace_id: "22ad500a-1782-7333-7128-63558cd00002",
      name: "Legacy",
      start_date: "2026-06-01",
      end_date: "2026-06-30",
      status: "locked",
      calculation_snapshot: null,
      calculation_hash: null,
      calculation_version: null,
    });
  } catch (error) {
    if (
      error instanceof PayrollSnapshotError &&
      error.code === "PAYROLL_SNAPSHOT_MISSING"
    ) return;
    throw error;
  }
  throw new Error("Expected legacy payroll snapshot rejection");
});
