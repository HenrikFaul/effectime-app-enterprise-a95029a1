import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Migration-invariants regression tests (v3.33.2).
 *
 * These tests scan the on-disk `supabase/migrations/` corpus to catch
 * regressions of the v3.17.1 → v3.33.2 governance fixes. They assert
 * the latest definition of each protected object holds — not historical
 * snapshots, since older migrations may have weaker versions and that
 * is acceptable as long as a later migration restores the contract.
 *
 * Why this lives in test/ rather than CI-only: every contributor running
 * `npx vitest run` gets immediate feedback if their new migration
 * silently weakens an invariant.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

interface MigrationFile {
  filename: string;
  content: string;
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => ({
      filename,
      content: readFileSync(join(MIGRATIONS_DIR, filename), 'utf8'),
    }));
}

/** Find the LATEST CREATE OR REPLACE FUNCTION block for the given function name. */
function findLatestFunctionBody(name: string, migrations: MigrationFile[]): string | null {
  // We accept either `$$ ... $$` or `$function$ ... $function$` dollar quoting.
  // Two regexes; whichever matches in a file. Function bodies in this repo use
  // one or the other but not mixed within a single CREATE block.
  const reUntagged = new RegExp(
    String.raw`CREATE OR REPLACE FUNCTION\s+(?:public\.)?${name}\b[\s\S]*?\$\$[\s\S]*?\$\$\s*;`,
    'gi',
  );
  const reTagged = new RegExp(
    String.raw`CREATE OR REPLACE FUNCTION\s+(?:public\.)?${name}\b[\s\S]*?\$function\$[\s\S]*?\$function\$\s*;`,
    'gi',
  );
  let last: string | null = null;
  for (const m of migrations) {
    for (const re of [reUntagged, reTagged]) {
      for (const match of m.content.matchAll(re)) {
        last = match[0];
      }
    }
  }
  return last;
}

describe('Migration invariants — v3.17.1 strict tier_key contract (B-1)', () => {
  const migrations = loadMigrations();
  const body = findLatestFunctionBody('create_workspace_with_owner', migrations);

  it('latest create_workspace_with_owner definition exists on disk', () => {
    expect(body).not.toBeNull();
  });

  it('does NOT default _tier_key to a literal string', () => {
    // e.g. `_tier_key text DEFAULT 'freemium'` is the v3.17.0 regression shape.
    expect(body!).not.toMatch(/_tier_key\s+text\s+DEFAULT\s+'[^']/i);
  });

  it('raises when _tier_key is NULL', () => {
    expect(body!).toMatch(/IF\s+_tier_key\s+IS\s+NULL[\s\S]*?RAISE\s+EXCEPTION/i);
  });

  it('raises when tier lookup returns NULL (unknown tier_key)', () => {
    expect(body!).toMatch(/_tier_id\s+IS\s+NULL[\s\S]*?RAISE\s+EXCEPTION[\s\S]*?Unknown tier_key/i);
  });

  it('does NOT silently fall back to lowest sort_order tier', () => {
    // The v3.17.0 regression shape: `SELECT id ... FROM tiers ORDER BY sort_order LIMIT 1`
    // as a fallback INSIDE the same function. We allow it elsewhere; just not as a
    // fallback after the strict check.
    const lines = body!.split('\n');
    let sawStrictCheck = false;
    for (const line of lines) {
      if (/_tier_id\s+IS\s+NULL[\s\S]*?RAISE\s+EXCEPTION/i.test(line)) sawStrictCheck = true;
      if (sawStrictCheck && /ORDER\s+BY\s+sort_order/i.test(line)) {
        throw new Error(`Forbidden fallback-by-sort_order detected after strict check: "${line}"`);
      }
    }
  });

  it('arms the tier-immutability guard before the tenant_subscriptions INSERT', () => {
    // create_workspace_with_owner inserts the initial tenant_subscriptions row;
    // although the trigger only fires on UPDATE, future maintainers might add
    // an UPDATE here. Setting the marker is defensive.
    expect(body!).toMatch(/set_config\s*\(\s*'app\.tier_change_rpc_active'/i);
  });
});

describe('Migration invariants — v3.17.0 tier-id immutability (B-2)', () => {
  const migrations = loadMigrations();
  const triggerFn = findLatestFunctionBody('enforce_tier_id_immutability', migrations);
  const rpcBody = findLatestFunctionBody('superadmin_change_workspace_tier', migrations);

  it('enforce_tier_id_immutability trigger function exists', () => {
    expect(triggerFn).not.toBeNull();
  });

  it('trigger blocks UPDATE without the txn-local guard', () => {
    expect(triggerFn!).toMatch(/current_setting\s*\(\s*'app\.tier_change_rpc_active'/i);
    expect(triggerFn!).toMatch(/RAISE\s+EXCEPTION[\s\S]*?immutable/i);
  });

  it('trigger function declares SET search_path (security advisor)', () => {
    expect(triggerFn!).toMatch(/SET\s+search_path\s+TO\s+'public'/i);
  });

  it('superadmin_change_workspace_tier RPC arms the guard before its UPDATE', () => {
    // CRITICAL: without this the v3.33.1 trigger blocks all legitimate tier
    // changes. This was caught and hotfixed in v3.33.2.
    expect(rpcBody).not.toBeNull();
    expect(rpcBody!).toMatch(/PERFORM\s+set_config\s*\(\s*'app\.tier_change_rpc_active'\s*,\s*'true'\s*,\s*true\s*\)/i);
  });

  it('superadmin_change_workspace_tier writes platform_audit_events row', () => {
    expect(rpcBody!).toMatch(/INSERT\s+INTO\s+(public\.)?platform_audit_events/i);
  });
});

describe('Migration invariants — v3.33.1 referential triggers (B-7, B-31)', () => {
  const migrations = loadMigrations();
  const tierKeysFn = findLatestFunctionBody('validate_tier_feature_keys', migrations);
  const depsFn = findLatestFunctionBody('validate_feature_dependencies', migrations);

  it('validate_tier_feature_keys exists with SET search_path', () => {
    expect(tierKeysFn).not.toBeNull();
    expect(tierKeysFn!).toMatch(/SET\s+search_path\s+TO\s+'public'/i);
  });

  it('validate_tier_feature_keys uses delta validation (only NEW elements)', () => {
    // Delta pattern: WHERE k <> ALL(COALESCE(OLD.tier_feature_keys, '{}')).
    // Full validation would re-check pre-existing typos and break
    // unrelated UPDATEs. The delta pattern is the contract.
    expect(tierKeysFn!).toMatch(/<>\s*ALL\s*\(\s*COALESCE\s*\(\s*OLD\.tier_feature_keys/i);
  });

  it('validate_feature_dependencies exists with SET search_path', () => {
    expect(depsFn).not.toBeNull();
    expect(depsFn!).toMatch(/SET\s+search_path\s+TO\s+'public'/i);
  });

  it('validate_feature_dependencies uses delta validation', () => {
    expect(depsFn!).toMatch(/<>\s*ALL\s*\(\s*COALESCE\s*\(\s*OLD\.dependencies/i);
  });
});

describe('Migration invariants — search_path hygiene on v3.33.x functions', () => {
  const migrations = loadMigrations();
  const protectedFns = [
    // v3.33.1 additions (hardened in v3.33.2)
    'enforce_tier_id_immutability',
    'validate_tier_feature_keys',
    'validate_feature_dependencies',
    'require_feature_id',
    'create_workspace_with_owner',
    'superadmin_change_workspace_tier',
    // v3.33.3 sweep — pre-existing functions retro-hardened
    'candidate_interview_slot_eligible',
    'document_substitute',
    'enforce_data_retention',
    'enterprise_decision_memory_set_due',
    'haversine_km',
    'set_hr_workflow_updated_at',
    'set_webhook_updated_at',
    'update_office_equipment_updated_at',
    'update_office_min_staffing_updated_at',
    'validate_password_policy',
  ];
  for (const fn of protectedFns) {
    it(`${fn} declares SET search_path (advisor: function_search_path_mutable)`, () => {
      const body = findLatestFunctionBody(fn, migrations);
      expect(body, `${fn} not found in any migration`).not.toBeNull();
      expect(body!).toMatch(/SET\s+search_path\s+TO\s+'public'/i);
    });
  }
});
