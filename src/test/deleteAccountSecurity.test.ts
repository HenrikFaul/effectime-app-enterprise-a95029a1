import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKING_AUTH_USER_REFERENCES,
  MAX_DELETION_REASON_LENGTH,
  findWorkspacesWithoutAnotherActiveOwner,
  getReauthenticationStatus,
  validateDeletionRequestBody,
} from '../../supabase/functions/delete-account/security.ts';

function findNoActionAuthReferences(): string[] {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const references = new Set<string>();

  for (const filename of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))) {
    const lines = readFileSync(join(migrationsDir, filename), 'utf8').split(/\r?\n/);
    let currentTable: string | null = null;
    for (const line of lines) {
      const tableMatch = line.match(
        /^\s*CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-z0-9_]+)/i,
      );
      if (tableMatch) currentTable = tableMatch[1];
      if (currentTable && /^\s*\);/.test(line)) currentTable = null;

      const referenceMatch = line.match(
        /^\s*([a-z0-9_]+)\b[^-]*REFERENCES\s+auth\.users\s*\(\s*id\s*\)(?![^-]*ON\s+DELETE)/i,
      );
      if (currentTable && referenceMatch) {
        references.add(`${currentTable}.${referenceMatch[1]}`);
      }
    }
  }

  return [...references].sort();
}

function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.test-signature`;
}

describe('delete-account request validation', () => {
  it('accepts the existing reason contract and normalizes surrounding whitespace', () => {
    expect(validateDeletionRequestBody({ reason: '  privacy  ' })).toEqual({
      ok: true,
      reason: 'privacy',
    });
  });

  it.each([
    null,
    [],
    'privacy',
    { reason: null },
    { reason: 42 },
    { reason: '' },
    { reason: '   ' },
    { reason: 'x'.repeat(MAX_DELETION_REASON_LENGTH + 1) },
  ])('rejects malformed or unbounded input: %j', (body) => {
    expect(validateDeletionRequestBody(body).ok).toBe(false);
  });
});

describe('delete-account recent authentication evidence', () => {
  const now = 1_800_000_000;

  it('uses a supplied standard auth_time claim', () => {
    expect(
      getReauthenticationStatus(`Bearer ${jwtWithPayload({ auth_time: now - 60 })}`, now),
    ).toBe('recent');
    expect(
      getReauthenticationStatus(`Bearer ${jwtWithPayload({ auth_time: now - 601 })}`, now),
    ).toBe('required');
  });

  it('does not mistake refreshed-token iat for interactive reauthentication', () => {
    expect(
      getReauthenticationStatus(`Bearer ${jwtWithPayload({ iat: now })}`, now),
    ).toBe('not-asserted');
  });

  it.each([
    '',
    'Basic abc',
    'Bearer opaque-token',
    `Bearer ${jwtWithPayload({ auth_time: 'recent' })}`,
  ])('rejects malformed authorization evidence: %s', (authorizationHeader) => {
    expect(getReauthenticationStatus(authorizationHeader, now)).toBe('invalid');
  });

  it('requires reauthentication for an implausibly future auth_time', () => {
    expect(
      getReauthenticationStatus(`Bearer ${jwtWithPayload({ auth_time: now + 61 })}`, now),
    ).toBe('required');
  });
});

describe('delete-account enterprise owner protection', () => {
  it('blocks active-owner and creator workspaces that have no other active owner', () => {
    expect(
      findWorkspacesWithoutAnotherActiveOwner(
        ['workspace-a', 'workspace-b'],
        ['workspace-b', 'workspace-c'],
        ['workspace-b'],
      ),
    ).toEqual(['workspace-a', 'workspace-c']);
  });

  it('allows deletion once every candidate workspace has another active owner', () => {
    expect(
      findWorkspacesWithoutAnotherActiveOwner(
        ['workspace-a'],
        ['workspace-b'],
        ['workspace-a', 'workspace-b'],
      ),
    ).toEqual([]);
  });
});

describe('delete-account blocking Auth foreign keys', () => {
  it('preflights every locally migrated auth.users reference with NO ACTION semantics', () => {
    const protectedReferences = BLOCKING_AUTH_USER_REFERENCES
      .map(({ table, column }) => `${table}.${column}`)
      .sort();
    expect(protectedReferences).toEqual(findNoActionAuthReferences());
  });
});

describe('delete-account implementation invariants', () => {
  const edgeSource = readFileSync(
    join(process.cwd(), 'supabase/functions/delete-account/index.ts'),
    'utf8',
  );
  const clientSource = readFileSync(
    join(process.cwd(), 'src/components/DeleteAccountCard.tsx'),
    'utf8',
  );
  const enterpriseSchema = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260411121759_06c32329-ad1b-4f04-82cd-03eb0febdeb1.sql',
    ),
    'utf8',
  );
  const legacySchema = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260307083255_dd987419-9352-4576-96df-2fb55441f983.sql',
    ),
    'utf8',
  );

  it('pins the Edge dependency and rejects non-POST methods', () => {
    expect(edgeSource).toContain('@supabase/supabase-js@2.98.0');
    expect(edgeSource).toContain('req.method !== "POST"');
    expect(edgeSource).toContain('METHOD_NOT_ALLOWED');
    expect(edgeSource).toContain('UNSUPPORTED_MEDIA_TYPE');
  });

  it('checks every explicit no-FK cleanup operation before auth deletion', () => {
    expect(edgeSource.match(/\.delete\(\)/g)).toHaveLength(6);
    expect(edgeSource.match(/throwOnDatabaseError\("delete /g)).toHaveLength(6);
    expect(edgeSource).toContain('.from("enterprise_memberships")');
    expect(edgeSource).toContain('SOLE_WORKSPACE_OWNER');
    expect(edgeSource.indexOf('auth.admin.deleteUser')).toBeGreaterThan(
      edgeSource.indexOf('throwOnDatabaseError("delete enterprise memberships"'),
    );
  });

  it('blocks known NO ACTION Auth references before any destructive cleanup', () => {
    expect(edgeSource).toContain('ACCOUNT_DATA_REQUIRES_REVIEW');
    expect(edgeSource).toContain('for (const reference of BLOCKING_AUTH_USER_REFERENCES)');
    expect(edgeSource.indexOf('for (const reference of BLOCKING_AUTH_USER_REFERENCES)'))
      .toBeLessThan(edgeSource.indexOf('.from("event_share_tokens")'));
    expect(clientSource).toContain("errorCode === 'ACCOUNT_DATA_REQUIRES_REVIEW'");
  });

  it('leaves schema-declared auth cascades to the database', () => {
    for (const table of ['votes', 'event_participants', 'events', 'personal_availability', 'user_roles', 'profiles']) {
      expect(edgeSource).not.toContain(`.from("${table}")`);
    }

    expect(legacySchema).toContain(
      'user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE',
    );
    expect(legacySchema).toContain(
      'created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE',
    );
  });

  it('protects the enterprise columns that have no auth foreign key', () => {
    expect(enterpriseSchema).toContain('created_by UUID NOT NULL,');
    expect(enterpriseSchema).toContain('user_id UUID NOT NULL,');
    expect(enterpriseSchema).toContain("role enterprise_role NOT NULL DEFAULT 'member'");
    expect(enterpriseSchema).toContain("status enterprise_membership_status NOT NULL DEFAULT 'active'");
    expect(edgeSource).toContain('.eq("created_by", user.id)');
    expect(edgeSource).toContain('.eq("user_id", user.id)');
  });

  it('records only completed deletions and requires a positive client response', () => {
    expect(edgeSource.indexOf('.from("account_deletions").insert')).toBeGreaterThan(
      edgeSource.indexOf('auth.admin.deleteUser'),
    );
    expect(clientSource).toContain("data?.success !== true");
    expect(clientSource).toContain('maxLength={MAX_CUSTOM_DELETION_REASON_LENGTH}');
    expect(clientSource).toContain("errorCode === 'SOLE_WORKSPACE_OWNER'");
    expect(clientSource).toContain("errorCode === 'REAUTHENTICATION_REQUIRED'");
  });
});
