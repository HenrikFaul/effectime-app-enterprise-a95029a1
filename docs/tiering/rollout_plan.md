# Rollout Plan — Phase 13

## Fázisok

### Phase A — Internal dogfood (1. hét)
- ✅ DB séma + migrációk éles
- ✅ Tenant backfill (12 workspace → Freemium)
- ✅ Superadmin UI: Feature & Tier tab élő
- ✅ `useFeature()` hook elérhető
- 🔲 Belső csapat: 2 tenant Pro-ra, 1 Enterprise-ra a Superadmin UI-ban
- 🔲 Smoke teszt: minden modul indul, gating viselkedik a tier szerint
- KPI: 0 regresszió a meglévő flow-kban

### Phase B — Pilot (2–4. hét)
- 🔲 2–3 ügyfél kiválasztva (jelenleg Genisys, Bee Wise FM, PET Kupa)
- 🔲 Mindegyiknek explicit tier assign + 1-2 addon próbára
- 🔲 `feature_gate_events` napi monitoring
- 🔲 In-app feedback widget aktiválva
- KPI: < 5 panasz/hét, addon trial → paid conv > 30%

### Phase C — Soft launch (5–8. hét)
- 🔲 Új workspace creator: tier dropdown élő (default Freemium)
- 🔲 Pricing oldal frissítve (marketing site)
- 🔲 Stripe/Paddle integráció bekapcsolva (currently még nincs)
- 🔲 Auto-conversion a már Freemium tenantoknál ha túllépik a 10 seat limitet
- KPI: havi Pro conv ≥ 8%

### Phase D — GA (9. héttől)
- 🔲 Marketing kampány indítása
- 🔲 Sales playbook az Enterprise tier-hez
- 🔲 Country-specifikus payroll addon variants (HU/CZ/SK/PL)

## Toggles & feature flags

A teljes rendszer már „on" — a tenant_subscriptions / tenant_addons / overrides
táblákkal tetszőlegesen szabályozható. **Nem kell külön global feature flag**.

Vészhelyzet: Superadmin UI-ból egy SQL paranccsal vissza lehet állni
„mindenkinek minden Freemium" állapotba (de adat-vesztés nincs):

```sql
UPDATE tenant_subscriptions SET tier_id = (SELECT id FROM tiers WHERE tier_key='freemium');
UPDATE tenant_addons SET status='cancelled', ends_at=now();
```

## Monitoring KPI-k

| KPI | Forrás | Cél |
|-----|--------|-----|
| Active tenants per tier | `tenant_subscriptions` | growth tracking |
| Gate denial rate / feature | `feature_gate_events WHERE allowed=false` | upsell hotspot |
| Addon trial→paid % | `tenant_addons` status flow | > 30% |
| Backfill regression bug count | bug tracker | 0 |
| MRR per tier | billing system (jövő) | növekedés |
| Time-to-upgrade (signup→Pro) | tenant_subscriptions history | < 30 nap |

## Rollback

Bármelyik fázisból visszafordítható, mert:

- A katalógus tartalom (features/tiers/addons) nem törli meg az alkalmazás-
  funkciókat — csak gating-et ad hozzájuk
- A `tenant_feature_overrides` egyetlen tenanton instant kapcsolható
- A teljes tiering kapcsolat törölhető a táblák kiürítésével (a feature
  kód végig fut, csak gate nélkül)
