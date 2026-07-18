import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, resolveInternalPath } from '@/lib/internalPath';

const WORKSPACE_ID = '6f8f5771-8df1-4f6d-9b95-8f6f3c8a6b0e';
const BOOKING_TOKEN = '8db55f82-4c1e-47e6-af47-5e7b7fb26e91';

describe('internal path validation', () => {
  it.each([
    '/',
    '/app',
    '/enterprise',
    '/profile',
    '/admin',
    '/superadmin',
    '/unsubscribe',
    '/reseller',
    '/reset-password',
    '/szabadsagkezeles',
    '/kapacitastervezes',
    '/app?select=1',
    '/app?invite=5cc59e2f-0df0-4108-b715-9337312938f5',
    `/w/${WORKSPACE_ID}?tab=calendar`,
    '/auth?oauth=google&redirect=%2Fapp%3Fselect%3D1',
    '/auth?email_activation_token=opaque-token&redirect=%2Fapp',
    `/book/${BOOKING_TOKEN}`,
    '/embed/capacity_planner?token=opaque-token&from=2026-07-17',
    '/embed/multi?token=opaque-token&views=capacity_planner%2Cshift_roster',
    '/muszakbeosztas#features',
  ])('accepts a registered internal destination: %s', (candidate) => {
    expect(isSafeInternalPath(candidate)).toBe(true);
    expect(resolveInternalPath(candidate)).toBe(candidate);
  });

  it.each([
    'https://evil.example/app',
    'javascript:alert(1)',
    '//evil.example/app',
    '///evil.example/app',
    '/\\evil.example/app',
    '/%5cevil.example/app',
    '/%255cevil.example/app',
    '/app//settings',
    '/app?next=https:%2F%2Fevil.example',
    '/app?next=javascript:alert(1)',
    '/app?next=%20data%3Atext%2Fhtml%2Cunsafe',
    '/app%0d%0aLocation:%20https:%2F%2Fevil.example',
    '/app\u0000',
    '/app/../admin',
    '/%2e%2e/admin',
    '/unknown',
    '/w/not-a-uuid',
    '/book/not-a-uuid',
    '/embed/unknown',
    ' /app',
    '/app ',
    '',
  ])('rejects an unsafe or unknown destination: %s', (candidate) => {
    expect(isSafeInternalPath(candidate)).toBe(false);
    expect(resolveInternalPath(candidate)).toBe('/app');
  });

  it('uses only an allowlisted fallback', () => {
    expect(resolveInternalPath('//evil.example', '/')).toBe('/');
    expect(resolveInternalPath('//evil.example', 'https://fallback.example')).toBe('/app');
  });
});
