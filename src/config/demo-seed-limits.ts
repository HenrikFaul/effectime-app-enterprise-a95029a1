/**
 * demo-seed-limits.ts — Demo workspace seeder maximum element counts
 * ===================================================================
 * Ez a fájl határozza meg, hogy a Demo workspace konfigurációs dialógban
 * legfeljebb mennyi elemet lehet beállítani egy-egy entitástípusból.
 *
 * CSAK EZT A FÁJLT KELL SZERKESZTENI a maximum értékek megváltoztatásához.
 * A DemoSeedConfigDialog innen olvassa a limiteket.
 *
 * Szabályok:
 *  - Az értékek pozitív egész számok legyenek
 *  - members: max 22 (ennyi DEMO_PERSONAS van definiálva a seed-data.ts-ben)
 *  - agile_issues: max 33 (ennyi issue van definiálva Kanban/Scrum/Gantt bemutatóhoz)
 *  - A többi értéknél se menj az adott DEFS tömb hossza fölé (seed-data.ts)
 *
 * Módosítás után: a változás azonnal érvényes lesz a UI-ban a következő
 * oldalletöltéskor (build-time import). Az edge function a DEFAULT értékekig
 * megy el automatikusan; ha a usert meghaladja a limit, a seeder is ennek
 * megfelelően csonkolja.
 */
export const DEMO_SEED_MAX_LIMITS: Record<string, number> = {
  // ── Tagok ─────────────────────────────────────────────────────────────────
  members:               22,   // DEMO_PERSONAS száma (seed-data.ts)
  member_templates:       5,
  ical_tokens:            4,

  // ── Szervezet ─────────────────────────────────────────────────────────────
  offices:                3,
  teams:                  4,
  skills:                12,
  org_units:             10,
  role_definitions:       3,
  job_families:           6,
  leadership_levels:      5,
  contract_types:         5,
  industries:             5,
  work_categories:        5,

  // ── Szabadság ─────────────────────────────────────────────────────────────
  leave_types:            4,
  holidays:               8,
  daily_rules:            7,
  office_coverage_rules: 10,
  approval_chains:        2,
  rule_templates:         5,

  // ── Erőforrások ───────────────────────────────────────────────────────────
  projects:               5,
  scenarios:              2,
  agile_issues:          33,   // teljes Kanban/Scrum/Gantt dataset (seed-data.ts)

  // ── Riportok ──────────────────────────────────────────────────────────────
  reports:                4,

  // ── Folyamatok ────────────────────────────────────────────────────────────
  access_systems:         4,
  onboarding_templates:   3,

  // ── Beállítások ───────────────────────────────────────────────────────────
  translation_overrides:  4,
};
