import enBundle from '@/i18n/resources/en';
import huBundle from '@/i18n/resources/hu';
import type { Locale } from '@/i18n/locales';

/**
 * Flatten a nested resource bundle into a Map of dotted-key → string.
 */
export function flatten(bundle: any, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (bundle == null || typeof bundle !== 'object') return out;
  for (const [k, v] of Object.entries(bundle)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      const child = flatten(v, key);
      child.forEach((vv, kk) => out.set(kk, vv));
    } else if (typeof v === 'string') {
      out.set(key, v);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out.set(key, String(v));
    }
  }
  return out;
}

/** RFC 4180-ish CSV escape. */
function escapeCsvField(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Parse a single CSV line; supports quoted fields with embedded commas and "" escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      fields.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  fields.push(cur);
  return fields;
}

/** Parse a multi-line CSV body (newline-aware inside quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      cur += ch;
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      cur += ch;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (cur.length > 0 || ch === '\n') {
        rows.push(parseCsvLine(cur));
        cur = '';
      }
      // swallow \r\n pair
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) rows.push(parseCsvLine(cur));
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

export function buildI18nCsv(): string {
  const en = flatten(enBundle);
  const hu = flatten(huBundle);
  const allKeys = new Set<string>([...en.keys(), ...hu.keys()]);
  const rows = ['key,en,hu'];
  Array.from(allKeys)
    .sort()
    .forEach((k) => {
      const e = en.get(k) ?? '';
      const h = hu.get(k) ?? '';
      rows.push([k, e, h].map(escapeCsvField).join(','));
    });
  return rows.join('\n');
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  total: number;
  /** Per-locale flat map produced from the CSV (session-only). */
  overrides: Record<Locale, Map<string, string>>;
}

export function parseI18nCsv(text: string): ImportSummary {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { added: 0, updated: 0, skipped: 0, total: 0, overrides: { en: new Map(), hu: new Map() } as any };
  }
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const keyIdx = header.indexOf('key');
  const enIdx = header.indexOf('en');
  const huIdx = header.indexOf('hu');
  if (keyIdx === -1) {
    throw new Error('CSV header must include a "key" column');
  }

  const en = flatten(enBundle);
  const hu = flatten(huBundle);
  const overridesEn = new Map<string, string>();
  const overridesHu = new Map<string, string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const key = (row[keyIdx] ?? '').trim();
    if (!key) {
      skipped += 1;
      continue;
    }
    const enValue = enIdx >= 0 ? row[enIdx] ?? '' : '';
    const huValue = huIdx >= 0 ? row[huIdx] ?? '' : '';
    const knownEn = en.has(key);
    const knownHu = hu.has(key);

    if (enValue) {
      overridesEn.set(key, enValue);
      if (knownEn && enValue !== en.get(key)) updated += 1;
      if (!knownEn) added += 1;
    }
    if (huValue) {
      overridesHu.set(key, huValue);
      if (knownHu && huValue !== hu.get(key)) updated += 1;
      if (!knownHu) added += 1;
    }
  }

  return {
    added,
    updated,
    skipped,
    total: rows.length - 1,
    overrides: { en: overridesEn, hu: overridesHu } as Record<Locale, Map<string, string>>,
  };
}

/** Quick stats for the Localization page. */
export function bundleStats() {
  const en = flatten(enBundle);
  const hu = flatten(huBundle);
  const allKeys = new Set<string>([...en.keys(), ...hu.keys()]);
  let missingHu = 0;
  let missingEn = 0;
  allKeys.forEach((k) => {
    if (!hu.has(k) || !hu.get(k)) missingHu += 1;
    if (!en.has(k) || !en.get(k)) missingEn += 1;
  });
  return { totalKeys: allKeys.size, missingHu, missingEn };
}
