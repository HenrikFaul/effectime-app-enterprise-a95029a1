import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSchemaProvenance,
  compareSchemaProvenance,
  mergeSchemaSurfaces,
  parseGeneratedPublicSchema,
  parseMigrationDefinitions,
} from "./schema-provenance.mjs";

test("parses the four generated public schema surfaces", () => {
  const source = `
    export type Database = {
      // public: { Tables: { ignored: {} } }
      public: {
        Tables: {
          alpha: { Row: { id: string } }
          multiline_table:
            { Row: { value: string } }
        }
        Views: { alpha_view: { Row: { id: string } } }
        Functions: {
          alpha_rpc: { Args: { input: string }; Returns: string }
        }
        Enums: { alpha_state: "on" | "off" }
      }
    }
  `;

  assert.deepEqual(parseGeneratedPublicSchema(source), {
    tables: ["alpha", "multiline_table"],
    views: ["alpha_view"],
    functions: ["alpha_rpc"],
    enums: ["alpha_state"],
  });
});

test("parses multiline, quoted, qualified and unqualified public DDL but not comments", () => {
  const source = `
    -- CREATE TABLE public.comment_table(id int);
    /* CREATE VIEW public.comment_view AS SELECT 1; */
    CREATE TABLE IF NOT EXISTS "public"."QuotedTable" (id bigint);
    CREATE
      TABLE unqualified_table (id bigint);
    CREATE OR REPLACE VIEW public.real_view AS SELECT 1;
    CREATE OR REPLACE FUNCTION "public"."RealFunction"()
      RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
    CREATE TYPE public.real_state AS
      ENUM ('ready', 'done');
    CREATE TABLE private.hidden_table(id bigint);
  `;

  assert.deepEqual(parseMigrationDefinitions(source), {
    tables: ["QuotedTable", "unqualified_table"],
    views: ["real_view"],
    functions: ["RealFunction"],
    enums: ["real_state"],
  });
});

test("recognizes executable DDL in DO blocks and ignores DDL-like function strings", () => {
  const source = `
    DO $$
    BEGIN
      CREATE TYPE public.inside_do AS ENUM ('yes');
    END $$;
    CREATE FUNCTION public.wrapper() RETURNS void LANGUAGE plpgsql AS $body$
    BEGIN
      RAISE NOTICE 'CREATE TABLE public.not_real(id int)';
    END
    $body$;
  `;

  assert.deepEqual(parseMigrationDefinitions(source), {
    tables: [],
    views: [],
    functions: ["wrapper"],
    enums: ["inside_do"],
  });
});

test("does not treat temporary or private-search-path DDL as persistent public definitions", () => {
  const source = `
    CREATE TEMP TABLE public.session_table(id bigint);
    CREATE TEMPORARY TABLE session_table_unqualified(id bigint);
    CREATE LOCAL TEMP TABLE public.local_session_table(id bigint);
    SET search_path TO "private", public;
    CREATE TABLE hidden_table(id bigint);
    CREATE VIEW hidden_view AS SELECT 1;
    CREATE FUNCTION hidden_function() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
    CREATE TYPE hidden_state AS ENUM ('hidden');
    CREATE TABLE public.explicit_public_table(id bigint);
  `;

  assert.deepEqual(parseMigrationDefinitions(source), {
    tables: ["explicit_public_table"],
    views: [],
    functions: [],
    enums: [],
  });
});

test("RESET and an explicitly public quoted search_path restore unqualified public DDL", () => {
  const source = `
    SET LOCAL search_path = private, public;
    CREATE TABLE private_by_path(id bigint);
    RESET search_path;
    CREATE TABLE public_after_reset(id bigint);
    SET search_path TO "public", extensions;
    CREATE VIEW public_by_path AS SELECT 1;
  `;

  assert.deepEqual(parseMigrationDefinitions(source), {
    tables: ["public_after_reset"],
    views: ["public_by_path"],
    functions: [],
    enums: [],
  });
});

test("does not confuse CREATE or ALTER FUNCTION search_path clauses with top-level SET", () => {
  const source = `
    CREATE FUNCTION public.secure_function()
      RETURNS void
      LANGUAGE sql
      SET search_path = private
      AS $$ SELECT 1 $$;
    CREATE TABLE remains_default_public(id bigint);
    ALTER FUNCTION public.secure_function() SET search_path = private;
    CREATE VIEW also_default_public AS SELECT 1;
  `;

  assert.deepEqual(parseMigrationDefinitions(source), {
    tables: ["remains_default_public"],
    views: ["also_default_public"],
    functions: ["secure_function"],
    enums: [],
  });
});

test("exact comparison rejects both new debt and reviewed-debt improvements", () => {
  const generatedSurface = { tables: ["a", "b"], views: [], functions: [], enums: [] };
  const migrationSurface = mergeSchemaSurfaces([
    { tables: ["a"], views: [], functions: [], enums: [] },
  ]);
  const baseline = analyzeSchemaProvenance(generatedSurface, migrationSurface);
  assert.deepEqual(compareSchemaProvenance(baseline, baseline), []);

  const changed = analyzeSchemaProvenance(generatedSurface, {
    tables: ["a", "b"], views: [], functions: [], enums: [],
  });
  assert.deepEqual(compareSchemaProvenance(changed, baseline), [
    {
      section: "unprovenGeneratedSurface",
      kind: "tables",
      added: [],
      removed: ["b"],
    },
  ]);

  const expanded = analyzeSchemaProvenance(
    { tables: ["a", "b", "c"], views: [], functions: [], enums: [] },
    { tables: ["a"], views: [], functions: [], enums: [] },
  );
  assert.deepEqual(
    new Set(compareSchemaProvenance(expanded, baseline).map(({ section }) => section)),
    new Set(["generatedSurface", "unprovenGeneratedSurface"]),
  );

  const contracted = analyzeSchemaProvenance(
    { tables: ["a"], views: [], functions: [], enums: [] },
    { tables: ["a"], views: [], functions: [], enums: [] },
  );
  assert.deepEqual(
    new Set(compareSchemaProvenance(contracted, baseline).map(({ section }) => section)),
    new Set(["generatedSurface", "unprovenGeneratedSurface"]),
  );
});
