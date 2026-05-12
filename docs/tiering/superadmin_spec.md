# Superadmin UI Spec — Phase 8

## Implementáció

Új tab a meglévő Superadmin Control Plane-ben, **a meglévő funkciók
megőrzésével**.

**Fájl:** `src/components/superadmin/FeatureTiersTab.tsx`
**Wiring:** `src/components/superadmin/SuperadminControlPlane.tsx` — új
`'tiers'` tab (Layers ikon) regisztrálva, lazy-mount.

## Funkciók (élő)

- 135 feature listázása modul + keresés szűréssel
- Tier × feature mátrix (Freemium/Pro/Enterprise) checkbox-ok élő toggle-lel
- Addon × feature mátrix élő toggle-lel
- Optimista UI a `supabase.from('tier_features').insert/delete` hívásokkal

## Backlog (még nem implementált, ld. backlog.md)

- **Tenant Assignment view**: tenant kiválasztás → tier dropdown → addons
  multiselect → save (megírja a `tenant_subscriptions`/`tenant_addons` rekordokat)
- **Tenant override editor**: tenant + feature + enabled bool + expires_at
- **Demo workspace creator** tier-select dropdown a workspace-create flow-ban
- **CSV import/export** a feature katalógusra
- **Audit timeline** tenantonként (subscription history + addon history)

## API contract (terv, jelenlegi RPC + table writes)

| Akció | Hívás |
|-------|-------|
| Feature list | `from('features').select('*')` |
| Tier→feature toggle | `from('tier_features').insert({tier_id,feature_id})` / `.delete()` |
| Tenant aktív feature-ök | `rpc('tenant_enabled_features', {_tenant_id})` |
| Tenant tier assign | `from('tenant_subscriptions').insert(...)` |
| Tenant addon assign | `from('tenant_addons').insert(...)` |
| Tenant override | `from('tenant_feature_overrides').upsert(...)` |
| Workspace → tenant | `rpc('tenant_id_for_workspace', {_workspace_id})` |
