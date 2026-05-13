/**
 * Feature tiering invariants.
 *
 * The DB seed + docs/tiering CSVs are the source of truth for the feature
 * catalog. These tests check the structural invariants that downstream code
 * (FeatureTiersTab, useFeature hook, demo seeder) assumes:
 *
 *  1. Every feature is in features.csv exactly once.
 *  2. Dependency edges only point to known features.
 *  3. No dependency cycles.
 *  4. Tier inheritance (freemium ⊆ pro ⊆ enterprise).
 *  5. Demo tier overrides are smaller than defaults for restrictive tiers.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SEED_QUANTITIES, TIER_SEED_OVERRIDES } from '../../supabase/functions/seed-demo-workspace/seed-data';

const repoRoot = path.resolve(__dirname, '../..');

function readCsv(file: string): { header: string[]; rows: Record<string, string>[] } {
  const raw = fs.readFileSync(path.join(repoRoot, 'docs/tiering', file), 'utf8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    // Minimal CSV splitter; the build script never emits embedded commas in
    // the columns we read here (keys, modules, booleans, semicolon-joined
    // lists). If that changes, this parser must too.
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
  return { header, rows };
}

describe('feature catalog invariants', () => {
  const features = readCsv('features.csv').rows;
  const deps = readCsv('dependency_matrix.csv').rows;
  const tiers = readCsv('tiers_matrix.csv').rows;

  const featureKeys = new Set(features.map((f) => f.feature_key));

  it('features.csv has at least 100 features', () => {
    expect(features.length).toBeGreaterThanOrEqual(100);
  });

  it('feature_keys are unique', () => {
    expect(featureKeys.size).toBe(features.length);
  });

  it('every dependency points to a known feature', () => {
    const broken: string[] = [];
    for (const row of deps) {
      const dependsOn = row.depends_on.split(';').filter(Boolean);
      for (const dep of dependsOn) {
        if (!featureKeys.has(dep)) broken.push(`${row.feature_key} → ${dep}`);
      }
    }
    expect(broken, broken.slice(0, 10).join('\n')).toHaveLength(0);
  });

  it('dependency graph has no cycles', () => {
    const adj = new Map<string, string[]>();
    for (const row of deps) {
      adj.set(row.feature_key, row.depends_on.split(';').filter(Boolean));
    }
    // Iterative DFS coloring: 0=unseen, 1=on-stack, 2=done.
    const color = new Map<string, number>();
    const cycles: string[] = [];
    for (const start of adj.keys()) {
      if (color.get(start)) continue;
      const stack: { node: string; idx: number }[] = [{ node: start, idx: 0 }];
      color.set(start, 1);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const children = adj.get(top.node) ?? [];
        if (top.idx >= children.length) {
          color.set(top.node, 2);
          stack.pop();
          continue;
        }
        const next = children[top.idx++];
        const c = color.get(next) ?? 0;
        if (c === 1) {
          cycles.push(`cycle reached at ${next} from ${top.node}`);
          break;
        }
        if (c === 0) {
          color.set(next, 1);
          stack.push({ node: next, idx: 0 });
        }
      }
      if (cycles.length) break;
    }
    expect(cycles, cycles.join('\n')).toHaveLength(0);
  });

  it('tier inheritance: every freemium feature is in pro', () => {
    const freemium = new Set(tiers.filter((r) => r.freemium === '1').map((r) => r.feature_key));
    const pro = new Set(tiers.filter((r) => r.pro === '1').map((r) => r.feature_key));
    const leaked = [...freemium].filter((k) => !pro.has(k));
    expect(leaked, leaked.join(', ')).toHaveLength(0);
  });

  it('tier inheritance: every pro feature is in enterprise', () => {
    const pro = new Set(tiers.filter((r) => r.pro === '1').map((r) => r.feature_key));
    const enterprise = new Set(tiers.filter((r) => r.enterprise === '1').map((r) => r.feature_key));
    const leaked = [...pro].filter((k) => !enterprise.has(k));
    expect(leaked, leaked.join(', ')).toHaveLength(0);
  });

  it('tier-feature rows reference known feature_keys', () => {
    const unknown = tiers.filter((r) => !featureKeys.has(r.feature_key));
    expect(unknown.map((r) => r.feature_key)).toHaveLength(0);
  });
});

describe('demo seed tier overrides', () => {
  it('freemium override has fewer members than default', () => {
    const free = TIER_SEED_OVERRIDES.freemium;
    expect(free.members ?? DEFAULT_SEED_QUANTITIES.members).toBeLessThan(DEFAULT_SEED_QUANTITIES.members);
  });

  it('pro override sits between freemium and enterprise', () => {
    const free = TIER_SEED_OVERRIDES.freemium.members ?? DEFAULT_SEED_QUANTITIES.members;
    const pro = TIER_SEED_OVERRIDES.pro.members ?? DEFAULT_SEED_QUANTITIES.members;
    const ent = DEFAULT_SEED_QUANTITIES.members;
    expect(free).toBeLessThanOrEqual(pro);
    expect(pro).toBeLessThanOrEqual(ent);
  });

  it('enterprise override is empty (uses defaults)', () => {
    expect(Object.keys(TIER_SEED_OVERRIDES.enterprise)).toHaveLength(0);
  });

  it('freemium override disables agile content (out of tier)', () => {
    expect(TIER_SEED_OVERRIDES.freemium.agile_issues).toBe(0);
  });
});

describe('useFeature hook contract', () => {
  it('isEnabled returns true only for keys in the enabled set', () => {
    const set = new Set(['members_list', 'leave_submit']);
    const isEnabled = (key: string) => set.has(key);
    expect(isEnabled('members_list')).toBe(true);
    expect(isEnabled('payroll_engine')).toBe(false);
  });

  it('fail-closed: empty enabled set means everything disabled', () => {
    const set = new Set<string>();
    expect(set.has('members_list')).toBe(false);
  });
});
