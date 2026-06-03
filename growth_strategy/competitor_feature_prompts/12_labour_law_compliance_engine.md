# Prompt 12 — Magyar Munka Törvénykönyve (Mt.) compliance engine

**Gap source:** Humanforce (award/compliance engine), nincs HU versenytárs aki ezt jól csinálná
**Effort:** L · **Strategic value:** Compliance-led sale (egészségügy, gyártás, vendéglátás)

## Problem
*"A vendéglátásban a Mt. szerint 11 óra megszakítás nélküli pihenőidő kell. Ha a beosztó eltéveszt, az 500 ezer Ft-os bírság munkavállalónként. Excelben senki nem ellenőrzi — ezért szerződik mindenki a Workforce-szal odakint."*

## User story
Mint beosztó, automatikusan szeretném figyelmeztető üzenetet kapni, ha a beosztásom megsérti a Mt. valamelyik szabályát (napi/heti pihenőidő, max munkaidő, túlóra plafon, éjszakai munka 18 év alatt, vasárnap-pótlék kötelező eset). A figyelmeztetés blokkoló admin-felülírással.

## Acceptance criteria
- [ ] `mt_rule_pack` adatstruktúra (verziózott, jogszabály-változás kezelhető)
- [ ] Implementált szabályok v1:
  - Min. 11 óra napi pihenőidő (Mt. 104. §)
  - Min. 48 óra heti pihenőidő (Mt. 106. §)
  - Max 12 óra napi munkaidő (Mt. 99. §)
  - Max 250 óra túlóra/év (Mt. 109. §)
  - Éjszakai munka tilalma 18 év alatt (Mt. 114. §)
  - Vasárnapi munka csak meghatározott esetben (Mt. 101. §)
- [ ] Real-time validáció a `CapacityPlanner`-ben (sárga = figyelmeztetés, piros = blokkoló)
- [ ] Admin "force" mód kötelező indoklással → audit log
- [ ] Havi compliance riport (PDF + CSV) — HR jegyzőkönyvként használható
- [ ] Verziózott szabálykészlet UI-ban látható (`Mt. rule pack v2026.01`)
- [ ] EU-bővítés előkészítve: SK Zákonník práce, CZ Zákoník práce, PL Kodeks pracy (külön rule packként)

## Anti-regression
- Meglévő beosztás-mentés folyamat változatlan — a compliance csak hozzáad
- Default tier (Free/Starter) csak warning-ot kap, Business+ tier blokkol

## Telemetry
- `compliance.violation_detected{rule}`, `compliance.force_save_used{rule}`, `compliance.report_downloaded`

## Marketing claim
*"Egyetlen magyar WFM, amely **automatikusan ellenőrzi a Munka Törvénykönyve betartását** — pihenőidő, túlóra plafon, vasárnap-pótlék. NAV-ellenőrzésre kész compliance riport egy kattintással."*

## Out of scope
- Bérszámfejtés (külön prompt #11)
- Kollektív szerződés-specifikus szabályok (workspace-szintű custom rule v2)
