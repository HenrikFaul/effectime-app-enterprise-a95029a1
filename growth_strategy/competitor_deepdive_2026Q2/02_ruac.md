# Competitor Report — ruac.eu

**URL:** https://ruac.eu
**Üzemeltető:** Different Innovations Zrt. (Győr)
**Kategória:** SMB online munkaidő-nyilvántartás + jelenléti ív generátor + mobil app
**Geo:** Magyarország (CEE potenciál)

## 1. Executive summary

RUAC egy **klasszikus magyar SMB SaaS**: egyszerű jelenléti-ív + munkaidő-nyilvántartás + mobil app. Pozicionálás: **"10 perc alatt bevezethető, ingyenes próba"**. Üzemeltető a Different Innovations Zrt., több magyar SaaS terméket szolgáltató cég.

**Fenyegetés Effectime-ra:** **MAGAS** — ugyanaz a szegmens (HU SMB), ugyanaz a pain (munkaidő nyilvántartás), ugyanaz a pricing-stratégia (freemium). Direkt szubsztitúció.

## 2. Snapshot

| Tétel | Érték |
|---|---|
| Termék | Online jelenléti-ív + munkaidő-nyilvántartás + mobil app |
| Hardver | Opcionálisan beléptető eszközök (`/belepteto-eszkozok/`) |
| USP | "10 perc bevezetés", "ingyen próba" |
| Pricing | Publikus (`/#araink` szekció) |
| Ügyfél-szegmens | KKV (10–100 fő) |
| Marketing | Facebook jelenlét, Hungarian-only |

## 3. Evidence table

| Állítás | Bizonyíték | Confidence |
|---|---|---|
| 10 perces bevezetést ígér | Homepage hero tagline | High |
| Mobil app van | Hero másodlagos USP | High |
| Beléptető hardver-opcionális | `/belepteto-eszkozok/` aloldal | High |
| Hozzáférhető magyar pricing | `/#araink` ankor link | High |
| Vékony tartalom-marketing | Csak `/kategoria/blog/`, nem mély | Med |

## 4. Market & GTM

- **Buyer:** kisvállalkozás tulajdonosa / HR-felelős, aki Excelből / WhatsAppból szabadulna.
- **Channel:** SEO + Facebook + direkt értékesítés.
- **Sales cycle:** önkiszolgáló (self-serve).

## 5. Product gap vs. Effectime

| Dimenzió | RUAC | Effectime |
|---|---|---|
| Munkaidő-nyilvántartás | ✅ | ✅ |
| Mobile app | ✅ Natív | ⚠️ Capacitor |
| Beléptető hardver-opció | ✅ | ❌ |
| Szabadság-kezelés | ⚠️ Korlátozott | ✅ Komplett |
| Műszakbeosztás | ❌ | ✅ |
| Projekt / kapacitás-tervezés | ❌ | ✅ |
| AI demand forecasting | ❌ | ⚠️ Roadmap |
| Microsoft 365 integráció | ❌ | ✅ |
| Multi-lokáció / multi-workspace | ⚠️ | ✅ |
| UX / design szín-vonal | ⚠️ Klasszikus | ✅ Modern, gradient |

**Effectime erősebb:** szélesebb funkció-stack (szabadság + műszak + kapacitás + projekt + AI). **RUAC erősebb:** natív mobile, hardver-integráció.

## 6. SEO

- Domain authority: alacsony (Tier-3).
- Long-tail HU keyword: "jelenléti ív minta", "munkaidő nyilvántartás Excel" — ezek hiányoznak Effectime SEO-stackből.
- Blog: van, de vékony.

## 7. Risks (Effectime POV)

| Kockázat | Severity |
|---|---|
| RUAC könnyebben felvehető (10 perc onboarding pitch) | High |
| RUAC természetes magyar branding (`.eu` magyar Kft.) | Med |

## 8. Versenystratégia

**1.** Effectime onboarding wizard ≤ 3 perc (parity).
**2.** "Excel → Effectime" 1-click CSV import.
**3.** SEO oldal: "Jelenléti ív sablon ingyen letölthető" (RUAC nem birtokolja, de ráirányítja a forgalom).
**4.** Funkció-szélesség pitch: "RUAC csak jelenléti, Effectime end-to-end workforce platform".

→ Implementációs prompt: [`./prompts/02_3min_onboarding_wizard_excel_import.md`](./prompts/02_3min_onboarding_wizard_excel_import.md)
