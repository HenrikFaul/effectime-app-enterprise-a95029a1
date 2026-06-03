# Prompt 01 — Microsoft Teams native leave bot

**Gap source:** Absentify, Vacation Tracker
**Effort:** M · **Strategic value:** High · **Required for tier:** Business+

## Problem (user-language)
*"Mindenki egész nap Teams-ben van. Ha a szabadságkérés egy külön weboldalra küld, az emberek elhalasztják vagy elfelejtik. Az Absentify-nál egy `/leave` parancs elég."*

## User story
Mint munkavállaló, a Teams chatben szeretnék szabadságot kérni (`/effectime szabadság 2026-07-15 → 2026-07-22`) és a vezetőm közvetlenül a Teams-ben jóváhagyni egy Approve/Reject gombbal.

## Acceptance criteria
- [ ] MS Teams app manifest publikálva a HU/EU AppSource-on
- [ ] Bot parancsok: `/szabadság`, `/beosztás`, `/jelenlét`, `/balance`
- [ ] Adaptive Card jóváhagyási folyamat (vezető 1 kattintással hagy jóvá)
- [ ] OAuth: meglévő Microsoft 365 connector újrahasznosítása
- [ ] Magyar + angol bot lokalizáció (i18n keys: `teams_bot.*`)
- [ ] Audit log: minden bot-akció `platform_audit_events`-be
- [ ] Tier-gating: csak Business+ tier-ben elérhető

## Anti-regression
- Meglévő webes szabadságkérés folyamat változatlan
- A bot **nem** lehet a single point of failure (web fallback mindig elérhető)

## Telemetry
- `teams_bot.request_submitted`, `teams_bot.approved_in_teams`, `teams_bot.time_to_approval_ms`

## Marketing claim enabled
*"Az Effectime az egyetlen magyar WFM platform, amely **natív Teams botban** kezeli a szabadságkérést — egy `/szabadság` parancs és kész."*

## Out of scope
- Slack és Google Chat bot (külön prompt később)
- Bot-alapú beosztás-szerkesztés
