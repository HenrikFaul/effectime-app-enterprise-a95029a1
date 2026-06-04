# Competitor Deep-Dive — 2026 Q2

**Készült:** 2026-06-04
**Szerző:** Venture Nexus analysis mode (Lovable AI)
**Cél:** Effectime versenytárselemzése 6 közvetlen / közeli versenytársra HU + DACH piacon. Minden report **decision-grade**, evidence-based, és a hozzá tartozó `prompts/` mappa tartalmazza az **implementálható build-prompto­kat**, amelyekkel az Effectime-ot felül­múló (UX / SEO / funkció) válasz építhető.

> ⚠️ A prompt-fájlok **specifikációk**, nem auto-implementálandók. A PM triage után konvertálandók `versioning/` ticketté a repó governance-szabályai szerint.

## Versenytárs lefedettség

| # | Versenytárs | Szegmens | Piac | Fő fenyegetés Effectime-ra |
|---|---|---|---|---|
| 1 | [e-lock.hu](./01_e-lock.md) (Kelio reseller) | Enterprise munkaidő + beléptetés + HR | HU, nagyvállalat | Hardver-bundle + nagyvállalati referenciák (Auchan, DHL, Amazon) |
| 2 | [ruac.eu](./02_ruac.md) | SMB online jelenléti ív + mobil app | HU, KKV | Egyszerű onboarding ("10 perc"), olcsó ár |
| 3 | [olmunkaido.hu](./03_olmunkaido.md) | Online munkaidő-nyilvántartás | HU, KKV | SEO erős, hosszú tartalmi blog |
| 4 | [beosztasom.hu](./04_beosztasom.md) | Műszakbeosztás KKV-knak | HU, KKV (vendéglátás) | Niche pozicionálás, csak beosztás |
| 5 | [nexon.hu](./05_nexon.md) | Enterprise HR + bér + munkaidő | HU, piacvezető | Bérszámfejtés + komplett HR ökoszisztéma, 30+ év |
| 6 | [absentify.app](./06_absentify.md) | Teams-native szabadságkezelés | Global, SMB | Microsoft 365 integráció, freemium |

## SEO / domain snapshot (összefoglaló)

| Domain | Becsült HU keyword rank | Erős oldalak | Effectime gap |
|---|---|---|---|
| nexon.hu | Tier-1 (bérkalkulátor, ünnepnapok) | `/berkalkulator`, `/munkaszuneti-napok`, blog | Évente keresett naptári + kalkulátor oldalak |
| olmunkaido.hu | Tier-2 (Mt. cikkek) | Munkajogi blog, jogszabály cikkek | Mt.-tartalom hiánya |
| absentify.com | Tier-2 globális | `/public-holidays/<country>`, Teams how-to | Country-specifikus szabadság-oldalak |
| ruac.eu | Tier-3 | Homepage + GYIK | Vékony tartalom |
| e-lock.hu | Tier-3 (hardver-keresések) | Beléptetés terméklapok | Hardver-tartalom hiánya |
| beosztasom.hu | Tier-3 (műszak niche) | Niche landing | Vendéglátás-specifikus oldalak |

## Stratégiai szintézis — top 5 megelőzési tétel

1. **Bérkalkulátor + ünnepnap-naptár tartalom** (nexon, absentify mintájára) → SEO-tömeges forgalom, alacsony build-cost
2. **Mt. compliance engine** (olmunkaido + nexon parity) → enterprise sale enabler
3. **Microsoft Teams natív bot** (absentify parity) → HU enterprise default Teams
4. **Hardver-agnosztikus beléptetés/QR clock-in** (e-lock parity, hardver nélkül) → SMB belépési pont
5. **Bérszámfejtés-export csomag** (nexon + Nexum) → HU-specifikus moat

## Prompts mappa

A `./prompts/` mappa 6 build-promptot tartalmaz, mindegyik egy-egy versenytárs legjobb funkciójára / pozicionálási elemére irányul. Self-contained, AI build-agent-be ejthető specifikációk.
