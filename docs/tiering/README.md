# Effectime — Feature & Tier System

A teljes tier/feature/addon rendszer adatai a Supabase adatbázisban élnek (single
source of truth). Ez a mappa a tervezési és átadási dokumentumokat tartalmazza,
plusz egy export scriptet, amellyel friss CSV pillanatfelvétel készíthető.

## Tartalom

| Fájl | Phase | Leírás |
|------|-------|--------|
| `master_spec.md` | — | Indexdokumentum, minden artefakt referenciája |
| `context-recon.md` | 1 | Termék-kontextus, megerősített/inferált modulok, constraint-ek |
| `features.csv` / `features.json` | 2 | Feature inventar — 135 row × 11 kolumn |
| `dependency_matrix.csv` | 3 | Dependency edge-ek + dependents inverz gráf |
| `matrix_summary.md` | 3 | Top fan-out, módszertan, methodology, cycle-mentes igazolás |
| `recommended_tiers.md` | 4 | 3 tier (Freemium / Pro / Enterprise) + 5 addon, indoklással |
| `tiers_matrix.csv` | 4 | Feature → tier mapping (0/1 oszlopok) |
| `db_model.md` | 5 | A bevezetett adatbázis-séma |
| `rls_policies.md` | 6 | RLS minták, tenant-izoláció + rationale |
| `feature_flag_strategy.md` | 7 | Feature flag életciklus, safe migration pattern |
| `superadmin_spec.md` | 8 | UI specifikáció + ASCII wireframes — élő implementáció: `src/components/superadmin/FeatureTiersTab.tsx` |
| `frontend_pattern.md` | 9 | `useFeature()` / `<FeatureGate>` használat |
| `pricing_model.md` | 10 | Árazási javaslat, A/B kísérlettervek |
| `pricing_matrix.csv` | 10 | Per-feature fiscal tag (core/pro/enterprise/addon) + price hint |
| `regression_matrix.md` | 11 | Non-regression mátrix |
| `localization_strategy.md` | 12 | i18n stratégia, fallback chain, language selector UX |
| `docs_tasks.md` | 12 | Lokalizációs / dokumentációs task lista |
| `rollout_plan.md` | 13 | Kiadási és pilot terv |
| `backlog.md` | 14 | Maradék implementációs backlog |
| `../../scripts/build_tiering_csvs.mjs` | — | Static CSV/JSON generator (offline, migration-alapú) |
| `scripts/gen_tiering_docs.mjs` | — | Live CSV export DB-ből (service role keyre szüksége) |

## CSV pillanatfelvétel készítése

A scriptnek a project SERVICE ROLE kulcsára van szüksége (RLS bypass kell a
katalógushoz). Helyileg:

```bash
SUPABASE_URL="https://oezlzzmzzvbvinuysxaz.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
node scripts/gen_tiering_docs.mjs
```

Generált fájlok: `features.csv`, `dependency_matrix.csv`, `tiers_matrix.csv`,
`addons.csv`, `tiers.csv`.

## Aktuális állapot (DB-ből)

- **135 feature** 18 modulban (admin, agile, ai, approvals, attendance, auth,
  calendar, help, leave, members, org, platform, reports, resources, rules,
  settings, workflows, workspace)
- **3 tier**: Freemium (41 feat), Pro (101 feat), Enterprise (130 feat)
- **5 addon**: Agile / Wellbeing / Payroll / API / AI (11 feature link)
- **12 tenant** backfill-elve a meglévő `enterprise_workspaces`-ből,
  alapértelmezett Freemium subscription-nel
