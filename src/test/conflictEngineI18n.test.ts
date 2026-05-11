import { describe, it, expect } from 'vitest';
import { formatConflict } from '@/lib/conflictEngineI18n';
import en from '@/i18n/resources/en';
import hu from '@/i18n/resources/hu';
import cs from '@/i18n/resources/cs';
import sk from '@/i18n/resources/sk';
import pl from '@/i18n/resources/pl';
import type { ConflictResult } from '@/lib/conflictEngine';

/**
 * Minimal `t` implementation matching I18nProvider semantics: dotted-key
 * lookup with `{{var}}` interpolation. Used purely for tests; the real `t`
 * comes from `useI18n()`.
 */
function makeT(bundle: any): (key: string, vars?: Record<string, string>) => string {
  return (key, vars) => {
    const value = key.split('.').reduce((acc: any, part: string) => acc && acc[part], bundle);
    if (typeof value !== 'string') return key;
    if (!vars) return value;
    return value.replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] ?? `{{${k}}}`));
  };
}

const LOCALES: Array<[string, any]> = [
  ['en', en], ['hu', hu], ['cs', cs], ['sk', sk], ['pl', pl],
];

describe('formatConflict — locale-aware rendering of ConflictResult', () => {
  it.each(LOCALES)('renders BLOCKED_DATE in %s without leaking the key', (_name, bundle) => {
    const t = makeT(bundle);
    const c: ConflictResult = {
      code: 'BLOCKED_DATE', severity: 'blocking',
      message: 'fallback',
      date: '2026-05-01',
      params: { date: '2026-05-01', reason: 'Karbantartás' },
    };
    const out = formatConflict(c, t);
    expect(out).not.toMatch(/^conflict\./);
    expect(out).toContain('2026-05-01');
    expect(out).toContain('Karbantartás');
  });

  it.each(LOCALES)('renders BLOCKED_DATE without reason in %s', (_name, bundle) => {
    const t = makeT(bundle);
    const c: ConflictResult = {
      code: 'BLOCKED_DATE', severity: 'blocking', message: '',
      params: { date: '2026-05-01', reason: '' },
    };
    expect(formatConflict(c, t)).toContain('2026-05-01');
  });

  it.each(LOCALES)('MAX_OFF_EXCEEDED scoped vs unscoped chooses correct key in %s', (_name, bundle) => {
    const t = makeT(bundle);
    const scoped = formatConflict({
      code: 'MAX_OFF_EXCEEDED', severity: 'blocking', message: '',
      params: { date: '2026-05-01', max: 2, current: 3, roleLabel: 'Senior Engineer' },
    }, t);
    const unscoped = formatConflict({
      code: 'MAX_OFF_EXCEEDED', severity: 'blocking', message: '',
      params: { date: '2026-05-01', max: 2, current: 3, roleLabel: '' },
    }, t);
    expect(scoped).toContain('Senior Engineer');
    expect(unscoped).not.toContain('Senior Engineer');
  });

  it.each(LOCALES)('SELF_OVERLAP renders without params in %s', (_name, bundle) => {
    const t = makeT(bundle);
    const out = formatConflict({
      code: 'SELF_OVERLAP', severity: 'warning', message: '',
    }, t);
    expect(out).not.toMatch(/^conflict\./);
    expect(out.length).toBeGreaterThan(5);
  });

  it('VALIDATION_ERROR falls through to the raw message (system error, not a translation)', () => {
    const t = makeT(en);
    const out = formatConflict({
      code: 'VALIDATION_ERROR', severity: 'blocking',
      message: 'Error: network failure',
    }, t);
    expect(out).toBe('Error: network failure');
  });

  it('unknown code falls back to the Hungarian engine message', () => {
    const t = makeT(en);
    const out = formatConflict({
      code: 'COMPLETELY_NEW_CODE', severity: 'warning',
      message: 'legacy HU fallback',
    }, t);
    expect(out).toBe('legacy HU fallback');
  });

  it.each(LOCALES)('OFFICE_COVERAGE_BREACH includes all numeric values in %s', (_name, bundle) => {
    const t = makeT(bundle);
    const out = formatConflict({
      code: 'OFFICE_COVERAGE_BREACH', severity: 'blocking', message: '',
      params: { date: '2026-05-01', roleLabel: 'Nurse', min: 3, remaining: 1 },
    }, t);
    expect(out).toContain('2026-05-01');
    expect(out).toContain('Nurse');
    expect(out).toContain('3');
    expect(out).toContain('1');
  });
});

describe('locale parity — every locale defines the conflict.* namespace', () => {
  const REQUIRED_KEYS = [
    'unknown', 'blocked_date', 'blocked_date_with_reason', 'holiday_overlap',
    'max_off_exceeded', 'max_off_exceeded_scoped',
    'max_off_warning', 'max_off_warning_scoped',
    'office_coverage_breach', 'office_coverage_warning', 'self_overlap',
  ];
  it.each(LOCALES)('%s bundle defines all required conflict.* keys', (_name, bundle) => {
    expect(bundle.conflict).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect(bundle.conflict[key], `missing conflict.${key}`).toBeTruthy();
    }
  });
});
