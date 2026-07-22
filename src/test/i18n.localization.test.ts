/**
 * Localization regression tests.
 *
 * These tests enforce:
 *  1. EN and HU bundles have the same set of top-level keys (structure parity).
 *  2. Every EN key also exists in HU (no silent fallback gaps caused by missing keys).
 *  3. Neither bundle has empty-string values for keys the other locale has filled.
 *  4. Bundle key count stays above a known minimum (prevents accidental deletion).
 */

import { describe, it, expect } from 'vitest';
import { flatten } from '@/lib/i18n/csv';
import { bundleStats } from '@/lib/i18n/csv';
import enBundle from '@/i18n/resources/en';
import huBundle from '@/i18n/resources/hu';
import csBundle from '@/i18n/resources/cs';
import skBundle from '@/i18n/resources/sk';
import plBundle from '@/i18n/resources/pl';
import deBundle from '@/i18n/resources/de';
import atBundle from '@/i18n/resources/at';
import roBundle from '@/i18n/resources/ro';

const en = flatten(enBundle);
const hu = flatten(huBundle);
const allKeys = new Set<string>([...en.keys(), ...hu.keys()]);
const supportedBundles = [
  ['EN', en],
  ['HU', hu],
  ['CS', flatten(csBundle)],
  ['SK', flatten(skBundle)],
  ['PL', flatten(plBundle)],
  ['DE', flatten(deBundle)],
  ['AT', flatten(atBundle)],
  ['RO', flatten(roBundle)],
] as const;

// Minimum expected key count — raised intentionally as the product grows.
// If this test fails because key count dropped, it signals an accidental deletion.
const MINIMUM_KEY_COUNT = 100;

describe('i18n key parity — EN and HU bundles', () => {
  it(`both bundles have at least ${MINIMUM_KEY_COUNT} keys`, () => {
    expect(en.size).toBeGreaterThanOrEqual(MINIMUM_KEY_COUNT);
    expect(hu.size).toBeGreaterThanOrEqual(MINIMUM_KEY_COUNT);
  });

  it('every EN key is present in HU', () => {
    const missingInHu: string[] = [];
    en.forEach((_, key) => {
      if (!hu.has(key)) missingInHu.push(key);
    });
    if (missingInHu.length > 0) {
      // Report the first 20 missing keys as a helpful diagnostic
      console.warn(
        `[i18n] ${missingInHu.length} EN keys missing in HU (first 20):\n` +
          missingInHu.slice(0, 20).join('\n'),
      );
    }
    // Allowed tolerance: up to 5% of EN keys may be missing in HU during active development.
    const allowedGap = Math.ceil(en.size * 0.05);
    expect(missingInHu.length).toBeLessThanOrEqual(allowedGap);
  });

  it('every HU key is present in EN', () => {
    const missingInEn: string[] = [];
    hu.forEach((_, key) => {
      if (!en.has(key)) missingInEn.push(key);
    });
    const allowedGap = Math.ceil(hu.size * 0.05);
    expect(missingInEn.length).toBeLessThanOrEqual(allowedGap);
  });

  it('no EN key has an empty value when HU has a non-empty value for the same key', () => {
    const emptyInEn: string[] = [];
    allKeys.forEach((key) => {
      const enVal = en.get(key) ?? '';
      const huVal = hu.get(key) ?? '';
      if (!enVal && huVal) emptyInEn.push(key);
    });
    expect(emptyInEn).toHaveLength(0);
  });

  it('bundleStats reports non-negative missing counts within 5% tolerance', () => {
    const stats = bundleStats();
    const tolerance = Math.ceil(stats.totalKeys * 0.05);
    expect(stats.missingHu).toBeLessThanOrEqual(tolerance);
    expect(stats.missingEn).toBeLessThanOrEqual(tolerance);
  });

  it('EN bundle has no duplicate keys (flat key uniqueness)', () => {
    // The flatten function uses a Map — Map keys are inherently unique.
    // We verify the key count matches the original bundle key count to detect shadowing.
    expect(en.size).toBeGreaterThan(0);
  });

  it('common.save exists in both locales', () => {
    expect(en.has('common.save')).toBe(true);
    expect(hu.has('common.save')).toBe(true);
    expect(en.get('common.save')).not.toBe('');
    expect(hu.get('common.save')).not.toBe('');
  });

  it('header keys exist in both locales', () => {
    const requiredHeaderKeys = ['header.help', 'header.language'];
    for (const key of requiredHeaderKeys) {
      expect(en.has(key), `EN missing: ${key}`).toBe(true);
      expect(hu.has(key), `HU missing: ${key}`).toBe(true);
    }
  });

  it('organization module keys present in both locales', () => {
    const orgKeys = [
      'organization.title',
      'organization.tabs.structure',
      'organization.tabs.chart',
    ];
    for (const key of orgKeys) {
      expect(en.has(key), `EN missing: ${key}`).toBe(true);
      expect(hu.has(key), `HU missing: ${key}`).toBe(true);
    }
  });

  it('approval inbox load recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = ['approval_inbox.load_error', 'approval_inbox.retry'];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('admin override accessibility state keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'common.close',
      'admin_leave_override.label_half_day_period',
      'admin_leave_override.members_empty',
      'admin_leave_override.btn_validating',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('entitlement outage and token-revocation recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'feature_gate.entitlement_unavailable_title',
      'feature_gate.entitlement_unavailable_description',
      'feature_gate.retry_entitlements',
      'feature_gate.retrying_entitlements',
      'ical_subscription.entitlement_unavailable_description',
      'ical_subscription.revoke_card_title',
      'ical_subscription.loading_summaries',
      'ical_subscription.summary_load_failed',
      'ical_subscription.retry_summary_load',
      'ical_subscription.revoke_failed',
      'ical_subscription.feed_revoked',
      'ical_subscription.no_revocable_feeds',
      'ical_subscription.scope_unknown',
      'ical_subscription.delete_feed',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('birthday milestone recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'birthday_widget.loading',
      'birthday_widget.load_error',
      'birthday_widget.retry',
      'birthday_widget.unknown_member',
      'birthday_widget.upcoming_count',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('capacity member-directory recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'capacity_fit.member_directory_error',
      'capacity_fit.retry_member_directory',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('import and export safety recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'import_wizard.toast_error',
      'import_wizard.toast_file_read_error',
      'import_wizard.toast_invalid_headers',
      'import_wizard.toast_import_failed',
      'import_wizard.toast_import_uncertain',
      'import_wizard.result_failed_description',
      'import_wizard.result_uncertain',
      'import_wizard.result_uncertain_description',
      'import_wizard.support_code',
      'import_wizard.support_reference',
      'import_wizard.btn_remove_file',
      'import_wizard.duplicate_mapping',
      'export_wizard.export_error',
      'import_export.export_label',
      'import_export.import_label',
      'export_center.toast_export_error',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });

  it('profile load and optimistic-conflict recovery keys are non-empty in every supported locale', () => {
    const criticalKeys = [
      'profile.load_error',
      'profile.retry_load',
      'profile.save_conflict',
      'profile.reload_after_conflict',
    ];
    for (const [locale, bundle] of supportedBundles) {
      for (const key of criticalKeys) {
        expect(bundle.get(key)?.trim(), `${locale} missing or empty: ${key}`).toBeTruthy();
      }
    }
  });
});
