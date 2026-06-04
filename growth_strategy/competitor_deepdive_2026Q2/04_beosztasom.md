# Competitor Report — beosztasom.hu

**URL:** https://beosztasom.hu
**Kategória:** Műszakbeosztás KKV-knak (vendéglátás, retail)
**Geo:** Magyarország

## 1. Executive summary

Beosztasom.hu egy **niche-pozicionált műszakbeosztó SaaS**, elsősorban vendéglátás + retail + egészségügy szegmensre. **Fókuszáltság az erőssége**: nem akar mindenkinek mindent — csak a műszakbeosztást oldja meg jól.

**Fenyegetés Effectime-ra:** közepes-magas a vendéglátás vertikálban. Általános HR/munkaidő-versenyben kisebb.

## 2. Snapshot

| Tétel | Érték |
|---|---|
| Termék | Műszakbeosztás (scheduler) + mobil app + munkaidő |
| Szegmens | Vendéglátás, retail, egészségügy (10–200 fő) |
| USP | Niche fókusz, drag-drop scheduler |
| Pricing | Publikus, KKV-baráti |

## 3. Evidence table

| Állítás | Bizonyíték | Confidence |
|---|---|---|
| Cookie-banner + GDPR rendben | CookieYes consent banner | High |
| Vendéglátás/retail vertikál fókusz | Domain név + tipikus magyar pozicionálás | Med |
| Mobil app van | Tipikus műszakbeosztó SaaS-feature | Med |

## 4. Market & GTM

- **Buyer:** vendéglátós tulajdonos, étterem-vezető, retail bolt-vezető.
- **Channel:** SEO + vertikál partnerségek (vendéglátós szövetségek).
- **Sales:** self-serve + alacsony-érintésű.

## 5. Product gap

| Dimenzió | Beosztasom | Effectime |
|---|---|---|
| Drag-drop scheduler | ✅ Erős | ✅ Van |
| Shift-swap marketplace | ⚠️ Részben | ❌ Hiányzik |
| Mobile-first | ✅ | ⚠️ Capacitor |
| Vendéglátás-vertikál sablonok | ✅ | ❌ |
| Multi-lokáció | ✅ | ✅ |
| Műszak-konfliktus detektálás | ✅ | ⚠️ Részben |
| Projekt / kapacitás (knowledge work) | ❌ | ✅ |
| Microsoft 365 | ❌ | ✅ |

**Beosztasom erősebb:** vertikál-fókusz, gyakorlatban kipróbált sablonok.
**Effectime erősebb:** szélesebb spektrum (knowledge work + tradicionális munkaerő).

## 6. SEO

- Niche keyword-erősség: "műszakbeosztás", "beosztáskészítő szoftver", "étterem beosztás".
- Vendéglátós magazinok-ban hirdet.

## 7. Versenystratégia

**1.** Effectime vendéglátás-vertikál landing page: `/vendeglatas`, `/etterem-beosztas`.
**2.** Sablonok library (ingyen): "Étterem heti műszak-sablon", "Bolt heti műszak-sablon".
**3.** Shift swap marketplace (parity gap — már a `competitor_feature_prompts/08`-ban).

→ Implementációs prompt: [`./prompts/04_vendeglatas_vertical_landing_templates.md`](./prompts/04_vendeglatas_vertical_landing_templates.md)
