import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluatePublicApiRateLimit,
  extractPublicApiKey,
  isApiKeyActive,
  resolvePublicApiRoute,
} from '../../supabase/functions/public-api/security';

describe('public-api security contract', () => {
  it('accepts either one unambiguous API-key header', () => {
    expect(extractPublicApiKey(new Request('https://example.test', {
      headers: { Authorization: 'Bearer eff_live_secret' },
    }))).toBe('eff_live_secret');
    expect(extractPublicApiKey(new Request('https://example.test', {
      headers: { 'X-API-Key': 'eff_header_secret' },
    }))).toBe('eff_header_secret');
    expect(extractPublicApiKey(new Request('https://example.test', {
      headers: { Authorization: 'Basic invalid', 'X-API-Key': 'must-not-win' },
    }))).toBeNull();
  });

  it('fails closed for revoked, expired, and malformed expiry state', () => {
    const now = Date.parse('2026-07-17T12:00:00Z');
    expect(isApiKeyActive({ revoked_at: '2026-07-17T11:00:00Z', expires_at: null }, now)).toBe(false);
    expect(isApiKeyActive({ revoked_at: null, expires_at: '2026-07-17T11:59:59Z' }, now)).toBe(false);
    expect(isApiKeyActive({ revoked_at: null, expires_at: 'not-a-date' }, now)).toBe(false);
    expect(isApiKeyActive({ revoked_at: null, expires_at: '2026-07-17T12:00:01Z' }, now)).toBe(true);
  });

  it('allows request 1000 and rejects request 1001 in the rolling hour', () => {
    expect(evaluatePublicApiRateLimit(1000)).toEqual({ allowed: true, remaining: 0 });
    expect(evaluatePublicApiRateLimit(1001)).toEqual({ allowed: false, remaining: 0 });
    expect(evaluatePublicApiRateLimit(Number.NaN)).toEqual({ allowed: false, remaining: 0 });
  });

  it('extracts only the path tail belonging to public-api', () => {
    expect(resolvePublicApiRoute(
      'https://project.supabase.co/functions/v1/public-api/v1/leave-requests?ignored=true',
    )).toBe('/v1/leave-requests');
  });

  it('declares the custom API-key gateway as explicit verify_jwt=false', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(config).toMatch(/\[functions\.public-api\]\s*verify_jwt\s*=\s*false/);
  });

  it('uses the live usage-log schema and persists the rolling-hour count', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/public-api/index.ts'),
      'utf8',
    );
    expect(source).toContain('revoked_at');
    expect(source).toContain('path,');
    expect(source).toContain('duration_ms:');
    expect(source).toContain('.from("enterprise_api_usage_logs")');
    expect(source).toContain('.gte("created_at", rollingHourStart)');
    expect(source).not.toContain('endpoint: route');
    expect(source).not.toContain('response_ms:');
  });
});
