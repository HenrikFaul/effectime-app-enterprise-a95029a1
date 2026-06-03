# Prompts 02-05, 07-09, 13-18 — Compact Specs

> Top 5 (#01, #06, #10, #11, #12) have dedicated files. The remaining 13 prompts are kept compact here; promote to a dedicated file when prioritised.

---

## 02 — Outlook 2-way calendar sync
**Source:** Absentify · **Effort:** M
**Need:** Approved leaves push as "Out of office" events into the employee's Outlook calendar, and Outlook OOO entries pull back as draft leave requests in Effectime. Use existing Microsoft Graph token. Telemetry: `outlook_sync.event_pushed`, `outlook_sync.event_pulled`. Claim: *"A szabadság automatikusan megjelenik az Outlook naptáradban — nem kell duplán adminisztrálni."*

## 03 — Public holidays auto-import per country
**Source:** Absentify, Vacation Tracker · **Effort:** S
**Need:** Auto-seed statutory holidays from a Nager.Date-style feed for HU, SK, CZ, PL, RO, DE, AT (CEE focus). Admin can override per workspace. Yearly auto-refresh. Locale-aware naming. Claim: *"Évente egyszer sem kell kézzel beírni az ünnepnapokat — mi karbantartjuk."*

## 04 — Leave accrual rules engine
**Source:** Vacation Tracker, Humanforce · **Effort:** L
**Need:** Configurable accrual: proportional monthly, anniversary-based, carry-over caps, expiry rules, seniority-based bonus days (Mt. 117. §). Workspace template + per-employee override. Audit log. Claim: *"Életkor-alapú pótszabadság, arányos időközi felhalmozás, év végi átvitel — automatikusan a Mt. szerint."*

## 05 — Multi-level approval chains
**Source:** Vacation Tracker, Deputy · **Effort:** M
**Need:** Configurable N-level approval flow (e.g. team lead → dept head → HR). Conditional routing (>5 nap esetén HR is). Delegation when approver on leave. Claim: *"Több-szintű jóváhagyás konfigurálható módon — a vezetők távollétében automatikus delegálás."*

## 07 — Utilisation & capacity reports
**Source:** Resource Guru · **Effort:** M
**Need:** Dashboard: utilisation %, billable vs non-billable hours, capacity vs demand chart, per-person, per-team, per-project. Exportálható PDF + Excel. Claim: *"Lásd egy pillantásra, melyik csapat túlterhelt, melyik alulhasznált."*

## 08 — Shift swap marketplace
**Source:** When I Work, Deputy · **Effort:** M
**Need:** Employee can publish a shift to the team marketplace; eligible colleagues claim it; manager auto-approves if rules pass (compliance, qualification). Push notif. Claim: *"Csere kollégával 30 másodperc alatt — vezetői beavatkozás nélkül, ha minden szabály stimmel."*

## 09 — AI demand forecasting → auto-shift generation
**Source:** Deputy · **Effort:** L · **Strategic moat**
**Need:** Ingest historical signals (POS sales, foot traffic, weather, past schedules) → ML model predicts demand per slot → auto-generates optimal shift plan respecting compliance + employee preferences. Use Lovable AI Gateway. Claim: *"Az AI megtervezi a jövő heti beosztásodat 30 másodperc alatt — te csak jóváhagyod."*

## 13 — SSO / SAML 2.0 / SCIM provisioning
**Source:** Nexum, Humanity · **Effort:** M · **Required for >250 fő deals**
**Need:** Azure AD, Okta, Google Workspace SSO. SCIM 2.0 for auto user provisioning/deprovisioning. Enterprise tier only. Claim: *"Enterprise-szintű hitelesítés: Azure AD SSO, automatikus user-szinkron — IT csak 1× állítja be."*

## 14 — In-app team chat
**Source:** When I Work · **Effort:** M
**Need:** Lightweight chat tied to shifts/teams (nem általános IM). Shift comment thread, @mention, push notif. Supabase Realtime. Claim: *"A beosztáshoz kötött chat — ne keresd a kontextust 5 csatornában."*

## 15 — GPS-validated clock-in
**Source:** When I Work, Deputy · **Effort:** M
**Need:** Mobile app-ban GPS-koordináta + geofence-ellenőrzés a clock-in pillanatában. Vendéglátás, építőipar. GDPR-banner kötelező. Opt-in workspace szinten. Claim: *"Csak a helyszínen lehet bejelentkezni — geofence + GPS, GDPR-megfelelően."*

## 16 — Training / certification expiry tracking
**Source:** Deputy · **Effort:** S
**Need:** Per-employee skills + cert expiry dátumok. Auto-figyelmeztetés 30/14/7 nappal lejárat előtt. Beosztáshoz kötés: csak érvényes cert-tel rendelkező osztható be. Egészségügy + ipar. Claim: *"Soha többé lejárt egészségügyi alkalmasság miatti bírság."*

## 17 — Sub-3-minute onboarding wizard redesign
**Source:** Absentify · **Effort:** S
**Need:** 5 step wizard: workspace name → import team CSV/M365 → set holidays → invite manager → first shift template. Progress bar, skip-everything, sample data. Claim: *"3 perc alatt élesben."*

## 18 — Public booking / availability share link
**Source:** Resource Guru · **Effort:** S
**Need:** Public read-only URL with team availability (freelance, ügynökség use-case). Configurable: which fields visible, password-protected, expiry date. Claim: *"Oszd meg az ügyfeleddel a csapatod elérhetőségét — login nélkül, biztonságosan."*
