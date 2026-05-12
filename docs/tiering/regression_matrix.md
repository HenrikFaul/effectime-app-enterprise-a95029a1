# Regression Matrix — Phase 11

## Princípium

A tiering rendszer **bevezetése nem törheti a meglévő funkciókat**. A 12 már
backfill-elt tenant **Freemium** subscription-t kapott — minden Freemium
feature továbbra is elérhető nekik, egyetlen funkció sem tűnt el.

## Per-modul kockázat

| Modul | Feature-szám | Tier (default) | Kockázat | Akció |
|-------|--------------|----------------|----------|-------|
| auth | 8 | Freemium | preserve exactly | smoke: bejelentkezés, jelszó-reset |
| workspace | 7 | Freemium | preserve exactly | smoke: workspace létrehozás |
| members | 9 | Freemium | preserve exactly | smoke: meghívás, listázás |
| calendar | 11 | Freemium (alap) / Pro (advanced) | enhance | manual: havi nézet, sync |
| leave | 11 | Freemium (basic) / Pro (chains) | enhance | smoke: leave submit + approve |
| attendance | 7 | Pro+ | enhance | manual: napló, on-call |
| approvals | 7 | Pro+ | redesign-only (gating) | smoke: jóváhagyási inbox |
| reports | 6 | Pro+ | redesign-only | manual: report generálás |
| resources | 11 | Pro+ | enhance | manual: skill matrix |
| agile | 10 | Pro + Agile addon | risky-change | full integration test |
| ai | 3 | AI addon | risky-change | smoke: chat assist mock |
| settings | 10 | mind | preserve exactly | smoke: workspace settings |

## Acceptance criteria — kockázatos változások

**Agile (Jira integration)**
- Tenant Agile addon nélkül: jira_integration gate **denied**, UI elrejti az
  integráció gombot
- Tenant Agile addon-nal: integráció elérhető, OAuth flow változatlan

**AI features**
- Smart Schedule: AI addon nélkül a gomb disabled + upsell tooltip
- Burnout predict: Wellbeing addon nélkül a `/insights/wellbeing` route 404
  vagy upsell page

**Payroll**
- Payroll export: Payroll addon nélkül az export gomb hidden, RPC
  `attendance_payroll_export` 403-at ad

## Tesztharness terv

**Tenant fixture (Vitest integration test):**

```ts
// tests/integration/test_tier_behavior.ts
const t1 = await createTestTenant({ tier: 'freemium' });
const t2 = await createTestTenant({ tier: 'pro' });
const t3 = await createTestTenant({ tier: 'enterprise', addons: ['agile','ai'] });

expect(await isFeatureEnabled(t1.id, 'bulk_approval')).toBe(false);
expect(await isFeatureEnabled(t2.id, 'bulk_approval')).toBe(true);
expect(await isFeatureEnabled(t3.id, 'jira_integration')).toBe(true);
expect(await isFeatureEnabled(t1.id, 'attendance_log')).toBe(false); // Pro+
```

## Smoke test backfill validation

```sql
-- Minden backfill-elt tenant Freemium-en van?
SELECT t.name, ts.status, ti.tier_key
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
LEFT JOIN tiers ti ON ti.id = ts.tier_id;

-- Minden backfill-elt tenantnak van workspace linkje?
SELECT t.id, t.name, count(tw.id) AS ws_count
FROM tenants t LEFT JOIN tenant_workspaces tw ON tw.tenant_id = t.id
GROUP BY t.id, t.name HAVING count(tw.id) = 0;
-- Vár: 0 sor
```
