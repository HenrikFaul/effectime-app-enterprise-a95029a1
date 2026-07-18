import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const config = readFileSync(join(ROOT, 'supabase', 'config.toml'), 'utf8');
const migration = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260717130000_v3_51_3_security_boundaries.sql'),
  'utf8',
);

function configuredFunctions(): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const blockPattern = /\[functions\.([^\]]+)\]\s*\r?\nverify_jwt\s*=\s*(true|false)/g;
  for (const match of config.matchAll(blockPattern)) {
    expect(result.has(match[1]), `duplicate config block for ${match[1]}`).toBe(false);
    result.set(match[1], match[2] === 'true');
  }
  return result;
}

describe('Edge deployment authentication boundaries', () => {
  const configured = configuredFunctions();
  const functionDirectories = readdirSync(join(ROOT, 'supabase', 'functions'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .map((entry) => entry.name)
    .sort();

  it('declares verify_jwt explicitly for every deployable Edge Function', () => {
    expect([...configured.keys()].sort()).toEqual(functionDirectories);
  });

  it('only disables gateway JWT validation for endpoints with their own token/signature contract', () => {
    const customAuthenticated = [
      'auth-email-hook',
      'handle-email-suppression',
      'handle-email-unsubscribe',
      'help-regenerator',
      'join-event',
      'leave-ical',
      'ms365-sync',
      'public-api',
      'sync-holidays',
    ];
    expect([...configured].filter(([, verifyJwt]) => !verifyJwt).map(([name]) => name).sort())
      .toEqual(customAuthenticated.sort());
  });
});

function columnGrant(table: string): string {
  const match = migration.match(
    new RegExp(`GRANT SELECT \\(([\\s\\S]*?)\\) ON TABLE public\\.${table} TO authenticated;`, 'i'),
  );
  expect(match, `missing authenticated column grant for ${table}`).not.toBeNull();
  return match?.[1] ?? '';
}

describe('Credential column isolation migration', () => {
  it.each([
    ['enterprise_workspace_integrations', 'api_token'],
    ['enterprise_user_calendar_integrations', 'access_token'],
    ['enterprise_user_calendar_integrations', 'refresh_token'],
    ['enterprise_api_keys', 'key_hash'],
    ['enterprise_webhook_subscriptions', 'secret'],
  ])('does not grant authenticated SELECT on %s.%s', (table, secretColumn) => {
    expect(columnGrant(table)).not.toMatch(new RegExp(`\\b${secretColumn}\\b`, 'i'));
  });

  it('preserves the non-secret Agile field selection used by the UI', () => {
    expect(columnGrant('enterprise_workspace_integrations')).toMatch(/\bselected_field_ids\b/i);
  });

  it('revokes destructive and auth-directory RPCs from client roles', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.enforce_data_retention\(\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_user_ids_by_emails\(text\[\]\) FROM PUBLIC, anon, authenticated/i,
    );
  });

  it('never sends a Vault credential to a hard-coded Supabase project URL', () => {
    expect(migration).not.toMatch(/https:\/\/[a-z0-9-]+[.]supabase[.]co\/functions\/v1/i);
    expect(migration).toContain("name = 'supabase_function_base_url'");
    expect(migration).toContain("name = 'email_queue_service_role_key'");
    expect(migration).toContain('M365 cron not installed');
  });
});

describe('direct workspace user provisioning boundary', () => {
  const source = readFileSync(
    join(ROOT, 'supabase', 'functions', 'create-workspace-user', 'index.ts'),
    'utf8',
  );

  it('does not let a tenant administrator pre-claim an unverified global identity', () => {
    expect(source).toContain('code: "DIRECT_CREATE_DISABLED"');
    expect(source).not.toContain('admin.createUser');
    expect(source).not.toContain('email_confirm');
    expect(source).not.toContain('enterprise_memberships');
  });
});

describe('opaque-token calendar privacy contract', () => {
  const source = readFileSync(
    join(ROOT, 'supabase', 'functions', 'leave-ical', 'index.ts'),
    'utf8',
  );

  it('publishes only approved leave in personal and team feeds', () => {
    expect(source).toContain(".eq('status', 'approved')");
    expect(source).not.toContain("['approved', 'pending']");
    expect(source).not.toContain("(függőben)");
  });
});
