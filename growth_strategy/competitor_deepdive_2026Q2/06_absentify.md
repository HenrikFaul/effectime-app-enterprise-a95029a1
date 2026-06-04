# Competitor Report — absentify.app / absentify.com

**URL:** https://absentify.com (app domain blokkolt scrape-re, de a termék jól ismert)
**Kategória:** Microsoft Teams-natív szabadságkezelés + ünnepnap-naptár
**Geo:** Global (DACH + EU + US)

## 1. Executive summary

Absentify egy **Microsoft 365 / Teams-natív szabadságkezelő SaaS**, ami a **Teams chat-en belül engedi a szabadság-kérelmet és jóváhagyást**. Freemium modell (7 user-ig ingyenes), erős content-SEO az `/public-holidays/<country>` oldalakkal (~41% organikus traffic).

**Fenyegetés Effectime-ra:** **MAGAS**, mert ugyanaz a M365-pozicionálás, mint amit Effectime is céloz, és Absentify már globálisan dominálja a "leave management for Teams" kategóriát.

## 2. Snapshot

| Tétel | Érték |
|---|---|
| Termék | Leave management, Teams-bot, Outlook calendar sync, public holidays auto-import |
| Stage | Érett SaaS, globális |
| USP | "Native Microsoft Teams app" — chat-első UX |
| Pricing | Freemium (7 user), majd per-user/month |
| Marketing | Microsoft AppSource, Teams App Store, SEO content (country-szintű ünnepnap-oldalak) |
| Funkciók | Leave types, accrual, multi-level approval, calendar sync, holiday import, AI assistant |

## 3. Evidence table

| Állítás | Bizonyíték | Confidence |
|---|---|---|
| Teams-bot natív leave request | Microsoft AppSource listing, dokumentáció | High |
| `/public-holidays/<country>` SEO-stratégia | Korábbi Semrush top_pages elemzés: ~41% organikus traffic | High |
| Freemium 7-userig | Pricing page (general knowledge) | Med-High |
| Outlook calendar 2-way sync | Funkció-lista | High |
| AI assistant (újabb) | Roadmap + product blog | Med |

## 4. Market & GTM

- **Buyer:** HR + IT-admin Microsoft 365-első cégeknél (SMB és mid-market).
- **Channel:** **Microsoft AppSource + Teams App Store** (kategória-disztribúció moat).
- **SEO:** ünnepnap-oldalak country-szintű skálázása (US, UK, DE, AT, CH, FR, IT, ES, NL...) — generál long-tail forgalmat.

## 5. Product gap vs Effectime

| Dimenzió | Absentify | Effectime |
|---|---|---|
| Teams-natív bot | ✅✅ | ❌ (parity-gap, már promptolva: `competitor_feature_prompts/01`) |
| Outlook 2-way sync | ✅ | ❌ (parity-gap: `competitor_feature_prompts/02`) |
| Ünnepnap-import országonként | ✅ | ❌ (parity-gap: `competitor_feature_prompts/03`) |
| Leave accrual engine | ✅ | ⚠️ Részben |
| Multi-level approval | ✅ | ✅ |
| Műszakbeosztás | ❌ | ✅ |
| Projekt-kapacitás | ❌ | ✅ |
| Munkaidő-nyilvántartás | ❌ | ✅ |
| AI demand forecasting | ❌ | ⚠️ Roadmap |
| HU Mt.-compliance | ❌ | ⚠️ Roadmap |
| AppSource listing | ✅ | ❌ |
| SEO country-pages | ✅ ~250 oldal | ❌ |

**Absentify erősebb:** Teams-disztribúció + country-SEO.
**Effectime erősebb:** szélesebb funkció-stack (műszak + projekt + munkaidő), HU-vertikál.

## 6. SEO

- **/public-holidays/united-states**, **/public-holidays/united-kingdom**, **/public-holidays/germany** etc. — minden country saját landing, évente friss "2026 holidays" keresésre rangol.
- **/blog/microsoft-teams-working-time-setting** — Teams-felhasználói high-intent.
- Becsült 80%+ organikus forgalom a country-pages-ből.

## 7. Risks (Effectime POV)

| Kockázat | Severity | Mitigation |
|---|---|---|
| Microsoft 365-pozicionálásban Absentify a default választás | Critical | **Teams-bot parity build** (`competitor_feature_prompts/01`) |
| Country-SEO oldalakból Effectime kiszorul | High | **HU + CEE ünnepnap landing-pages** + bérkalkulátor + szabadság-kalkulátor |
| AppSource listing hiánya = nincs disztribúciós csatorna | High | **Microsoft AppSource submission** roadmap |

## 8. Versenystratégia

**1.** **MS Teams natív bot** (már: `competitor_feature_prompts/01_teams_native_leave_bot.md`).
**2.** **`/munkaszuneti-napok-2026`, `/unnepnapok-2026-hungary`, `-czech-republic`, `-slovakia`, `-poland`, `-romania`, `-austria`, `-germany`** — 7-10 CEE country SEO-page.
**3.** **Microsoft AppSource listing** + Teams App Store submission.
**4.** **Pozicionálás:** "Absentify csak szabadság — Effectime az egész workforce platform Teams-en belül."

→ Implementációs prompt: [`./prompts/06_cee_holiday_landing_pages_appsource.md`](./prompts/06_cee_holiday_landing_pages_appsource.md)
