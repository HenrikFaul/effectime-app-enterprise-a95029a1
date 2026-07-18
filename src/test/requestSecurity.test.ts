import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  getBearerToken,
  hasServiceRoleCredential,
  normalizeAppPath,
  safeAppOrigin,
  verifyHmacSha256,
} from '../../supabase/functions/_shared/request-security.ts';

describe('shared Edge request authentication helpers', () => {
  it('requires an exact bearer token for service-role worker calls', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'Bearer exact-service-key' },
    });
    expect(getBearerToken(request)).toBe('exact-service-key');
    expect(hasServiceRoleCredential(request, 'exact-service-key')).toBe(true);
    expect(hasServiceRoleCredential(request, 'exact-service-key-suffix')).toBe(false);
    expect(constantTimeEqual('same', 'same')).toBe(true);
    expect(constantTimeEqual('same', 'different')).toBe(false);
  });

  it('fails closed when HMAC configuration or signatures are missing', async () => {
    expect(await verifyHmacSha256('{}', null, 'secret')).toBe(false);
    expect(await verifyHmacSha256('{}', 'sha256=00', undefined)).toBe(false);
  });

  it('accepts a valid sha256 HMAC and rejects a modified body', async () => {
    const body = '{"event":"release"}';
    const secret = 'test-only-secret';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const signature = `sha256=${Buffer.from(mac).toString('hex')}`;

    expect(await verifyHmacSha256(body, signature, secret)).toBe(true);
    expect(await verifyHmacSha256(`${body} `, signature, secret)).toBe(false);
  });

  it('normalizes only same-origin paths and canonical HTTPS origins', () => {
    expect(normalizeAppPath('/w/123?tab=calendar', '/app')).toBe('/w/123?tab=calendar');
    expect(normalizeAppPath('https://evil.example', '/app')).toBe('/app');
    expect(normalizeAppPath('//evil.example', '/app')).toBe('/app');
    expect(normalizeAppPath('/\\evil.example', '/app')).toBe('/app');
    expect(safeAppOrigin('https://effectime.app/path')).toBe('https://effectime.app');
    expect(safeAppOrigin('http://evil.example')).toBe('https://effectime.app');
    expect(safeAppOrigin('http://localhost:8080/path')).toBe('http://localhost:8080');
  });
});

describe('Microsoft 365 OAuth state consumption', () => {
  const source = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'ms365-sync', 'index.ts'),
    'utf8',
  );

  it('expires, deletes and verifies the one-time state before exchanging the code', () => {
    expect(source).toContain('Date.now() - 10 * 60_000');
    expect(source).toContain('.delete()');
    expect(source).toContain('.select("id")');
    expect(source).toContain('state was already consumed');
    expect(source.indexOf('state was already consumed')).toBeLessThan(source.indexOf('exchangeCode(code)'));
  });
});
