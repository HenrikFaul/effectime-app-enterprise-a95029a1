#!/usr/bin/env node
/**
 * Injects the generated `features:` i18n block into en.ts and hu.ts just
 * before the `platform_audit:` namespace. Idempotent: replaces an existing
 * block if it's already there.
 *
 *   node scripts/inject_feature_labels.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const ANCHOR_BEFORE = '  platform_audit: {';
const FEATURES_BLOCK_START = '  features: {';
const FEATURES_BLOCK_END = '  },\n';

function gen(target) {
  const r = spawnSync('node', [path.join(__dirname, 'build_feature_labels.mjs'), target], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  return r.stdout.trimEnd();
}

function inject(filePath, generatedBody) {
  const src = fs.readFileSync(filePath, 'utf8');
  const block = `${FEATURES_BLOCK_START}\n${generatedBody}\n  },\n${ANCHOR_BEFORE}`;

  // If features: block exists, replace; otherwise insert before platform_audit.
  const existingStart = src.indexOf(FEATURES_BLOCK_START);
  if (existingStart !== -1) {
    // Replace from existing features: through the next "  },\n  platform_audit: {"
    const tail = src.indexOf(ANCHOR_BEFORE, existingStart);
    if (tail === -1) {
      console.error(`features: block found but no platform_audit anchor after it in ${filePath}`);
      process.exit(1);
    }
    const updated = src.slice(0, existingStart) + block + src.slice(tail + ANCHOR_BEFORE.length);
    fs.writeFileSync(filePath, updated);
  } else {
    const idx = src.indexOf(ANCHOR_BEFORE);
    if (idx === -1) {
      console.error(`platform_audit anchor not found in ${filePath}`);
      process.exit(1);
    }
    const updated = src.slice(0, idx) + block + src.slice(idx + ANCHOR_BEFORE.length);
    fs.writeFileSync(filePath, updated);
  }
  console.log(`Updated ${path.relative(repoRoot, filePath)}`);
}

inject(path.join(repoRoot, 'src/i18n/resources/en.ts'), gen('en'));
inject(path.join(repoRoot, 'src/i18n/resources/hu.ts'), gen('hu'));
