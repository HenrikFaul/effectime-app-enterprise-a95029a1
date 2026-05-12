# DB Model — Phase 5 Deliverable

## Bevezetett táblák (élő, RLS-sel)

```
tenants
├── id (uuid pk)
├── name, slug (unique)
├── status, billing_email, country, vat_number
└── metadata jsonb

tenant_workspaces       (tenants 1—N enterprise_workspaces)
├── tenant_id, workspace_id, is_primary

tiers
├── tier_key (unique: freemium|pro|enterprise)
├── name, description, sort_order
└── price_monthly_eur, seat_price_monthly_eur

tier_features           (tier × feature)
├── tier_id, feature_id (unique pair)

addons
├── addon_key (unique)
├── name, description, sort_order
└── price_monthly_eur

addon_features          (addon × feature)
├── addon_id, feature_id (unique pair)

tenant_subscriptions
├── tenant_id, tier_id
├── status (active|trial|cancelled|expired)
└── started_at, ends_at

tenant_addons
├── tenant_id, addon_id
├── status, started_at, ends_at

tenant_feature_overrides
├── tenant_id, feature_id, enabled bool
├── reason text, expires_at
└── created_by

features
├── feature_key (unique)
├── name, description, module
├── fiscal_weight smallint (1–10)
├── status (active|beta|deprecated)
├── dependencies text[]   ← static feature_keys
└── metadata jsonb

feature_gate_events     (telemetry)
├── tenant_id, user_id, feature_key
├── allowed bool
├── source (tier|addon|override|denied)
└── recorded_at
```

## Helper funkciók

```sql
-- workspace → tenant resolver
SELECT public.tenant_id_for_workspace('<workspace_uuid>');

-- enabled feature set egy tenantra (a useFeature() hook ezt hívja)
SELECT * FROM public.tenant_enabled_features('<tenant_uuid>');
```

A `tenant_enabled_features` UNION-olja: tier features, addon features, positive
overrides — majd kivonja a negative overrides-okat.

## Index ajánlások (már alkalmazva a migrációkban)

- `tenant_workspaces (workspace_id)` — gyors workspace→tenant lookup
- `tier_features (tier_id, feature_id)` — unique pair index
- `addon_features (addon_id, feature_id)` — unique pair index
- `tenant_subscriptions (tenant_id, status)` — aktív subscription gyorsan
- `feature_gate_events (tenant_id, recorded_at desc)` — analytics

## Növekedési karakter

| Tábla | Várható méret | Megjegyzés |
|-------|---------------|------------|
| features | ~150 sor | Statikus katalógus |
| tier_features | ~300 sor | Tier × feature (ritkán változik) |
| tenants | 1–10k | Egy tenant = egy ügyfélszervezet |
| tenant_subscriptions | 1× tenant + history | partícionálás nem szükséges |
| tenant_addons | ~3× tenant átlag | |
| feature_gate_events | **nagy** | Pruning szükséges 90 nap után, partícionálás dátum szerint javasolt |
