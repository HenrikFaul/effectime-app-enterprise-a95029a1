# Competitor Report — e-lock.hu (Kelio HU disztribútor)

**URL:** https://e-lock.hu
**Üzemeltető:** E-LOCK Kft. (Bodet Software / Kelio HU partner)
**Kategória:** Enterprise munkaidő-nyilvántartás + fizikai beléptetés + HR
**Stage:** Érett disztribútor, francia Kelio termék reseller-e
**Geo:** Magyarország

## 1. Executive summary

E-lock egy klasszikus, **hardver-szoftver bundle** disztribútor: a francia Kelio (Bodet Software) HR és munkaidő-nyilvántartó rendszerét forgalmazza, biometrikus terminálokkal, RFID kártyákkal együtt. Pozicionálás: **nagyvállalati referenciák** (Amazon, DHL, Auchan, Danone, Four Seasons, Sheraton, Panasonic, Caterpillar) — ez a fő bizalmi pajzs.

**Fenyegetés Effectime-ra:** közepes. Más szegmens (nagyvállalat + hardver), de a "munkaidő nyilvántartás" SEO-kulcsszavakra erős, és enterprise pitch-eknél versenytárs lehet.

## 2. Company snapshot

| Tétel | Érték |
|---|---|
| Termék | Kelio (Bodet Software, FR) magyar disztribúciója |
| Modules | Munkaidő, jelenlét, beléptetés, ütemezés, HR adatbázis, túlóra-kezelés |
| Hardver | Biometrikus terminálok (ujjlenyomat, arc), RFID, mobile app |
| Ügyfél-szegmens | 100+ fős vállalatok, multi-site, ipari + retail + hotel |
| Pricing | Nincs publikus ár — quote-based enterprise |
| Magyar referenciák | Auchan, DHL, Amazon HU jelenlét |

## 3. Evidence table

| Állítás | Bizonyíték | Confidence | Miért fontos | Follow-up |
|---|---|---|---|---|
| 13+ Tier-1 enterprise referencia | Homepage logo wall (Amazon, DHL, Auchan, Danone, Four Seasons, Sheraton, Panasonic, Caterpillar, Novotel, Hobie Cat) | High | Nagy bizalom-pajzs enterprise sale-eknél | Ellenőrizni mely cégek HU vs. globális Kelio-ügyfél |
| Kelio = érett, francia ERP-class HR modul | Bodet Software 1860 óta működik (FR), Kelio évek óta CEE-ben | High | Termék-érettség nem kérdés | — |
| Hardver-függő bevezetés (terminálok) | Homepage képek: ujjlenyomat-olvasó terminálok | High | Magas CapEx → lassú bevezetés, nem SMB | — |
| Magyar nyelvű felület + support | HU domain, HU telefon | High | HU enterprise compliance OK | — |

## 4. Market assessment

- **Buyer persona:** HR igazgató + IT igazgató + biztonsági vezető nagyvállalatnál (100–5000 fő), ahol a fizikai beléptetés és a munkaidő egyetlen rendszerben kell legyen.
- **Pain:** compliance (Mt.), túlórakezelés, beléptetés naplózása, csalás-megelőzés.
- **Switching cost:** **nagyon magas** — telepített hardver, Active Directory integráció, payroll-export.
- **Effectime overlap:** ~20%. Effectime nem cél a hardveres beléptetés, de a munkaidő-naplózás és műszakbeosztás funkciók átfednek.

## 5. Product assessment

| Dimenzió | Kelio (e-lock) | Effectime |
|---|---|---|
| Hardver-integráció | ✅ Erős (saját terminál) | ❌ Nincs (capacitor mobile only) |
| Beléptetés-szoftver | ✅ Saját | ❌ Nincs |
| Munkaidő-naplózás | ✅ Érett | ✅ Van |
| Műszakbeosztás | ✅ Van | ✅ Van |
| Cloud SaaS UX | ⚠️ Klasszikus, B2B-feel | ✅ Modern |
| Onboarding idő | Hetek-hónapok (hardver) | < 1 nap |
| Mobil app | ✅ Van | ⚠️ Capacitor wrapper |
| AI / forecasting | ❌ Nincs | ⚠️ Roadmap |

## 6. GTM assessment

- **Csatorna:** direkt enterprise sales + partner-csatorna (rendszerintegrátorok).
- **Sales cycle:** 3–9 hónap (hardver + telepítés).
- **Marketing:** referencia-driven, kevés organikus content, B2B-trade-fair jelenlét.

## 7. Competition & positioning

E-lock előny: **hardver + szoftver + referenciák egy csomagban**. Hátrány: **nem SaaS-natív**, lassú bevezetés, drága.

Effectime wedge: SMB → mid-market sávban (10–250 fő), ahol nem kell hardver, és a workspace 1 nap alatt élesedhet.

## 8. Financial assessment

Privát Kft., nyilvános pénzügyi adat csak részben elérhető (e-beszamolo.im.gov.hu). Becsült HU munkaidő-szoftver TAM: ~2-3 Mrd HUF/év (privát becslés, nem auditált).

## 9. Team assessment

E-lock helyi csapat (kis disztribútor, ~10 fő), a termék-fejlesztés Bodet (FR) kezében.

## 10. Risks (Effectime POV)

| Kockázat | Severity | Mitigation |
|---|---|---|
| Enterprise tender-ekből kiszorulhat Effectime referencia-hiány miatt | High | Pilot-case study (PanelLakó, Hobbeast) közzététele, ISO 27001 roadmap |
| Hardver-integráció hiánya kizárhatja ipari ügyfeleket | Med | QR-kód / mobil GPS clock-in, partner-integráció ZKTeco-val |

## 11. Diligence questions

- Milyen Kelio licenc-feltételei vannak?
- HU-ban hány aktív vevő van (vs. csak globális logo)?
- API nyitott-e harmadik fél integrációra?

## 12. Comparable companies

Bodet Software (FR), Nexum (HU), Humanforce (AU), Ascentis (US), TimeMoto (NL).

## 13. Investment view (Effectime competitive stance)

**Verdikt:** e-lock nem direkt SaaS-versenytárs, de **enterprise pitch-eknél meg fog jelenni**. Effectime válasz: **SaaS-natív + AI-forward + 10× gyorsabb bevezetés** narratíva, valamint a hiányzó hardver-integrációt egy partner-marketplace-ben pótolni (ZKTeco, Suprema mobile QR fallback).

→ Implementációs prompt: [`./prompts/01_qr_mobile_clock_in_without_hardware.md`](./prompts/01_qr_mobile_clock_in_without_hardware.md)
