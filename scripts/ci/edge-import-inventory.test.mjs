import assert from "node:assert/strict";
import test from "node:test";

import { collectRemoteImportSpecifiers } from "./edge-import-inventory.mjs";

test("collects multiline, side-effect, dynamic and type-reference remote imports", () => {
  const source = `
    import {
      createClient,
      type SupabaseClient,
    } from "https://esm.sh/@supabase/supabase-js@2.98.0";
    import "npm:@scope/side-effect@1.2.3";
    const module = await import("jsr:@std/assert@1.0.14");
    /// <reference types="npm:@types/example@1.0.0" />
  `;

  assert.deepEqual(collectRemoteImportSpecifiers(source).sort(), [
    "https://esm.sh/@supabase/supabase-js@2.98.0",
    "jsr:@std/assert@1.0.14",
    "npm:@scope/side-effect@1.2.3",
    "npm:@types/example@1.0.0",
  ]);
});

test("does not mistake database from calls or local imports for remote dependencies", () => {
  const source = `
    import { helper } from "./helper.ts";
    const rows = client.from("enterprise_memberships");
  `;

  assert.deepEqual(collectRemoteImportSpecifiers(source), []);
});
