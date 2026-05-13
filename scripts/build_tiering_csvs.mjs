#!/usr/bin/env node
/**
 * Parses the feature seed migrations + tier/addon seeds and regenerates the
 * three tiering CSV artifacts under docs/tiering/:
 *   - features.csv
 *   - dependency_matrix.csv
 *   - tiers_matrix.csv
 *
 * The seeds in supabase/migrations/ are the source of truth. Running this
 * script after seed changes keeps the docs in sync without hand-editing.
 *
 * Usage:  node scripts/build_tiering_csvs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'supabase/migrations');
const outDir = path.join(repoRoot, 'docs/tiering');

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

// Capture every features INSERT row across all migrations.
// Row shape:  ('key','name','module','desc',weight,deps_expr,metadata_jsonb)
const featureRows = [];
const tierRows = []; // {tier_key, feature_key}
const addonRows = []; // {addon_key, feature_key}
const tierKeys = ['freemium', 'pro', 'enterprise'];

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Features INSERTs
  const featuresMatch = sql.match(/INSERT INTO public\.features[\s\S]*?VALUES([\s\S]*?);\s*$/m);
  if (featuresMatch) {
    const body = featuresMatch[1];
    const rowRe = /\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.|'')+)'\s*,\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.|'')+)'\s*,\s*(\d+)\s*,\s*(ARRAY\[[^\]]*\]::text\[\]|'\{\}'::text\[\])\s*,\s*'(\{[^]*?\})'::jsonb\s*\)/g;
    let m;
    while ((m = rowRe.exec(body))) {
      const [, key, name, mod, desc, weight, depsExpr, metaJson] = m;
      let deps = [];
      if (depsExpr.startsWith('ARRAY')) {
        deps = [...depsExpr.matchAll(/'([^']+)'/g)].map(x => x[1]);
      }
      let meta = {};
      try { meta = JSON.parse(metaJson); } catch { /* ignore malformed */ }
      featureRows.push({
        feature_key: key,
        name: name.replace(/''/g, "'"),
        module: mod,
        description: desc.replace(/''/g, "'"),
        fiscal_weight: Number(weight),
        dependencies: deps,
        value_score: meta.value_score || '',
        necessity: meta.necessity || '',
        status: meta.current_status || 'public',
        created_in_version: meta.created_in_version || '',
        estimated_dev_cost: meta.estimated_dev_cost || '',
      });
    }
  }

  // tier_features INSERTs of form: SELECT/INSERT joins via key. Look for patterns:
  //   INSERT INTO public.tier_features (tier_id, feature_id)
  //   SELECT t.id, f.id FROM public.tiers t, public.features f WHERE t.tier_key = 'freemium' AND f.feature_key IN (...)
  const tfBlocks = sql.matchAll(/INSERT INTO public\.tier_features[\s\S]*?tier_key\s*=\s*'([^']+)'[\s\S]*?f\.feature_key\s+IN\s*\(([^)]+)\)/g);
  for (const tf of tfBlocks) {
    const tier = tf[1];
    const keys = [...tf[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
    keys.forEach(k => tierRows.push({ tier_key: tier, feature_key: k }));
  }

  const afBlocks = sql.matchAll(/INSERT INTO public\.addon_features[\s\S]*?addon_key\s*=\s*'([^']+)'[\s\S]*?f\.feature_key\s+IN\s*\(([^)]+)\)/g);
  for (const af of afBlocks) {
    const addon = af[1];
    const keys = [...af[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
    keys.forEach(k => addonRows.push({ addon_key: addon, feature_key: k }));
  }

  // Apply UPDATE public.features SET dependencies = ARRAY[...]::text[] WHERE feature_key = 'x';
  // (later migrations that correct earlier seed mistakes)
  const depUpdates = sql.matchAll(/UPDATE\s+public\.features\s+SET\s+dependencies\s*=\s*(ARRAY\[[^\]]*\]::text\[\])[\s\S]*?WHERE\s+feature_key\s*=\s*'([^']+)'/g);
  for (const u of depUpdates) {
    const [, arrExpr, key] = u;
    const deps = [...arrExpr.matchAll(/'([^']+)'/g)].map(x => x[1]);
    // record as a pending update keyed by feature_key
    featureRows.push({ __update: true, feature_key: key, dependencies: deps });
  }

  // Apply UPDATE public.features SET route_path = '...', menu_path = ARRAY[...] WHERE feature_key = 'x';
  // (the v3.15.x routing seed migration; pattern allows route_path/menu_path
  // to appear in either order or alone).
  const routeUpdates = sql.matchAll(/UPDATE\s+public\.features\s+SET\s+([^;]+?)\s+WHERE\s+feature_key\s*=\s*'([a-z0-9_]+)'/g);
  for (const u of routeUpdates) {
    const [, setExpr, key] = u;
    const routeMatch = setExpr.match(/route_path\s*=\s*'([^']+)'/);
    const menuMatch = setExpr.match(/menu_path\s*=\s*(ARRAY\[[^\]]*\])/);
    if (!routeMatch && !menuMatch) continue;
    const patch = { __update: true, feature_key: key };
    if (routeMatch) patch.route_path = routeMatch[1];
    if (menuMatch) patch.menu_path = [...menuMatch[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    featureRows.push(patch);
  }
}

if (featureRows.length === 0) {
  console.error('No feature rows parsed — check migration regex');
  process.exit(1);
}

// Deduplicate features by key (later migrations override earlier).
// __update entries patch only the fields they specify on top of the prior row
// (dependencies, route_path, menu_path).
const byKey = new Map();
for (const f of featureRows) {
  if (f.__update) {
    const existing = byKey.get(f.feature_key);
    if (existing) {
      const patch = {};
      if ('dependencies' in f) patch.dependencies = f.dependencies;
      if ('route_path' in f) patch.route_path = f.route_path;
      if ('menu_path' in f) patch.menu_path = f.menu_path;
      byKey.set(f.feature_key, { ...existing, ...patch });
    }
  } else {
    byKey.set(f.feature_key, f);
  }
}
const features = [...byKey.values()].sort((a, b) => a.feature_key.localeCompare(b.feature_key));

// Compute dependents (inverted graph)
const dependents = new Map();
for (const f of features) {
  for (const dep of f.dependencies) {
    if (!dependents.has(dep)) dependents.set(dep, []);
    dependents.get(dep).push(f.feature_key);
  }
}

// Build tier set per feature (with inheritance: pro inherits freemium, enterprise inherits pro)
const tierSets = { freemium: new Set(), pro: new Set(), enterprise: new Set() };
for (const r of tierRows) tierSets[r.tier_key]?.add(r.feature_key);
// Apply inheritance
for (const k of tierSets.freemium) { tierSets.pro.add(k); tierSets.enterprise.add(k); }
for (const k of tierSets.pro) tierSets.enterprise.add(k);

// CSV helpers
const csvCell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = arr => arr.map(csvCell).join(',');

// --- features.csv -----------------------------------------------------------
{
  const header = ['feature_key','name','module','fiscal_weight','status','value_score','necessity','created_in_version','estimated_dev_cost','route_path','menu_path','description','dependencies'];
  const lines = [header.join(',')];
  for (const f of features) {
    lines.push(csvLine([
      f.feature_key, f.name, f.module, f.fiscal_weight, f.status,
      f.value_score, f.necessity, f.created_in_version, f.estimated_dev_cost,
      f.route_path || '', (f.menu_path || []).join(' > '),
      f.description, f.dependencies.join(';'),
    ]));
  }
  fs.writeFileSync(path.join(outDir, 'features.csv'), lines.join('\n') + '\n');
  console.log(`features.csv: ${features.length} rows`);
}

// --- features.json ----------------------------------------------------------
// Programmatic consumers (FeatureService client, marketing tooling) want a
// proper JSON shape rather than re-parsing the CSV with its semicolon-joined
// dependency lists.
{
  const json = features.map((f) => ({
    feature_key: f.feature_key,
    name: f.name,
    module: f.module,
    description: f.description,
    fiscal_weight: f.fiscal_weight,
    status: f.status,
    value_score: f.value_score ? Number(f.value_score) : null,
    necessity: f.necessity || null,
    created_in_version: f.created_in_version || null,
    estimated_dev_cost: f.estimated_dev_cost || null,
    route_path: f.route_path || null,
    menu_path: f.menu_path || [],
    dependencies: f.dependencies,
    dependents: dependents.get(f.feature_key) || [],
    tiers: {
      freemium: tierSets.freemium.has(f.feature_key),
      pro: tierSets.pro.has(f.feature_key),
      enterprise: tierSets.enterprise.has(f.feature_key),
    },
  }));
  fs.writeFileSync(path.join(outDir, 'features.json'), JSON.stringify(json, null, 2) + '\n');
  console.log(`features.json: ${features.length} entries`);
}

// --- pricing_matrix.csv -----------------------------------------------------
// Phase 10 fiscal tagging — each feature gets a tag (core/pro/enterprise/addon)
// derived from its tier membership. Addons override tier mapping.
{
  // addon_key per feature_key (a feature may appear in multiple addons; first wins)
  const addonByFeature = new Map();
  for (const r of addonRows) {
    if (!addonByFeature.has(r.feature_key)) addonByFeature.set(r.feature_key, r.addon_key);
  }
  const fiscalTag = (key) => {
    if (addonByFeature.has(key)) return 'addon';
    if (tierSets.freemium.has(key)) return 'core';
    if (tierSets.pro.has(key)) return 'pro';
    if (tierSets.enterprise.has(key)) return 'enterprise';
    return 'unassigned';
  };
  const header = ['feature_key','module','fiscal_tag','addon_key','fiscal_weight','value_score','necessity','suggested_price_hint'];
  const lines = [header.join(',')];
  // Pricing hint heuristic: weight * tier multiplier (relative units, not currency).
  // core=1x, pro=2x, enterprise=4x, addon=5x. Multiplied by value_score/10.
  const tierMultiplier = { core: 1, pro: 2, enterprise: 4, addon: 5, unassigned: 0 };
  for (const f of features) {
    const tag = fiscalTag(f.feature_key);
    const v = f.value_score ? Number(f.value_score) : 5;
    const hint = (tierMultiplier[tag] * v / 10).toFixed(2);
    lines.push(csvLine([
      f.feature_key, f.module, tag, addonByFeature.get(f.feature_key) || '',
      f.fiscal_weight, f.value_score, f.necessity, hint,
    ]));
  }
  fs.writeFileSync(path.join(outDir, 'pricing_matrix.csv'), lines.join('\n') + '\n');
  console.log(`pricing_matrix.csv: ${features.length} rows`);
}

// --- dependency_matrix.csv --------------------------------------------------
{
  const header = ['feature_key','module','fiscal_weight','value_score','necessity','depends_on','dependents'];
  const lines = [header.join(',')];
  for (const f of features) {
    lines.push(csvLine([
      f.feature_key, f.module, f.fiscal_weight, f.value_score, f.necessity,
      f.dependencies.join(';'),
      (dependents.get(f.feature_key) || []).join(';'),
    ]));
  }
  fs.writeFileSync(path.join(outDir, 'dependency_matrix.csv'), lines.join('\n') + '\n');
  console.log(`dependency_matrix.csv: ${features.length} rows`);
}

// --- tiers_matrix.csv -------------------------------------------------------
{
  const header = ['feature_key','module','freemium','pro','enterprise'];
  const lines = [header.join(',')];
  for (const f of features) {
    lines.push(csvLine([
      f.feature_key, f.module,
      tierSets.freemium.has(f.feature_key) ? '1' : '0',
      tierSets.pro.has(f.feature_key) ? '1' : '0',
      tierSets.enterprise.has(f.feature_key) ? '1' : '0',
    ]));
  }
  fs.writeFileSync(path.join(outDir, 'tiers_matrix.csv'), lines.join('\n') + '\n');
  console.log(`tiers_matrix.csv: ${features.length} rows`);
}

console.log('\nSummary:');
console.log(`  Features:    ${features.length}`);
console.log(`  Freemium:    ${tierSets.freemium.size}`);
console.log(`  Pro:         ${tierSets.pro.size}`);
console.log(`  Enterprise:  ${tierSets.enterprise.size}`);
console.log(`  Addon rows:  ${addonRows.length}`);
