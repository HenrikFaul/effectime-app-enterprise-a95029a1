# Feature Flag Strategy — Phase 7

## Háromlépéses safe-migration pattern

Minden új feature három release-en megy át:

**1. Catalog + dark-launch** (release N)
- INSERT a `features` táblába (`status='beta'`, dependencies kitöltve)
- Backend kód deployolva, de a feature alapból **kikapcsolva**
- Adatbázis migráció (ha van) reverz-kompatibilis módban

**2. Selective enable** (release N+1)
- Pilot tenantokra `tenant_feature_overrides (enabled=true)` insert
- Telemetry: `feature_gate_events` figyelése (allowed/denied arány,
  hibaarány)
- 2 hét vagy 100+ esemény után: ha minden zöld, lépjünk a 3-as fázisba

**3. Tier promotion + cleanup** (release N+2)
- INSERT a `tier_features` táblába (Pro/Enterprise/etc.)
- Pilot overrides-ok TÖRLÉSE (most már a tier adja)
- Feature `status='active'`
- Régi gating kód (ha volt) eltávolítása

## Rollback

- 1-es fázis után: feature row törlése (cascade törli a dep linkeket)
- 2-es fázis után: `tenant_feature_overrides (enabled=false)` insert →
  azonnal kikapcsol
- 3-as fázis után: `tier_features` DELETE + minden tenant override-tal cover

## Frontend runtime contract

```ts
// Egy feature ellenőrzése (komponensben)
const { enabled, isLoading } = useFeature(workspaceId, "ai_smart_schedule");

// Több feature lekérése egyszerre (hatékonyabb)
const { isEnabled, features } = useEnabledFeatures(workspaceId);
if (isEnabled("payroll_export")) { /* ... */ }

// Deklaratív gate
<FeatureGate workspaceId={ws} feature="bulk_approval"
             fallback={<UpgradePrompt tier="pro"/>}>
  <BulkApproveButton />
</FeatureGate>
```

Cache: 5 perc per workspace (React Query staleTime).

## Backend gating

Server function-ökben:

```ts
const { data: enabled } = await supabase
  .rpc("tenant_enabled_features", { _tenant_id: tenantId });
const ok = enabled?.some(f => f.feature_key === "payroll_export");
if (!ok) throw new Error("Feature not available for this tenant");
```

A jövőben dedicated `assert_feature_enabled(tenant_id, feature_key)` SQL
function-t lehet bevezetni, ami exception-t dob — egyszerűbb gate kód.

## Checklist új feature kiadáshoz

- [ ] `features` row INSERT, `dependencies` kitöltve
- [ ] `fiscal_weight` (1–10) értékelve
- [ ] Modul (`module`) megadva
- [ ] `tenant_feature_overrides`-szal pilot bekapcsolás
- [ ] Telemetry monitoring 2 hét
- [ ] `tier_features` INSERT (megfelelő tier-be)
- [ ] Régi gating kód (ha van) cleanup
- [ ] CHANGELOG + marketing_values entry
