# Phase 12 — Docs & Translation Tasks

Ez a fájl a tiering-rendszer és kapcsolódó user-facing doksik fordítási TODO listája. Lásd `localization_strategy.md` a stratégiához.

## Status legend

- ✓ Done (v3.15.0)
- ⏳ In progress (open PR)
- ⏭️ Backlog (estimated effort)

## In-product strings (UI bundle)

| Task | Status | Effort | Note |
|------|--------|--------|------|
| `feature_tiers.*` namespace en + hu | ✓ | — | 50+ kulcs, v3.15.0 |
| `feature_tiers.*` namespace cs/sk/pl | ✓ | — | v3.15.0-ban hozzáadva, fallback-mentes |
| `feature_gate.*` (locked notice) en/hu/cs/sk/pl | ✓ | — | v3.15.0 |
| `create_workspace.tier_*` 5 nyelven | ✓ | — | v3.15.0 |
| Tier seed nevek lokalizálása (`tiers.name` → i18n-kulcs) | ⏭️ | 0.5 nap | Jelenleg en master data; `metadata.name_i18n_key` mező hozzáadása + UI lookup |
| Addon seed nevek lokalizálása | ⏭️ | 0.5 nap | Mint fent, `addons.name` |
| Feature `name` és `description` lokalizálása | ⏭️ | 2-3 nap | 135 feature × 5 locale = 675 fordítás; CSV import flow needed |
| `enterprise_audit_events.action` enum lokalizálás | ⏭️ | 0.5 nap | Audit log viewer-hez |
| `platform_audit_events.action` enum lokalizálás | ⏭️ | 0.5 nap | Superadmin audit log viewer-hez |

## User-facing docs

| Doc | Status | Effort | Note |
|-----|--------|--------|------|
| User manual EN — base structure | ⏭️ | 3 nap | Help drawer chunks-okat external doc-ká konszolidálni |
| User manual HU — fordítás | ⏭️ | 2 nap | EN-ből |
| Tier overview marketing page (EN/HU) | ⏭️ | 1 nap | `tiers_matrix.csv`-ből generálható |
| Pricing FAQ (EN/HU) | ⏭️ | 1 nap | `pricing_model.md`-ből |
| Addon catalog (EN/HU) | ⏭️ | 0.5 nap | `recommended_tiers.md` addon szekciójából |
| SOC 2 / ISO 27001 audit dossier (EN) | ⏭️ | 2 nap | `platform_audit_events` + `enterprise_audit_events` használati útmutató |

## Internal / engineering docs

| Doc | Status | Note |
|-----|--------|------|
| `docs/tiering/master_spec.md` | ✓ | Indexdokumentum |
| `docs/tiering/context-recon.md` | ✓ | v3.15.0 |
| `docs/tiering/matrix_summary.md` | ✓ | v3.15.0 |
| `docs/tiering/localization_strategy.md` | ✓ | Ez a fájl szülője |
| `docs/tiering/db_model.md` | ✓ | — |
| `docs/tiering/rls_policies.md` | ✓ | + rationale (v3.15.0 amend) |
| `docs/tiering/feature_flag_strategy.md` | ✓ | — |
| `docs/tiering/frontend_pattern.md` | ✓ | + integration examples (v3.15.0 amend) |
| `docs/tiering/superadmin_spec.md` | ✓ | + ASCII wireframes (v3.15.0 amend) |
| `docs/tiering/regression_matrix.md` | ✓ | + new tier behavior tests (v3.15.0 amend) |
| `docs/tiering/rollout_plan.md` | ✓ | — |
| `docs/tiering/backlog.md` | ✓ | Futószalag |
| `docs/tiering/pricing_model.md` | ✓ | — |

## CSV / JSON artifacts

| Artifact | Status | Source-of-truth |
|----------|--------|-----------------|
| `features.csv` | ✓ | `scripts/build_tiering_csvs.mjs` |
| `features.json` | ✓ | Idem (v3.15.0) |
| `dependency_matrix.csv` | ✓ | Idem |
| `tiers_matrix.csv` | ✓ | Idem |
| `pricing_matrix.csv` | ✓ | Idem (v3.15.0) |

## CI / Automation

| Task | Status | Note |
|------|--------|------|
| `npm run test` futtatja az `i18n.localization.test.ts`-t | ✓ | EN/HU parity check |
| `npm run test` futtatja az `featureTiering.test.ts`-t | ✓ | v3.15.0 |
| CI lépés: `node scripts/build_tiering_csvs.mjs && git diff --exit-code docs/tiering/` | ⏭️ | Drift detection — CSV-k automatikus szinkron a seed-del |
| CI lépés: cs/sk/pl key-parity check | ⏭️ | Soft requirement, csak figyelmeztet |
