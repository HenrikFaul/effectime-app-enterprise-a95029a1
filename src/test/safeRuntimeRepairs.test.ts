import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    'supabase',
    'migrations',
    '20260717131000_v3_51_3_safe_runtime_repairs.sql',
  ),
  'utf8',
);

describe('v3.51.3 safe runtime repairs', () => {
  it('appends each password-policy failure as an array element', () => {
    expect(migration.match(/array_append\(v_failures,/g)).toHaveLength(5);
    expect(migration).toContain("'ok', cardinality(v_failures) = 0");
    expect(migration).not.toMatch(/v_failures\s*:=\s*v_failures\s*\|\|/);
  });

  it('repairs the skipped candidate membership column without rewriting data', () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS enterprise_membership_id uuid;/,
    );
    expect(migration).toMatch(/FOREIGN KEY \(enterprise_membership_id\)/);
    expect(migration).toMatch(/ON DELETE SET NULL/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_candidates_enterprise_membership_id/);
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_candidate_membership_workspace');
    expect(migration).toContain('trg_candidates_membership_workspace');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.candidate_generate_onboarding');
    expect(migration).toContain('membership.workspace_id = _workspace_id');
    expect(migration).toContain('Candidate membership does not belong to this workspace');
    expect(migration).toContain("workspace_has_any_feature(_workspace_id, ARRAY['onboarding_template'])");
    expect(migration).toContain("workspace_has_any_feature(_workspace_id, ARRAY['onboarding_inbox'])");
    expect(migration).not.toMatch(/UPDATE\s+public\.candidates/i);
  });
});
