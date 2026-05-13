/**
 * Localized labels for the tier/addon/feature catalog.
 *
 * The DB rows in `tiers`, `addons`, and `features` were originally seeded
 * with Hungarian names because Hungarian is the product's primary market.
 * To serve non-HU users in their language without re-seeding the DB, the
 * UI looks up the locale string by key first and falls back to the DB row
 * value only when the i18n bundle has no entry.
 *
 * This is the lookup contract:
 *   tier:    `tiers.<tier_key>.name|description`
 *   addon:   `addons.<addon_key>.name|description`
 *   feature: `features.<feature_key>.name|description`
 *
 * `useI18n().t(key)` returns the key string itself when no translation is
 * found, so we detect that sentinel and fall back to the DB-provided value.
 */

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function translateOrFallback(t: TFn, key: string, fallback: string): string {
  const v = t(key);
  // The provider returns the key unchanged when the lookup misses. Any other
  // return value is a real translation (possibly equal to the fallback in HU,
  // which is fine — the user gets the right string either way).
  return v === key ? fallback : v;
}

export function tierName(t: TFn, tier_key: string, dbName: string): string {
  return translateOrFallback(t, `tiers.${tier_key}.name`, dbName);
}

export function tierDescription(t: TFn, tier_key: string, dbDesc: string | null): string {
  return translateOrFallback(t, `tiers.${tier_key}.description`, dbDesc ?? '');
}

export function addonName(t: TFn, addon_key: string, dbName: string): string {
  return translateOrFallback(t, `addons.${addon_key}.name`, dbName);
}

export function addonDescription(t: TFn, addon_key: string, dbDesc: string | null): string {
  return translateOrFallback(t, `addons.${addon_key}.description`, dbDesc ?? '');
}

export function featureName(t: TFn, feature_key: string, dbName: string): string {
  return translateOrFallback(t, `features.${feature_key}.name`, dbName);
}

export function featureDescription(t: TFn, feature_key: string, dbDesc: string | null): string {
  return translateOrFallback(t, `features.${feature_key}.description`, dbDesc ?? '');
}
