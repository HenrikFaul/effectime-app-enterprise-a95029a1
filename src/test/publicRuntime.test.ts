import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSupabaseFunctionUrl,
  createPublicRuntimeConfig,
} from '@/config/publicRuntime';

const ROOT = process.cwd();

function config(overrides: Partial<Parameters<typeof createPublicRuntimeConfig>[0]> = {}) {
  return createPublicRuntimeConfig({
    supabaseUrl: 'https://project-ref.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
    supabaseProjectId: 'project-ref',
    ...overrides,
  });
}

function jwtWithRole(role: string): string {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `header.${payload}.signature`;
}

describe('public runtime configuration', () => {
  it('normalizes one hosted Supabase origin and matching project reference', () => {
    expect(config()).toEqual({
      supabaseUrl: 'https://project-ref.supabase.co',
      supabasePublishableKey: 'sb_publishable_test',
      supabaseProjectRef: 'project-ref',
    });
  });

  it('fails closed when the legacy project-id variable drifts from the URL', () => {
    expect(() => config({ supabaseProjectId: 'different-project' })).toThrow(/does not match/);
  });

  it('allows HTTP only for an explicit local development backend', () => {
    expect(
      config({
        supabaseUrl: 'http://127.0.0.1:54321',
        supabaseProjectId: undefined,
        allowLocalHttp: true,
      }).supabaseUrl,
    ).toBe('http://127.0.0.1:54321');
    expect(() => config({ supabaseUrl: 'http://api.example.test', allowLocalHttp: true })).toThrow(
      /HTTPS/,
    );
  });

  it('keeps a validated explicit project reference for a custom Supabase domain', () => {
    expect(
      config({
        supabaseUrl: 'https://data.effectime.example',
        supabaseProjectId: 'project-ref',
      }).supabaseProjectRef,
    ).toBe('project-ref');
    expect(() => config({ supabaseProjectId: '../unsafe' })).toThrow(/PROJECT_ID/);
  });

  it('rejects URL credentials, paths and secret/service-role client keys', () => {
    expect(() => config({ supabaseUrl: 'https://user:pass@project-ref.supabase.co' })).toThrow(
      /credentials/,
    );
    expect(() => config({ supabaseUrl: 'https://project-ref.supabase.co/rest/v1' })).toThrow(
      /origin/,
    );
    expect(() => config({ supabasePublishableKey: 'sb_secret_accidental' })).toThrow(
      /service-role\/secret/,
    );
    expect(() => config({ supabasePublishableKey: jwtWithRole('service_role') })).toThrow(
      /service-role\/secret/,
    );
  });

  it('builds Edge Function URLs only from the validated backend origin', () => {
    expect(buildSupabaseFunctionUrl('public-api', config().supabaseUrl)).toBe(
      'https://project-ref.supabase.co/functions/v1/public-api',
    );
    expect(() => buildSupabaseFunctionUrl('../admin', config().supabaseUrl)).toThrow(
      /Invalid Supabase Edge Function name/,
    );
  });

  it('keeps API and iCal link builders on the shared runtime configuration', () => {
    const apiPanel = readFileSync(
      join(ROOT, 'src/components/integrations/PublicApiGatewayPanel.tsx'),
      'utf8',
    );
    const iCal = readFileSync(
      join(ROOT, 'src/components/enterprise/ICalSubscription.tsx'),
      'utf8',
    );

    expect(apiPanel).not.toMatch(/https:\/\/[a-z0-9-]+\.supabase\.co/);
    expect(apiPanel).toContain("buildSupabaseFunctionUrl('public-api', projectUrl)");
    expect(iCal).not.toContain('VITE_SUPABASE_PROJECT_ID');
    expect(iCal).toContain("buildSupabaseFunctionUrl('leave-ical', SUPABASE_URL)");
  });
});
