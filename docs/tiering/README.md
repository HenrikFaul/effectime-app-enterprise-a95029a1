# Effectime — Feature & Tier System

A teljes tier/feature/addon rendszer adatai a Supabase adatbázisban élnek (single
source of truth). Ez a mappa a tervezési és átadási dokumentumokat tartalmazza,
plusz egy export scriptet, amellyel friss CSV pillanatfelvétel készíthető.

## Tartalom

| Fájl | Leírás |
|------|--------|
| `master_spec.md` | Indexdokumentum, minden artefakt referenciája |
| `recommended_tiers.md` | 3 javasolt tier (Freemium / Pro / Enterprise) + 5 addon, indoklással |
| `pricing_model.md` | Árazási javaslat, fiscal tagek, A/B kísérlettervek |
| `db_model.md` | A bevezetett adatbázis-séma (Phase 5) |
| `rls_policies.md` | RLS minták és tenant-izoláció (Phase 6) |
| `feature_flag_strategy.md` | Feature flag életciklus, safe migration pattern (Phase 7) |
| `superadmin_spec.md` | UI specifikáció (Phase 8) — élő implementáció: `src/components/superadmin/FeatureTiersTab.tsx` |
| `frontend_pattern.md` | `useFeature()` / `<FeatureGate>` használat (Phase 9) |
| `regression_matrix.md` | Non-regression mátrix (Phase 11) |
| `rollout_plan.md` | Kiadási és pilot terv (Phase 13) |
| `backlog.md` | Maradék implementációs backlog (Phase 14) |
| `scripts/gen_tiering_docs.mjs` | Friss CSV export futtatása (lásd alább) |

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
