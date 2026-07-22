import {
  boundedImportRowValue,
  IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS,
  providerCodeLogContext,
  rowWriteFailure,
  safeProviderCode,
} from "./errors.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

Deno.test("boundedImportRowValue limits values by Unicode code point", () => {
  const emoji = "\u{1F680}";
  const value = boundedImportRowValue(
    emoji.repeat(IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS + 20),
  );

  assertEquals([...value].length, IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS);
  assertEquals(value, emoji.repeat(IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS));
  assert(
    !value.endsWith("\uD83D"),
    "the bounded value must not split a surrogate pair",
  );
});

Deno.test("boundedImportRowValue preserves safe primitives and drops objects", () => {
  assertEquals(boundedImportRowValue("office"), "office");
  assertEquals(boundedImportRowValue(42), "42");
  assertEquals(boundedImportRowValue(false), "false");
  assertEquals(boundedImportRowValue(null), "");
  assertEquals(
    boundedImportRowValue({ token: "must-not-be-serialized" }),
    "",
  );
});

Deno.test("rowWriteFailure exposes a fixed sanitized client contract", () => {
  const providerMessage = "duplicate key value violates constraint users_email";
  const untrustedRuntimeInput = {
    rowIndex: 7,
    value: "a".repeat(300),
    field: providerMessage,
    providerMessage,
  };
  const result = rowWriteFailure(
    untrustedRuntimeInput as unknown as Parameters<typeof rowWriteFailure>[0],
  );

  assertEquals(result, {
    row_index: 7,
    field: "general",
    value: "a".repeat(IMPORT_ROW_ERROR_VALUE_MAX_CODE_POINTS),
    code: "DB_ERROR",
    reason_code: "ROW_WRITE_FAILED",
    message: "Import row could not be saved",
  });
  assert(
    !JSON.stringify(result).includes(providerMessage),
    "provider messages must not appear in row errors",
  );
});

Deno.test("rowWriteFailure permits an internal field without accepting provider details", () => {
  assertEquals(
    rowWriteFailure({ rowIndex: 2, field: "email", value: "user@example.com" }),
    {
      row_index: 2,
      field: "email",
      value: "user@example.com",
      code: "DB_ERROR",
      reason_code: "ROW_WRITE_FAILED",
      message: "Import row could not be saved",
    },
  );
});

Deno.test("safeProviderCode accepts only bounded allowlisted log tokens", () => {
  for (const code of ["23505", "PGRST116", "rate-limit.v2", "AUTH_42"]) {
    assertEquals(safeProviderCode(code), code);
  }

  for (
    const unsafe of [
      "",
      "a".repeat(65),
      "permission denied",
      "code:secret",
      "code\nforged-event",
      { code: "23505" },
      null,
    ]
  ) {
    assertEquals(safeProviderCode(unsafe), "UNKNOWN");
  }
});

Deno.test("providerCodeLogContext never retains the original unsafe value", () => {
  const unsafe = "23505\nemail=user@example.com";
  const context = providerCodeLogContext(unsafe);

  assertEquals(context, { provider_code: "UNKNOWN" });
  assert(
    !JSON.stringify(context).includes("user@example.com"),
    "unsafe provider details must not survive in log context",
  );
});
