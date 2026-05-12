# Pricing Model

## Javasolt árazási létra

| Tier | Tenant flat | Per seat | Megjegyzés |
|------|-------------|----------|------------|
| Freemium | €0 | €0 | max 10 seat (soft limit, telemetry-vel mérendő) |
| Pro | €0 | **€8 / seat / hó** | min 5 seat |
| Enterprise | €299 / hó | **€14 / seat / hó** | min 25 seat, SSO/audit/SLA included |

Az értékek a `tiers.price_monthly_eur` és `tiers.seat_price_monthly_eur`
oszlopokban tárolva — a Superadmin UI-ban szerkeszthetők.

## Fiscal weight rendszer

Minden feature kapott egy `fiscal_weight` értéket (1–10). Ez **belső**
relatív érték-jelző; nem egyenes ár. Használat:

- prioritás új feature-fejlesztéshez (high weight = high ROI claim)
- A/B kísérletek: `fiscal_weight ≥ 8` feature-öket célzott upsell modálokkal
  promotálni a Freemium gate-eknél
- Pricing review során: ha sok high-weight feature kerül egy addon-ba,
  emelhető az addon ára

## A/B kísérletek (1. negyedév)

| Kísérlet | Hipotézis | Mérendő |
|----------|-----------|---------|
| Pro €8 vs €12/seat | Az €8 megduplázza a paid conv-t | Freemium → Pro conv % |
| Enterprise flat 0 vs €299 | A flat fee tudatosítja az Enterprise pozíciót | Pro → Enterprise upgrade % |
| Agile addon trial 14 nap | Próbaidő után 30%+ marad | Trial activation → paid conv |
| Smart Schedule fence Pro-ba vs AI addon-ba | Ha Pro része, több Pro retention | 90-day retention |

## Telemetria

A `feature_gate_events` tábla már gyűjti minden gating eseményt (tenant_id,
feature_key, allowed bool, rendered_at). Ezzel mérhető:

- Mely Freemium gate okozza a legtöbb friction-t (= jó upsell target)
- Mely Pro feature ad legkevesebb engagement-et (= árazási érv ellen)

## Country-specifikus megfontolások (legal follow-up)

A payroll addon országonként eltérő compliance-t igényel (HU, CZ, SK, PL első
körben). Javaslat: a `tenant_addons.metadata` jsonb-ben `{country: 'HU'}`
tárolva, és per-country variant kód (`payroll_export_hu`, `_cz` stb.)
később.
