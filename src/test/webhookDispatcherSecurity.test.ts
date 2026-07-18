import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDeliveryClaim,
  DELIVERY_CLAIM_TTL_MS,
  isActiveDeliveryClaim,
  safeWebhookUrl,
} from '../../supabase/functions/webhook-dispatcher/security';

describe('webhook-dispatcher security boundary', () => {
  it('accepts public HTTPS targets and removes URL fragments', () => {
    expect(safeWebhookUrl('https://hooks.example.org/effectime?tenant=1#secret')).toBe(
      'https://hooks.example.org/effectime?tenant=1',
    );
  });

  it.each([
    'http://hooks.example.org/webhook',
    'https://localhost/webhook',
    'https://intranet/webhook',
    'https://127.0.0.1/webhook',
    'https://2130706433/webhook',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.2/webhook',
    'https://[::1]/webhook',
    'https://[fec0::1]/webhook',
    'https://127.0.0.1.nip.io/webhook',
    'https://user:password@hooks.example.org/webhook',
  ])('rejects obvious SSRF target %s', (url) => {
    expect(safeWebhookUrl(url)).toBeNull();
  });

  it('treats a recent claim as leased and permits stale-claim recovery', () => {
    const now = Date.parse('2026-07-17T12:00:00Z');
    expect(isActiveDeliveryClaim(createDeliveryClaim(now, 'worker-a'), now + 1000)).toBe(true);
    expect(isActiveDeliveryClaim(
      createDeliveryClaim(now, 'crashed-worker'),
      now + DELIVERY_CLAIM_TTL_MS + 1,
    )).toBe(false);
    expect(isActiveDeliveryClaim('ordinary delivery error', now)).toBe(false);
  });

  it('keeps Supabase JWT verification enabled for dispatcher credentials', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(config).toMatch(/\[functions\.webhook-dispatcher\]\s*verify_jwt\s*=\s*true/);
  });

  it('keeps the privileged, active-subscription, service-RPC delivery path explicit', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/webhook-dispatcher/index.ts'),
      'utf8',
    );
    expect(source).toContain('req.method !== "POST"');
    expect(source).toContain('hasServiceRoleCredential(req, serviceKey)');
    expect(source).toContain('.eq("role", "admin")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('admin.rpc("webhook_record_delivery"');
    expect(source).toContain('redirect: "manual"');
    expect(source).toContain('.update({ last_error: claimToken })');
  });
});
