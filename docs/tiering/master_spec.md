# Master Spec — Effectime Feature Tiering

Indexdokumentum az összes phase deliverable-jéhez. A futtatható artefaktok
(táblák, függvények, UI) az alkalmazásban élnek; ez a mappa a terv és átadás.

## Phase átadások

| Phase | Cél | Állapot | Hivatkozás |
|-------|-----|---------|------------|
| 1 | Context recon | ✅ | repo + uploaded MD elemezve |
| 2 | Feature inventory (135 feat) | ✅ | `features` tábla, `features.csv` exportálható |
| 3 | Dependency matrix | ✅ | `features.dependencies` jsonb + `dependency_matrix.csv` |
| 4 | Tier + addon design | ✅ | `tiers.md`, `recommended_tiers.md`, `tiers_matrix.csv` |
| 5 | DB séma + migrációk | ✅ | `db_model.md`, supabase migrations 20260512* |
| 6 | RLS + multi-tenant | ✅ | `rls_policies.md`, RLS bekapcsolva minden új táblán |
| 7 | Feature flag stratégia | ✅ | `feature_flag_strategy.md` |
| 8 | Superadmin UI | ✅ | `FeatureTiersTab.tsx` új tab a Control Plane-ben |
| 9 | Frontend gating | ✅ | `useFeature()`, `<FeatureGate>` + `tenant_enabled_features()` RPC |
| 10 | Pricing | ✅ | `pricing_model.md`, `fiscal_weight` minden feature-ön |
| 11 | Regression matrix | ✅ | `regression_matrix.md` |
| 12 | Lokalizáció | ⚪ | meglévő i18n stack használata, kulcs konvenció: `tiering.*` |
| 13 | Rollout terv | ✅ | `rollout_plan.md` |
| 14 | Backlog | ✅ | `backlog.md` |

## Bevezetett DB objektumok (élesben)

**Táblák:** `features`, `tiers`, `tier_features`, `addons`, `addon_features`,
`tenants`, `tenant_workspaces`, `tenant_subscriptions`, `tenant_addons`,
`tenant_feature_overrides`, `feature_gate_events`.

**Függvények:** `tenant_id_for_workspace(uuid)`, `tenant_enabled_features(uuid)`.

## Frontend kontraktok

```ts
// Komponens guard
<FeatureGate workspaceId={ws} feature="ai_smart_schedule" fallback={<Upsell/>}>
  <SmartScheduler />
</FeatureGate>

// Hook
const { enabled, isLoading } = useFeature(workspaceId, "payroll_export");

// Több kulcs előtöltése
const { isEnabled, features } = useEnabledFeatures(workspaceId);
```

## Stakeholder follow-upok

- **Product**: véglegesíteni a 3 anchor feature-t tier-enként a marketing oldalra
- **Finance**: a Pro/Enterprise EUR árazás megerősítése (jelenleg javaslat: lásd `pricing_model.md`)
- **Ops**: tenant assign workflow — pilot ügyfél kiválasztás (lásd `rollout_plan.md`)
- **Legal**: payroll addon országonkénti megfeleltetés (HU, CZ, SK, PL)
