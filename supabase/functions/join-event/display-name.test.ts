import {
  canonicalizeDisplayName,
  DISPLAY_NAME_MAX_CODE_POINTS,
  resolveDisplayNameCandidates,
  resolveOptionalCallerDisplayName,
  resolveRequiredCallerDisplayName,
} from "./display-name.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("display-name boundary rejects non-string, blank, DEL and 201 code points", () => {
  assertEquals(canonicalizeDisplayName(42), { ok: false, reason: "invalid_type" });
  assertEquals(canonicalizeDisplayName(" \t\n "), { ok: false, reason: "blank" });
  assertEquals(canonicalizeDisplayName("Ada\u007fLovelace"), {
    ok: false,
    reason: "control_character",
  });
  assertEquals(canonicalizeDisplayName("Ada\u0085Lovelace"), {
    ok: false,
    reason: "control_character",
  });
  assertEquals(canonicalizeDisplayName("Ada\ud800Lovelace"), {
    ok: false,
    reason: "control_character",
  });
  assertEquals(canonicalizeDisplayName("a".repeat(DISPLAY_NAME_MAX_CODE_POINTS + 1)), {
    ok: false,
    reason: "too_long",
  });
});

Deno.test("display-name boundary returns the exact trimmed canonical value", () => {
  assertEquals(canonicalizeDisplayName("  Ada Lovelace  "), {
    ok: true,
    value: "Ada Lovelace",
  });
  assertEquals(canonicalizeDisplayName("\u00a0\ufeffAda Lovelace\u3000"), {
    ok: true,
    value: "Ada Lovelace",
  });
});

Deno.test("display-name length uses code points at the astral boundary", () => {
  const atLimit = "🧑".repeat(DISPLAY_NAME_MAX_CODE_POINTS);
  assertEquals([...atLimit].length, DISPLAY_NAME_MAX_CODE_POINTS);
  assertEquals(canonicalizeDisplayName(atLimit), { ok: true, value: atLimit });
  assertEquals(canonicalizeDisplayName(`${atLimit}🧑`), {
    ok: false,
    reason: "too_long",
  });
});

Deno.test("required action input fails before a mutation can be selected", async () => {
  let mutationCount = 0;
  const runAction = async (input: unknown) => {
    const resolved = resolveRequiredCallerDisplayName(input);
    if (!resolved.ok) return { status: 400, resolved };
    mutationCount += 1;
    return { status: 200, displayName: resolved.value };
  };

  for (const invalid of [null, 7, "", "x\u0000y", "x".repeat(201)]) {
    const response = await runAction(invalid);
    assertEquals(response.status, 400);
  }
  assertEquals(mutationCount, 0);

  assertEquals(await runAction("  Grace Hopper  "), {
    status: 200,
    displayName: "Grace Hopper",
  });
  assertEquals(mutationCount, 1);
});

Deno.test("optional caller candidate distinguishes absence from explicit invalid input", () => {
  assertEquals(resolveOptionalCallerDisplayName({}), {
    ok: true,
    provided: false,
    value: null,
  });
  assertEquals(resolveOptionalCallerDisplayName({ display_name: null }), {
    ok: false,
    provided: true,
    reason: "invalid_type",
  });
  assertEquals(resolveOptionalCallerDisplayName({ display_name: "  Katherine Johnson  " }), {
    ok: true,
    provided: true,
    value: "Katherine Johnson",
  });
});

Deno.test("server candidate fallback skips only absence and fails on present invalid state", () => {
  assertEquals(resolveDisplayNameCandidates([null, undefined]), { ok: true, value: null });
  assertEquals(resolveDisplayNameCandidates([null, "  Margaret Hamilton  "]), {
    ok: true,
    value: "Margaret Hamilton",
  });
  assertEquals(resolveDisplayNameCandidates(["", "valid fallback"]), {
    ok: false,
    reason: "blank",
  });
});
