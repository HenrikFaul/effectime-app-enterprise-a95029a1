import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const gateway = readFileSync(
  join(root, 'supabase', 'functions', 'public-api', 'index.ts'),
  'utf8',
);
const portal = readFileSync(
  join(root, 'src', 'components', 'enterprise', 'developer', 'DeveloperPortal.tsx'),
  'utf8',
);

const implementedRoutes = [
  'GET /v1/health',
  'GET /v1/employees',
  'GET /v1/schedules',
  'GET /v1/leave-requests',
];

describe('public API gateway/UI contract', () => {
  it('documents every implemented route and no deferred write route', () => {
    for (const route of implementedRoutes) {
      expect(gateway).toContain(`"${route}"`);
      expect(portal).toContain(route);
    }
    expect(portal).not.toContain('POST /v1/leave-requests');
    expect(portal).not.toContain('POST /v1/schedules');
    expect(portal).not.toContain('GET /v1/teams');
  });

  it('only allows creation of the read scope while preserving legacy labels for display', () => {
    expect(portal).toContain("const CREATABLE_SCOPES = ['read'] as const");
    expect(portal).not.toContain("const ALL_SCOPES = ['read', 'write', 'admin']");
    expect(portal).toContain("write: t('developer.scope_write')");
  });
});
