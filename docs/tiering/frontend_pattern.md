# Frontend Integration Pattern — Phase 9

## API

`src/hooks/useFeature.ts`

```ts
useEnabledFeatures(workspaceId)   // { features, isEnabled, isLoading, ... }
useFeature(workspaceId, key)      // { enabled, isLoading }
```

`src/components/feature-gate/FeatureGate.tsx`

```tsx
<FeatureGate workspaceId={ws} feature="payroll_export"
             fallback={<UpgradeBanner tier="enterprise"/>}>
  <PayrollExportButton />
</FeatureGate>
```

## Cache

React Query, 5 perc staleTime per (workspace_id). Workspace váltáskor
automatikusan refetch.

## Hibakezelés

- Workspace nincs / nincs még tenant: `useEnabledFeatures` üres listát ad vissza,
  minden gate `enabled=false` (fail-closed)
- Loading közben: `enabled=false`. Ha az UI fontos, használd `isLoading`-ot
  skeleton renderelésre

## Migráció a meglévő hardcoded check-ekről

Minimal-invazív lépések:

1. **Inventory**: `rg "if.*premium|isEnterprise|hasFeature" src/` — listázzuk
   a hardcoded check-eket
2. **Per-feature mapping**: minden találatot rendeljünk a `features` tábla egy
   `feature_key`-jéhez (a `feature_key` katalógus a docs/tiering/features.csv)
3. **Replace**: cseréljük a check-et `useFeature(workspaceId, key).enabled`-re
4. **Test**: a `regression_matrix.md` szerint smoke-tesztelni

## SSR megfontolások

A `useFeature` browser-side React Query-t használ. Loader-ben nem hívható
közvetlenül; ha SSR-ben is kell, server function-be csomagoljuk és a
`requireSupabaseAuth` middleware-rel hívjuk meg.

## Telemetry

Minden gate render emittolhat egy `feature_gate_events` rekordot. Jelenleg ezt
**nem** tesszük automatikusan (zaj-szűrés miatt) — kifejezett upsell pontokon
(pl. UpgradeBanner megjelenése) érdemes log-olni:

```ts
await supabase.from("feature_gate_events").insert({
  tenant_id, feature_key: "ai_smart_schedule",
  allowed: false, source: "denied"
});
```
