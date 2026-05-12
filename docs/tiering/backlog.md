# Implementation Backlog — Phase 14

## Quick wins (3–7 nap)

| # | Task | Effort | Függőség |
|---|------|--------|----------|
| 1 | Tenant Assignment view a Superadmin UI-ban (tier+addon assign formra) | 2 nap | — |
| 2 | Tenant override editor (feature × tenant × enabled bool) | 1 nap | #1 |
| 3 | Demo workspace creator: tier-select dropdown beépítése | 0.5 nap | — |
| 4 | CSV import/export a feature katalógusra | 1 nap | — |
| 5 | UpgradeBanner komponens + i18n kulcsok (`tiering.upgrade.*`) | 1 nap | — |
| 6 | `feature_gate_events` insert a UpgradeBanner megjelenésekor | 0.5 nap | #5 |

## Medium (2–4 hét)

| # | Task | Effort | Függőség |
|---|------|--------|----------|
| 7 | Hardcoded gating check inventory + cseréje `useFeature`-re | 5 nap | — |
| 8 | Stripe/Paddle integráció (subscription billing) | 8 nap | tier price stabil |
| 9 | Tenant audit timeline view (subscription/addon history) | 3 nap | #1 |
| 10 | Vitest integration tests (test_tier_behavior.ts) | 3 nap | — |
| 11 | E2E test: full Freemium→Pro upgrade flow | 2 nap | #8 |
| 12 | i18n: tier/addon/feature display nevek minden lokálban | 2 nap | — |

## Long (1–3 hónap)

| # | Task | Effort | Függőség |
|---|------|--------|----------|
| 13 | Country-specifikus payroll addon variants (HU/CZ/SK/PL) | 3 hét | legal review |
| 14 | Self-serve upgrade flow (in-app pricing + checkout) | 4 hét | #8 |
| 15 | SSO/SCIM (Enterprise tier feature) | 4 hét | identity provider választás |
| 16 | Feature-level usage limits (pl. AI hívások / hó) | 2 hét | usage metering tábla |
| 17 | Marketing site pricing oldal + comparator | 2 hét | tier nevek véglegesek |
| 18 | Tenant-level theming (Enterprise) | 1 hét | — |

## Mérföldkövek

- **M1 — Soft launch ready (4. hét):** #1–6 + #10
- **M2 — Self-serve billing (8. hét):** + #7, #8, #11, #14
- **M3 — GA (12. hét):** + #9, #12, #13, #15, #17

## Stakeholder függőségek

- Product: anchor feature lista véglegesítése (4 órás workshop)
- Finance: árazás megerősítése (Pro €8, Ent €299+€14, addonok)
- Legal: payroll compliance HU/CZ/SK/PL
- Ops: pilot ügyfél kiválasztás (Phase B kapuja)
