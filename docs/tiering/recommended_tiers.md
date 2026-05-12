# Recommended Tiers + Addons

A DB-ben már bevezetett struktúra. Egyszerű 3-as létra + 5 célzott addon, hogy a
core tier-ek tiszták maradjanak és a komplex/költséges integrációk külön
árazhatók legyenek.

## Tier létra

| Tier | Cél szegmens | Anchor feature-ök | Featurek (DB) | Indoklás |
|------|--------------|-------------------|---------------|----------|
| **Freemium** | 1–10 fős csapat, kipróbálás | Tagok, alap naptár, leave self-submit, attendance log, workspace létrehozás | 41 | Nulla belépési küszöb; minden alapfunkció ami nélkül a többi nem aktiválható |
| **Pro** | 10–100 fős csapat, aktív koordináció | Skill matrix, kapacitástervezés, jóváhagyási láncok, exportok, MS365 sync, bővített naptár, reports | 101 | „Fence": minden olyan funkció itt van, ami napi koordinációt gyorsít |
| **Enterprise** | 100+ fő, multi-site, audit | SSO, audit log, attendance periods + payroll, telephely-coverage szabályok, decision memory, advanced analytics | 130 | „Fence": compliance + multi-site szabályok + minden Pro feature |

**Fence** = upgrade-kényszerítő funkciók. Pro-ban: bulk approval, MS365 sync,
exportok. Enterprise-ben: SSO/SCIM, audit log, payroll periods, advanced
coverage rules.

## Addon stratégia

Önállóan bekapcsolható kiegészítők — minden tier-rel kombinálhatók
(tipikusan Pro/Enterprise mellé), így a fő tier-ár alacsony marad.

| Addon | Featurek | Cél | Pricing hint |
|-------|----------|-----|--------------|
| **Agile addon** | Jira integráció + writeback + inline editor, Azure DevOps | Dev csapatok, akik Effectime-ban követik a sprint kapacitást | seat-based, +€3/seat |
| **Wellbeing addon** | Burnout engine, AI burnout predict | HR-vezérelt jólét-monitoring | tenant flat, +€49/hó |
| **Payroll addon** | Payroll export, payroll engine | Cégek, akik Effectime-ból bérszámfejtést tápolnak | seat-based, +€2/seat |
| **API addon** | Open API hozzáférés | Egyedi integrációk, BI rendszerek | tenant flat, +€99/hó |
| **AI addon** | Smart Schedule, Chat assist | AI-asszisztált tervezés és Slack/Teams chat | seat-based, +€4/seat |

## Mappolás logikai szabályok

- Egy feature lehet több tier-ben (örökléssel: minden Pro feat → Enterprise-ban is).
- Egy feature lehet egyszerre tier-ben **és** addon-ban (pl. ha a tier-be
  bevisszük basic módban, addon-nal advanced módot ad).
- A `tenant_feature_overrides` enabled=false a végső szó: addon vagy tier
  bekapcsolt feature-t is letilthat (pl. country-specifikus jogi okból).

## Resolver sorrend

`tenant_enabled_features(tenant_id)` SQL függvény (élő):

1. tier features (active subscription, ends_at jövőben)
2. ∪ addon features (active addon, ends_at jövőben)
3. ∪ positive overrides (enabled=true, expires_at jövőben)
4. − negative overrides (enabled=false felülír mindent)
