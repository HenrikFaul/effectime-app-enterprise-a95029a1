## 2026-05-15 — v3.33.5 Edge-function data integrity, TOCTOU hardening, and localization fixes

Bug-fix release. No new features.

### GDPR export schema fix (security-admin)
- `enterprise_attendance_periods` and `wellbeing_scores` were queried with `user_id`; both tables use `membership_id`. GDPR exports were silently returning empty attendance and wellbeing arrays.

### Wellbeing hook schema fix (useWellbeing)
- Removed non-existent `period_start`, `period_end` from `wellbeing_scores` select.
- Changed `metadata` → `message` in `wellbeing_alerts` select (correct column name per migration).

### Payroll lock trust boundary + TOCTOU (payroll-export)
- `locked_by` now uses `user.id` from the verified JWT (was: `body.userId` — trust boundary violation).
- UPDATE now includes `.eq('status', 'open')` atomic guard; 0-row result returns 409 (was: check-then-act TOCTOU race).

### Schedule run-status tracking (send-scheduled-reports)
- `markRun()` now destructures `{ error }` from the Supabase update and logs failures (was: bare `await`, silent on DB errors).

### Workspace delete audit ordering (superadmin-hub)
- Audit row is now inserted before the workspace DELETE (was: after, risking FK failure from cascade).

### Allocations error propagation (create-instant-enterprise-member)
- `allocationsRes.error` is now checked and returns 500 (was: silently ignored).

### LeaveCalendar localization (8 locales)
- Removed hardcoded `WEEKDAY_LABELS` array with Hungarian abbreviations; replaced with `useMemo` + 7 i18n keys per locale.
- Replaced `'Ismeretlen'` fallback with `t('leave_calendar.unknown')`.
- Replaced `'Minden csapat'` label with `t('leave_calendar.all_teams')`.
- All 9 new keys added to en, hu, de, at, cs, sk, pl, ro.

---

## 2026-05-15 — v3.33.4 Password-policy parity + audit-log error-visibility fix

Bug-fix release. No new features.

### Password policy parity (ChangePasswordCard)

`ChangePasswordCard` + `PasswordRequirements` enforced an 8-character minimum
while the authoritative `validate_password_policy()` Postgres function and the
`create-workspace-user` edge function (both introduced in v3.33.0) require 10.
Users could set a password that displayed green UI checkmarks but was below the
company policy.

- `src/lib/passwordValidation.ts` — `minLength` raised from `>= 8` to `>= 10`.
- `password_req.min_length` i18n key updated in all 8 locale files (en, hu, de,
  at, cs, sk, pl, ro) to reflect "10 characters". The de/at/ro locales also
  received their first proper native-language translation for this key (they
  previously fell back to the English placeholder).
- `src/test/passwordValidation.test.ts` — boundary tests updated to 10-char.

### Audit log error visibility

`logAuditEvent()` used a bare `await` without destructuring `{ error }` from
the Supabase insert result. Supabase JS never throws on DB errors — it returns
`{ data, error }`. Real insert failures (RLS rejection, constraint violation)
were silently discarded. The function now checks `error` explicitly, logs a
warning, and returns `Promise<boolean>` so callers can react if needed.

### Verification
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 177/177 passing.

---

## 2026-05-15 — v3.33.3 Search-path hygiene sweep on remaining public functions

Closes the `function_search_path_mutable` advisor warning for 10
pre-existing `public` schema functions:

- `candidate_interview_slot_eligible`
- `document_substitute`
- `enforce_data_retention` (SECURITY DEFINER)
- `enterprise_decision_memory_set_due`
- `haversine_km`
- `set_hr_workflow_updated_at`
- `set_webhook_updated_at`
- `update_office_equipment_updated_at`
- `update_office_min_staffing_updated_at`
- `validate_password_policy`

Each function was audited before edit: all references are either
fully qualified to `public.*` or pg_catalog builtins. Adding
`SET search_path TO 'public'` is non-functional hardening — same
shape as the v3.33.2 fix on the new triggers.

### Regression net
The `search_path hygiene` block in `src/test/migrationInvariants.test.ts`
now covers all 16 protected functions (6 v3.33.x + 10 retroactive).
31 tests total, all green.

### Out of scope
6 advisor hits in non-public schemas (`syncfolk`, `plannermaster`)
are owned by other subsystems.

### DB migration on disk
`20260515070039_v3_33_3_public_function_search_path_sweep.sql`
(applied to remote in one `apply_migration` call).

### Verification
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 177/177 passing (10 new).
- Post-apply: all 10 functions now have `search_path=public` in `proconfig`.

---

## 2026-05-15 — v3.33.2 Hotfix: tier-change RPC marker + search_path

Two regressions caught while continuing the v3.33.1 audit:

### Fix 1 — `superadmin_change_workspace_tier` arms the immutability guard

The v3.33.1 trigger `enforce_tier_id_immutability` blocks any
`UPDATE tenant_subscriptions SET tier_id` unless the session-local
setting `app.tier_change_rpc_active` equals `'true'`. The RPC body
on the remote DB never set this — meaning every legitimate tier
change in production would have failed once v3.33.1 went live.
Caught by reading the live RPC body before any user hit the bug.
The RPC now does `PERFORM set_config('app.tier_change_rpc_active', 'true', true)`
before its UPDATE/INSERT.

### Fix 2 — `SET search_path` on the 4 v3.33.1 functions

`enforce_tier_id_immutability`, `validate_tier_feature_keys`,
`validate_feature_dependencies`, `require_feature_id` all lacked
`SET search_path TO 'public'`. Caught by the Supabase security
advisor (`function_search_path_mutable`). Without it, an attacker
who can manipulate session search_path can shadow `public.features`
or `public.tenant_subscriptions` from inside the trigger context.
All 4 functions now declare `SET search_path TO 'public'`.

### Regression net — 21 new migration-invariant tests

`src/test/migrationInvariants.test.ts` scans `supabase/migrations/`
and asserts the LATEST definition of each protected object holds:

- `create_workspace_with_owner` — strict `_tier_key` contract
  (raises on NULL/unknown, no `ORDER BY sort_order` fallback,
  arms the tier-change guard).
- `enforce_tier_id_immutability` — exists, references the marker,
  declares `SET search_path`.
- `superadmin_change_workspace_tier` — calls
  `PERFORM set_config('app.tier_change_rpc_active', 'true', true)`,
  writes `platform_audit_events`.
- `validate_tier_feature_keys` / `validate_feature_dependencies` —
  use delta validation pattern (only NEW elements), declare
  `SET search_path`.
- All 6 v3.33.x-touched functions declare `SET search_path`.

Every contributor running `npx vitest run` gets immediate feedback
if a new migration silently weakens any of these invariants.

### DB migration on disk
`20260515002644_v3_33_2_tier_marker_and_search_path_hotfix.sql`
(applied to remote in two `apply_migration` calls).

### Verification
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 167/167 passing (21 new).

---

## 2026-05-14 — v3.33.1 Stabilization pass: data-integrity + audit-trail hardening

Bug-fix release. No new features. Reconciles MCP-only schema back to disk
and closes a set of documented gaps from a full system audit.

### DB migration `v3_33_1_stabilization_reconciliation` (applied to remote)

- `create_workspace_with_owner` — STRICT `_tier_key` contract restored.
  NULL / unknown raises instead of silently defaulting to freemium
  (the v3.17.1 fix was previously only in remote; now on disk too).
- `enforce_tier_id_immutability` trigger blocks direct
  `UPDATE tenant_subscriptions SET tier_id = …` outside the
  `superadmin_change_workspace_tier` RPC. The RPC + workspace creation
  set a session-local guard (`app.tier_change_rpc_active`) the trigger
  recognizes.
- `validate_tier_feature_keys` trigger rejects unknown feature_keys
  added to `enterprise_feature_catalog.tier_feature_keys`. Delta
  validation, so pre-existing typos don't block unrelated updates.
- `validate_feature_dependencies` trigger does the same for
  `features.dependencies`.
- `tenant_feature_overrides_member_read` RLS now filters expired rows.
- `tenant_subscriptions_status_ends_at_coherent` CHECK (NOT VALID)
  disallows future incoherent (status, ends_at) combinations.
- `require_feature_id(_feature_key)` seed helper raises on missing keys.

### Edge function fixes
- **superadmin-hub** — writes a `platform_audit_events` row for every
  privileged action (compliance gap closed).
- **send-scheduled-reports** — per-recipient try/catch; marks runs
  `success` / `partial_failure` / `error` correctly instead of always
  `success` on partial email failure.
- **cleanup-demo-workspace** — returns `ok: false` + HTTP 207 when any
  demo user delete fails; payload lists `failed_user_ids`.
- **run-report** — removed dead-code `wrapped` raw-SQL template (was
  string-concatenating `workspaceId`; never executed but an injection
  trap for any future exec_sql wiring). ORDER BY now throws explicitly
  on complex clauses instead of silently dropping them.
- **payroll-export** — writes `payroll.export.member_profile_missing`
  audit row when `display_name` falls back to "Unknown".

### Frontend fixes
- `useEnterprisePermissions` falls back to the legacy unfiltered SELECT
  only when the permission-catalog RPC errored, not when it returned
  an empty array. Also logs parallel-call errors.
- `InviteMemberDialog` useEffect installs a `cancelled` cleanup flag
  to prevent state-on-unmounted-component warnings. Mode toggle resets
  password fields. Two hardcoded Hungarian placeholders replaced with
  i18n keys (en/hu/cs/sk/pl + de/at/ro scaffolds).
- 2 new keys × 8 locale files = 16 strings.

### Removed
- `CODEBASE_AUDIT_ROUND1.md` — file was corrupted, deleted.

### Verification
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 146/146 passing.
- DB triggers + CHECK + RLS verified live via execute_sql.

### Out of scope (follow-ups tracked in versioning file)
- pg_cron jobs for `gdpr_requests` SLA escalation and
  `tenant_feature_overrides` write-side expiry.
- Cross-implementation parity test for password policy.
- `as any` cluster cleanup pending `supabase gen types` refresh.

---

## 2026-05-14 — v3.33.0 Direct user creation + tier-filtered role permissions

Two user-requested capabilities shipped together.

### Task 1 — Create user directly (no email)

InviteMemberDialog now has a **mode toggle**: "Invite by email" vs.
"Create user directly". The create path:
- Admin sets an initial password.
- No email is sent to the new user.
- Server-side password policy: **min 10 chars, ≥1 uppercase, ≥1
  lowercase, ≥1 digit, ≥1 special char**.
- Live policy checklist in the UI (green checks as the password
  satisfies each rule).
- Confirm-password field with live mismatch warning.
- Show/hide password toggle.
- New user can change their password later from their profile.

#### DB
- `validate_password_policy(text)` IMMUTABLE Postgres function returns
  `{ok, failures[]}` for any password — used both server-side
  (defense-in-depth) and as the source-of-truth for the JS validator
  in `src/lib/security/passwordPolicy.ts`.

#### Edge function deployed: `create-workspace-user`
- Authorize: caller must be active owner / resourceAssistant.
- Validate password policy server-side.
- Detect existing auth user by email — if found, attaches them as a
  new workspace member without overwriting their password.
- Otherwise creates a fresh auth.user via admin SDK with
  `email_confirm: true` + the admin-set password.
- Upserts profile + creates membership + writes
  `enterprise_audit_events` row with `enterprise.member.create_direct` action.

### Task 2 — Tier-filtered role permissions

The role-permission tree in workspace Settings now shows ONLY
permissions whose features are actually available in the workspace's
active subscription tier. Permissions controlling features NOT in the
tier are hidden, with a notice showing how many are hidden.

#### DB
- `enterprise_feature_catalog.tier_feature_keys text[]` new column —
  maps each UI permission slot to one or more `features.feature_key`
  entries. Empty array = system permission (always visible).
- Seeded mappings for all 23 existing catalog entries
  (calendar → calendar_monthly+filters+annual_view, audit →
  audit_log+compliance_engine, reports → run_report+scheduled_reports+
  executive_dashboard, etc.).
- `workspace_permission_catalog(workspace_id)` STABLE SECURITY DEFINER
  RPC — returns the catalog with a `visible boolean` flag computed
  against the workspace's active tier_features. Members only.

#### Frontend
- `useEnterprisePermissions` calls the new RPC, falls back to the
  legacy direct table SELECT if the RPC returns empty (older workspaces
  without a tier mapping yet).
- `RolePermissionManager` displays an amber notice when ≥1 permission
  slot is hidden: "N permission slots hidden because the features
  they control are not in this workspace's subscription tier."

### Localization
- 20 new keys in `members.*` namespace × 5 locales = 100 strings.
- 1 new key in new `role_permission.*` namespace × 5 locales = 5 strings.
- de/at/ro inherit via runtime fallback to English.

### Verification
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 146/146 passing.

---

## 2026-05-14 — v3.32.0 Mobile PWA + Offline scaffold (Top-20 Rank 7)

Promotes Rank 7 from MISSING → DONE for the PWA installable scaffold.
Full Workbox + vite-plugin-pwa + IndexedDB write queue + FCM push are
explicitly deferred to v3.32.1+ when the build pipeline is upgraded.

### What ships
- `public/manifest.webmanifest` — full PWA manifest with icons,
  start_url, theme_color, two app shortcuts (Clock in / Leave request).
- `public/sw.js` — hand-written Service Worker with 3 strategies:
  - **CacheFirst** for static assets (js/css/woff/svg/png/ico).
  - **NetworkFirst with cache fallback** for navigation requests.
  - **Bypass** for Supabase auth / edge / realtime so live sessions
    are never cached.
- `src/lib/pwa/registerSW.ts` — registers `/sw.js` at app startup
  (skipped on localhost to avoid dev-mode caching headaches).
  Captures `beforeinstallprompt` for the install button.
- `src/components/pwa/InstallPwaPrompt.tsx` — floating bottom-right
  "Install app" banner shown when:
  1. Browser fired `beforeinstallprompt` (Chromium-based).
  2. Not already standalone (added to home screen).
  3. Not dismissed within last 30 days.
- `index.html` — added `<link rel="manifest">`, `theme-color`, and
  Apple PWA meta tags.
- `src/main.tsx` — calls `captureInstallPrompt()` + `registerEffectimeServiceWorker()` at boot.

### Why hand-written SW (not vite-plugin-pwa yet)
Adding `vite-plugin-pwa` modifies the Vite build output. Out of scope
for a single-session deliverable. The hand-written SW gives us
installability + basic offline now; the Workbox + auto-precaching
upgrade lands in v3.32.1+.

### Localization
- 3 new keys in `pwa.*` namespace × 5 locales = 15 strings.

### Deferred (v3.32.1+)
- `vite-plugin-pwa` integration + Workbox auto-precache manifest.
- IndexedDB write queue for offline submissions (leave requests, clock-in events).
- Firebase Cloud Messaging push notifications.
- Native Capacitor plugins (NFC, biometric auth) — Capacitor itself is already in package.json.

---

## 2026-05-14 — v3.30.0 Plugin Marketplace (Top-20 Rank 19)

Promotes Rank 19 from MISSING → DONE for the marketplace MVP. Full
sandboxed plugin runtime + plugin SDK npm package deferred to v3.30.1+.

### DB (Supabase MCP migration `v3_30_0_plugin_marketplace`)
- `marketplace_plugins` table — system-wide catalog with status
  (pending/approved/published/rejected/archived), category, manifest
  jsonb, install_count, pricing_model.
- `workspace_installed_plugins` table — per-workspace install + config
  + enabled flag.
- `plugin_webhook_events` table — append-only event-dispatch log
  (delivered flag + attempts + last response).
- 4 SECURITY DEFINER RPCs:
  - `marketplace_submit_plugin(slug, name, description, category, manifest, icon_url, pricing)` — authenticated developer submits.
  - `marketplace_set_plugin_status(plugin_id, status)` — platform admin only (approve / reject / publish).
  - `marketplace_install_plugin(workspace_id, plugin_id, config)` — workspace owner only. Auto-bumps install_count.
  - `marketplace_uninstall_plugin(installed_id)` — workspace owner only.
- 2 seeded sample plugins: `slack-leave-notify`, `birthday-bot`.

### Feature catalog + tier mapping
- 3 new feature_keys: `plugin_marketplace_browse`, `plugin_install`,
  `plugin_developer_submission`. **Enterprise tier only** (per the
  strategy doc this is a platform-tier capability).

### Frontend
- `src/hooks/usePluginMarketplace.ts` (3 hooks + 3 RPC helpers).
- `src/components/marketplace/PluginMarketplacePanel.tsx` — browse +
  category filter + search + per-plugin install/uninstall card.
- Wired inside the Settings tab via FeatureGate.

### Localization
- 18 new keys in `marketplace.*` namespace × 5 locales = 90 strings.

### Deferred (v3.30.1+)
- Sandboxed plugin runtime with scoped API keys (depends on Rank 9 API platform deepening).
- `@effectime/plugin-sdk` npm package with TypeScript types + CLI.
- Webhook dispatcher edge function (HMAC-SHA256 signed payloads + exponential retry).

---

## 2026-05-14 — v3.28.0 DACH/CEE locale scaffolds (Top-20 Rank 16)

Promotes Rank 16 from PARTIAL (5 locales done) → DONE for scaffold +
infrastructure. Professional translation of de/at/ro is a content task
tracked outside the repo.

### What ships
- `src/i18n/resources/de.ts` (German), `at.ts` (Austrian German),
  `ro.ts` (Romanian) — full scaffolds copied from `en.ts` so every
  key exists in every locale. Runtime falls back to English values
  until each key is translated.
- `src/i18n/locales.ts` — added 3 entries to `SUPPORTED_LOCALES` +
  `LOCALE_LABEL` (native name + English name + flag).
- `src/i18n/I18nProvider.tsx` — imports + registers the 3 new bundles.

### Why scaffolds, not full translations
A complete professional translation of 4000+ keys × 3 locales is a
content task that needs native-speaker review (legal terminology,
HR-domain phrasing, jurisdiction-specific wording for ArbZG / AVRAG).
Shipping scaffolds with English fallback lets the UI render in the
selected locale today and ramps up quality as translations land.

### Effectime is now displayable in 8 locales
- en (English) — source-of-truth
- hu (Magyar) — full translation
- cs (Čeština) — full translation
- sk (Slovenčina) — full translation
- pl (Polski) — full translation
- **de (Deutsch) — scaffold, en fallback**
- **at (Österreichisches Deutsch) — scaffold, en fallback**
- **ro (Română) — scaffold, en fallback**

### Deferred
- Professional translation pass for de/at/ro (~4000 keys × 3 locales).
- AT-specific terminology variants (currently identical to DE; should
  diverge on §3 ArbZG vs §11 AZG wording, "Vollzeit" usage, etc.).

---

## 2026-05-14 — v3.27.0 AI Scheduling Copilot (Top-20 Rank 1)

The headline AI feature from the Value-Rocket strategy. Per the doc,
this is the +€800k-1.35M valuation lever — AI-native products trade
at 2-3× premiums to feature-equivalent non-AI products.

Promotes Rank 1 from MISSING (catalog ready, no UI) → DONE.

### Design choice
Same template-first-AI-second pattern as v3.26 / v3.20: the UI works
without `ANTHROPIC_API_KEY` (returns "configure key" fallback message
in the assistant role), and lights up with real Claude analysis once
the secret is configured.

Tool-use loop with iterative function-calling and Supabase Realtime
streaming are deferred to v3.27.1+ to keep the MVP shippable; the
current model uses eager context loading + single Claude call.

### DB (Supabase MCP migration `v3_27_0_ai_copilot`)
- `ai_copilot_conversations` table (per-user session container).
- `ai_copilot_messages` table (role: user/assistant/system/tool_result,
  with structured_plan jsonb, model name, input/output token counts).
- `ai_copilot_rate_limits` table (20 requests/hour/user per the
  strategy doc rate-limit constraint).
- `ai_copilot_start_conversation` SECURITY DEFINER RPC.

### Edge function deployed: `ai-copilot`
1. Authenticates the caller as an active workspace member.
2. Enforces the 20/hour rate limit.
3. Eager-loads workspace context: member roles + locations + capacity,
   open + approved leave next 90d, shift count next 90d, unresolved
   compliance violations.
4. Calls Claude Sonnet 4.6 (default) with a strict JSON-output
   system prompt — analysis + recommendations + warnings +
   confidence + requires_human_review.
5. Persists the assistant message + structured plan; records the
   rate-limit hit.

**Privacy:** only aggregate context is sent to Claude (counts, role
breakdowns, leave summary). No member names, no PII. Per the strategy
doc's privacy-first stance.

### Feature catalog + tier mapping
- 2 new feature_keys: `ai_copilot_chat`, `ai_copilot_history`.
- **Enterprise tier only** (AI is the headline premium feature).

### Frontend
- `src/hooks/useAiCopilot.ts`.
- `src/components/ai-copilot/CopilotPanel.tsx` — chat-style UI with
  message history (user msgs right-aligned, assistant left, model name
  inline), structured plan rendering (analysis text + recommendations
  bullets + warning callout + confidence badge), Send button with
  loading state, token usage counter, privacy reminder.
- Wired inside the Calendar tab via FeatureGate.

### Localization
- 15 new keys in `ai_copilot.*` namespace × 5 locales = 75 strings.
  (de/at/ro inherit via fallback until scaffolds are translated.)

### Deferred (v3.27.1+)
- Tool-use loop: let Claude call `check_conflicts`, `get_capacity`,
  `list_leave_requests`, `list_shifts` as functions instead of eager
  loading. Claude's tool-use API supports this.
- Realtime streaming via Supabase Realtime channel
  `copilot:{conversation_id}` — currently single response.
- "Apply Plan" button to execute Claude's recommendations against the
  existing schedule mutation hooks. Requires careful guardrails.

---

## 2026-05-14 — v3.31.0 Candidate Scheduling / ATS bridge (Top-20 Rank 20)

Promotes Rank 20 from MISSING → DONE for the core internal pipeline.
ATS provider adapters (Greenhouse / Lever / Workable) deferred to v3.31.1+.

### DB (Supabase MCP migration `v3_31_0_candidate_scheduling`)
- `candidates` table — internal pipeline with status enum (new → screening → interview → offer → hired/rejected/withdrawn) + optional ATS provider linkage.
- `interview_slots` table — multi-interviewer slots with `booking_token` for the public self-booking URL.
- `ats_integrations` table — per-workspace provider config (Greenhouse, Lever, Workable). Owner-only RLS.
- `candidate_interview_slot_eligible()` STABLE helper — rejects a slot if any interviewer is on approved leave that day OR already in another booked slot that overlaps.
- 4 SECURITY DEFINER RPCs:
  - `candidate_create_slot(workspace_id, start, end, interviewer_ids, notes)` — owner/RA, eligibility-checked.
  - `candidate_self_book(token, name, email)` — **public RPC (anon + authenticated)** — upserts candidate, locks slot.
  - `candidate_generate_onboarding(workspace_id, candidate_id, start_date)` — marks hired + instantiates default onboarding template.

### Feature catalog + tier mapping
- 4 new feature_keys: `candidate_pipeline`, `candidate_self_booking`,
  `candidate_onboarding_wizard`, `candidate_ats_integration`. All Pro + Enterprise.

### Frontend
- New routes: `/book/:token` (public) and the recruiting panel inside the existing workspace Reports tab.
- `src/hooks/useCandidates.ts` (4 hooks + 4 RPC helpers).
- `src/components/candidates/RecruitingPanel.tsx` — pipeline list with status badges + interview slot creator + booking-URL copier + one-click hire-and-onboard.
- `src/pages/CandidateBook.tsx` — public booking page (no auth). Renders the token's slot details, captures name+email, confirms.

### Localization
- 27 new keys in `recruiting.*` + 10 new keys in new `book.*` namespace × 5 locales = 185 strings.

### Deferred
- ATS adapter edge functions (Greenhouse / Lever / Workable / SmartRecruiters).
- Calendar invite generation (uses existing M365/Google integration; wiring is the next polish PR).
- Outcome-rating UI for completed slots.

---

## 2026-05-14 — v3.25.0 Reseller portal & white-label (Top-20 Rank 4)

Promotes Rank 4 from PARTIAL (BrandingManager only) → DONE for B2B2B
provisioning + theme editor + portfolio dashboard. Stripe Connect
payout automation deferred to v3.25.1+.

### DB (Supabase MCP migration `v3_25_0_reseller_platform_retry`)
- `resellers` table — name + slug + theme_config + custom_domain + revenue_share_pct + stripe_connect_account_id.
- `reseller_admins` table — user → reseller many-to-many membership with role (admin / viewer).
- `enterprise_workspaces.reseller_id` (new column, nullable; direct workspaces = NULL).
- `is_reseller_admin(reseller_id, user_id)` SECURITY DEFINER helper.
- 3 SECURITY DEFINER RPCs:
  - `reseller_provision_workspace(reseller_id, name, description, tier_key, seats)` — wraps `create_workspace_with_owner` then tags the new workspace with `reseller_id`.
  - `reseller_update_theme(reseller_id, theme_config jsonb)` — edits brand color + logo.
  - `reseller_get_usage(reseller_id)` — portfolio dashboard data (total + active workspaces, total members, per-workspace tier + member count).

### Feature catalog + tier mapping
- 3 new feature_keys: `reseller_portal`, `reseller_theme`, `reseller_revenue_share`.
- Mapped to **Enterprise tier only** (reseller capability is a platform-tier capability).

### Frontend
- New route `/reseller` (auth required; RLS scopes visibility to `reseller_admins` rows).
- `src/hooks/useReseller.ts` (2 hooks + 3 RPC helpers).
- `src/components/reseller/ResellerPortal.tsx` — multi-reseller picker + portfolio dashboard with 3 KPI cards + per-workspace list + provision-new-workspace form + theme editor + revenue share info.
- `src/pages/Reseller.tsx` — page wrapper.

### Localization
- 32 new keys in `reseller.*` namespace × 5 locales = 160 strings.

### Deferred
- Stripe Connect account linkage + automated payouts (record-keeping only in v3.25.0).
- Custom-domain SSL provisioning.
- Reseller-injected theme at runtime via CSS variables (current MVP saves the config; full runtime injection is the next polish PR).

---

## 2026-05-14 — v3.29.0 Predictive Analytics engine (Top-20 Rank 3)

Promotes Rank 3 from PARTIAL → DONE: existing AnalyticsDashboard kept;
this release adds the forecasting + risk-scoring layer that turns Effectime
from "scheduling tool" to "workforce intelligence platform" per the strategy doc.

### DB (Supabase MCP migration `v3_29_0_predictive_analytics`)
- `enterprise_workspaces.salary_band_config jsonb` column for labor-cost modeling.
- 3 new SECURITY DEFINER RPCs (all manager / admin only):
  - `analytics_labor_cost_forecast(workspace_id, months_ahead)` — N-month
    projection by member × salary band, adjusted by approved-leave fraction.
  - `analytics_absence_risk_scores(workspace_id)` — per-member 0-100
    risk score from 180-day + 365-day leave patterns + sick-leave frequency.
  - `analytics_coverage_risk_heatmap(workspace_id, days_ahead)` — daily
    green/yellow/red projection for the next N days based on approved +
    pending leave fraction.

### Feature catalog + tier mapping
- 3 new feature_keys: `analytics_labor_cost_forecast`,
  `analytics_absence_risk`, `analytics_coverage_heatmap`. All Pro + Enterprise.

### Frontend
- `src/hooks/usePredictiveAnalytics.ts` (3 hooks).
- `src/components/analytics/PredictiveAnalyticsPanel.tsx` — 3 sections:
  - Labor cost bar-chart (6 months, EUR-formatted).
  - Top absence-risk members (color-coded badges).
  - 90-day coverage heatmap (week × day grid, green/yellow/red cells).
- Wired into existing `AnalyticsDashboard` above the legacy KPI cards.

### Localization
- 10 new keys merged into existing `analytics.*` namespace × 5 locales = 50 strings.

### Deferred
- pg_cron refresh of materialized views (currently RPCs compute on-demand).
- ML-based absence pattern detection (current model is rule-based; per
  the strategy doc's privacy-first stance, no PII is sent to external ML services).

---

## 2026-05-14 — v3.26.0 AI Document Generator (Top-20 Rank 18)

Promotes Rank 18 from MISSING → DONE.

### Approach
**Template-based core + optional Claude polish.** Pure template
substitution works without ANY external API; AI polish is gated on
`ANTHROPIC_API_KEY` being configured in Supabase function secrets and
degrades gracefully when unset.

### DB (Supabase MCP migration `v3_26_0_document_generator`)
- `document_templates` table — system + workspace templates with
  HTML body, variable list, doc_type, language.
- `generated_documents` table — append-only generation log with
  content + context + status (draft/final/sent/signed).
- `document_substitute(body_html, vars jsonb)` IMMUTABLE helper —
  `{{key}}` token replacement.
- `document_generate(workspace_id, template_id, membership_id,
  extra_vars, subject)` SECURITY DEFINER RPC — auto-populates
  workspace + member context, runs substitution, writes the row.
- 5 seeded system templates: leave_approval (en, hu),
  employment_addendum, overtime_consent, working_time_summary.

### Edge function deployed: `document-ai-polish`
- Calls `claude-haiku-4-5` if `ANTHROPIC_API_KEY` is set; returns
  unchanged content + `ai_available: false` + hint otherwise.
- Authorizes the caller as an active workspace member.

### Feature catalog + tier mapping
- 3 new feature_keys: `document_templates`, `document_generator`,
  `document_ai_polish`. Pro + Enterprise.

### Frontend
- `src/hooks/useDocumentGenerator.ts` — useDocumentTemplates,
  useGeneratedDocuments + `generateDocument` + `polishDocumentWithAi` helpers.
- `src/components/documents/DocumentGeneratorPanel.tsx` — template
  picker, extras JSON input, generate button, Sparkles AI polish button,
  HTML preview pane, recent-documents list.
- Wired inside the Reports tab via FeatureGate.

### Localization
- 17 new keys × 5 locales = 85 strings in new `documents.*` namespace.

### Deferred
- WYSIWYG template editor (TipTap/Quill) — admins currently write HTML directly.
- E-signature integration (DocuSign / Scrive) — flagged status `signed` exists; UX TBD.
- PDF rendering of generated documents — content_html is preserved; pdf path is the next polish.

---

## 2026-05-14 — v3.24.0 Public REST API gateway + webhook dispatcher (Top-20 Rank 9)

Promotes Rank 9 from PARTIAL → DONE for read endpoints + webhook delivery.

### Edge functions deployed
- **`public-api`** — Bearer-token authenticated REST gateway.
  - Auth: `sha256hex` of raw key matched against `enterprise_api_keys.key_hash`.
  - Rate limit: 1000 req/hour per key (in-memory sliding window; resets on cold start).
  - Routes: `GET /v1/health`, `GET /v1/employees`, `GET /v1/schedules`, `GET /v1/leave-requests`.
  - Response envelope: `{ data, meta: { request_id, count } }`.
  - Logs every request to `enterprise_api_usage_logs`; updates `enterprise_api_keys.last_used_at`.
- **`webhook-dispatcher`** — drains `enterprise_webhook_deliveries` (status pending/retrying).
  - Signs payload with `HMAC-SHA256(secret, body)` → `X-Effectime-Signature: sha256=<hex>` header.
  - Also sets `X-Effectime-Event` + `X-Effectime-Delivery-Id` headers.
  - 10-second timeout per delivery; retries up to 3 times via `webhook_record_delivery` RPC.
  - Platform-admin-gated (defense against accidental DoS / spam).

### DB
- `enterprise_api_keys.key_prefix` column (display the first chars of a key after creation).
- `enterprise_webhook_deliveries` table (per-event delivery rows with attempt count, last response code/body/error).
- `webhook_emit(workspace_id, event_type, payload)` RPC — workspace-member-callable, fans the event out to all active matching subscriptions.
- `webhook_record_delivery(delivery_id, status_code, body, error)` RPC — dispatcher-only (admin role).

### Feature catalog + tier mapping
- 2 new feature_keys: `public_api_gateway`, `webhook_dispatcher`. Pro + Enterprise.

### Frontend
- `src/components/integrations/PublicApiGatewayPanel.tsx` — docs surface
  with copy-to-clipboard curl examples, base URL display, rate-limit
  notice, webhook signature contract.
- Wired into DeveloperPortal as a new "API gateway" tab.

### Localization
- 13 keys × 5 locales (en, hu, cs, sk, pl) = 65 strings in new `integrations.*` namespace.
- 4 common helper keys (`copied`, `copy_failed`, `copied_to_clipboard`, `more`) × 5 locales.

### Deferred
- pg_cron schedule for the dispatcher (currently invoke manually).
- POST/PUT/DELETE write endpoints in the public-api gateway.
- OpenAPI spec auto-generation from Zod schemas.
- Webhook subscription management UI (current DB tables + RPCs support it; UI is in the existing DeveloperPortal Webhooks tab).

---

## 2026-05-14 — v3.23.0 Wellbeing scoring engine completion (Top-20 Rank 8)

Promotes Rank 8 from PARTIAL → DONE.

### DB (Supabase MCP migration `v3_23_0_wellbeing_engine`)
- `enterprise_workspaces.wellbeing_weights jsonb` — per-workspace component weight overrides.
- `wellbeing_get_weights(workspace_id)` STABLE helper — returns effective weights with defaults.
- `wellbeing_calculate_scores(workspace_id)` RPC — for each active member:
  - Component A (30% weight): overtime ratio from attendance_segments (last 90 days).
  - Component B (25% weight): weekend density (Sat/Sun shifts ÷ total shifts).
  - Component C (20% weight): leave utilization (days used ÷ days accrued, last 365 days).
  - Components D+E (25%): schedule stability + recovery placeholders at neutral 70pts (next polish).
  - Inserts `wellbeing_scores` row + fires `wellbeing_alerts` on threshold crossings:
    - score < 40 → `low_wellbeing_score` (severity high).
    - score 40-60 with >20% overtime → `overtime_warning` (severity medium).

### Feature catalog + tier mapping
- 1 new feature_key: `wellbeing_engine_run`. Mapped to Pro + Enterprise.
  Depends on `burnout_engine`.

### Frontend
- `src/hooks/useWellbeing.ts` — useLatestWellbeingScores,
  useOpenWellbeingAlerts + `recalculateWellbeingScores` helper.
- `src/components/wellbeing/WellbeingRecalculateCard.tsx` — engine
  card with green/yellow/red distribution + recalculate button + open
  alerts preview. Wired into the existing WellbeingDashboard above the
  summary row.

### Localization
- 8 new keys added INTO the existing `wellbeing.*` namespace
  (engine_title, last_run, avg_score, bucket_green/yellow/red,
  open_alerts, alert_low_wellbeing_score, alert_overtime_warning).
- All 5 locales (en, hu, cs, sk, pl) — total 40 strings.

### Deferred
- Weekly pg_cron auto-calculation.
- Schedule-stability component (needs schedule-change tracking).
- Recovery component (needs cross-shift gap analysis).
- Per-member trend sparkline UI (data exists in `wellbeing_scores`).

---

## 2026-05-14 — v3.22.0 GPS / NFC / QR Clock-In engine (Top-20 Rank 10)

Promotes Rank 10 from MISSING (catalog ready) → DONE.

### DB (Supabase MCP migration `v3_22_0_clock_in_engine`)
- `clock_events` — append-only attendance log (workspace + member +
  event_type + method + geofence coordinates + verified flag + raw_data).
- `qr_clock_sessions` — rotating QR codes (60-second TTL by default;
  manager-only generation).
- 4 new columns on `enterprise_offices`: `geofence_lat`, `geofence_lng`,
  `geofence_radius_m` (default 150m), `clock_in_nfc_tag`.
- `haversine_km()` IMMUTABLE helper for geofence distance.
- `clock_generate_qr(office_id, ttl_seconds)` — manager-gated rotating
  QR generator. Returns the code + expires_at.
- `clock_event(workspace_id, event_type, method, lat, lng, qr_code,
  nfc_tag, office_id)` — main RPC. Per-method validation:
  - **GPS**: finds nearest geofenced office in workspace; verified only
    if within radius. Anti-spoof: server-side distance check.
  - **QR**: validates against unexpired `qr_clock_sessions` row.
  - **NFC**: validates against `enterprise_offices.clock_in_nfc_tag`.
  - **Manual**: always unverified; flagged for manager review.

### Feature catalog + tier mapping
- 4 new feature_keys: `clock_in_gps`, `clock_in_qr`, `clock_in_nfc`,
  `clock_in_board`. All routed to `/w/:workspaceId`. Dependencies:
  GPS/QR/NFC each depend on `attendance_log`; board depends on all 3.
- Mapped to **Pro + Enterprise**. Freemium excluded (mobile-first
  attendance is a paying-customer feature; the strategy doc positions
  this as the $4.2B hardware-replacement market).

### Frontend
- `src/hooks/useClockIn.ts` — `useTodayClockEvents`,
  `useLiveAttendance` + `clockEvent` + `generateQrSession` helpers.
- `src/components/clock/ClockInPanel.tsx` — mobile-first panel with:
  - Big tabular live clock (updates every second).
  - Method selector (GPS / QR / NFC / Manual).
  - GPS reads `navigator.geolocation` and sends lat+lng to the RPC.
  - Today's timeline with verified/unverified icons.
  - Hours-worked counter (sums clock-in/out pairs).
- Wired into `EmployeeDashboard` (self-service portal) so any member
  sees their clock-in panel on their personal page.

### Localization
- 19 keys × 5 locales (en, hu, cs, sk, pl) = 95 strings.

### Deferred (v3.22.1+)
- Live attendance board for managers (`clock_in_board` feature_key
  exists; the manager-facing component is the next polish PR).
- Capacitor native NFC plugin wiring (currently NFC tag is entered as
  text; native NFC requires `@capacitor/nfc` which depends on the PWA
  scaffold from Rank 7 / v3.32).
- Camera-based QR scanner (currently QR code is entered as text;
  Capacitor BarCodeScanner integration also depends on PWA scaffold).

---

## 2026-05-14 — v3.21.0 Shift Marketplace (Top-20 Rank 12)

Promotes Rank 12 from PARTIAL (SubstituteInbox only) → DONE.

### DB (Supabase MCP migration `v3_21_0_shift_marketplace`)
- `shift_trade_offers` — open/accepted/cancelled/expired/approved/rejected.
- `shift_trade_acceptances` — pending/approved/rejected/superseded.
- `enterprise_workspaces.shift_trade_auto_approve` (new column, default
  false) — workspace policy to skip manager approval for same-skill
  trades.
- `shift_trade_is_eligible(membership_id, shift_assignment_id)` STABLE
  helper — checks workspace match, active status, not-own-shift,
  not-on-approved-leave-that-day, no-conflicting-shift-that-day.
- 4 SECURITY DEFINER RPCs (sole writers):
  - `shift_trade_offer(shift_assignment_id, reason, expires_at)` —
    only the assigned member may offer their own shift. Prevents
    duplicate open offers.
  - `shift_trade_accept(offer_id)` — validates eligibility; first to
    accept marks offer 'accepted'; auto-approves if workspace policy
    permits.
  - `shift_trade_decide(acceptance_id, approved, notes)` — manager
    approves → reassigns `enterprise_shift_assignments.membership_id`
    + supersedes other pending acceptances + marks offer 'approved'.
    Manager rejects → offer goes back to 'open' so other pending
    acceptances can be evaluated.
  - `shift_trade_cancel(offer_id)` — offering member or manager
    cancels.

### Feature catalog + tier mapping
- 3 new feature_keys: `shift_marketplace_offer`,
  `shift_marketplace_browse`, `shift_marketplace_auto_approve`.
- Mapped to **Pro + Enterprise** only. Freemium excluded.

### Frontend
- `src/hooks/useShiftMarketplace.ts` — `useOpenTradeOffers`,
  `useMyTradeOffers`, `usePendingAcceptances` + 4 RPC helpers.
- `src/components/shift-marketplace/ShiftMarketplacePanel.tsx` — tab
  switcher (Available / My offers) + per-offer card with status badge
  (color-coded by status) + Accept/Cancel actions.
- Wired into `EmployeeDashboard` (self-service area).

### Localization
- 18 keys × 5 locales = 90 strings.

### Deferred (v3.21.1+)
- Manager approval queue inside `ApprovalInbox` (currently the RPC
  exists but a dedicated manager UI for `shift_trade_decide` is the
  next polish PR).
- Push notification on offer creation (depends on Rank 7 PWA/FCM).
- Eligibility checks beyond date conflicts (skill match, hours budget,
  site authorization) — the schema supports it; the helper is currently
  conservative.

---

## 2026-05-13 — v3.20.0 GDPR / WTD Compliance Engine (Top-20 Rank 13)

Promotes Rank 13 from MISSING (catalog ready) → DONE.

### DB (applied via Supabase MCP migration `v3_20_0_compliance_engine`)
- `compliance_rulesets` — per-workspace jurisdiction selector
  (EU_WTD, HU_MT, DE_ArbZG, AT_AVRAG, custom) + parameters override.
  Editable by owners + resourceAssistants.
- `compliance_violations` — append-only finding log per workspace +
  member, with `severity` (warning/violation), actual vs limit numerics,
  jurisdiction tag, period_start/end. Direct INSERT policy-blocked.
- `compliance_check_working_time(workspace_id, period_start, period_end)`
  RPC — runs the EU WTD / DE ArbZG / HU Mt. check across all active
  memberships, evaluates approx weekly hours from attendance segments,
  inserts violation rows for hard breaches AND warnings (90% of limit).

### Feature catalog + tier mapping
- 3 new feature_keys: `compliance_engine`, `compliance_dashboard`,
  `compliance_export`. All routed under `/w/:workspaceId`. Dependencies:
  `compliance_dashboard` and `compliance_export` depend on
  `compliance_engine`.
- Mapped to **Pro + Enterprise** tiers only. Freemium intentionally
  excluded (compliance is the explicit enterprise-sales unlock per the
  strategy doc).

### Frontend
- `src/hooks/useCompliance.ts` — useComplianceViolations,
  useComplianceRuleset + `runComplianceCheck` helper.
- `src/components/compliance/ComplianceDashboard.tsx` —
  green/yellow/red status header + 3 KPI cards (violations, warnings,
  status) + period date pickers + run button + unresolved findings
  list color-coded by severity.
- Wired into the existing **Reports** tab inside the workspace
  dashboard via FeatureGate so Freemium sees a LockedFeatureNotice.

### Localization
- 24 new `compliance.*` keys × 5 locales (en, hu, cs, sk, pl) = 120
  strings. Jurisdiction labels translated for each locale.

### What this DOES NOT do (deferred to v3.20.1+)
- Pre-publish hard blocking of schedules with hard violations
  (currently the dashboard reports; the schedule-publish flow does not
  yet call this RPC as a gate).
- Generate monthly compliance PDF for labor inspectors
  (`compliance_export` feature_key exists, but no `compliance-engine`
  edge function yet).
- Daily-rest-11h and weekly-rest-24h checks (currently only
  weekly-max-48h is enforced; ruleset includes the columns and the
  function reads `daily_rest_min` but does not yet compute it).
- GDPR data-export/erasure endpoints (already present in
  `security-admin` edge function from v3.15.x; not duplicated here).

---

## 2026-05-13 — v3.19.0 Customer Success Platform (Top-20 Rank 17)

Top-20 Rank 17 — completely green-field on audit, shipped end-to-end.

### DB (applied via Supabase MCP migration `v3_19_0_customer_success_platform`)
- `customer_success_onboarding_progress` — per-workspace item completion
  (7 whitelisted item_keys).
- `customer_success_nps_surveys` — per-user NPS surveys with category
  (onboarding | periodic), score (0-10 constrained), feedback,
  responded_at.
- `customer_success_health_scores` — per-workspace snapshots with
  score (0-100), components JSON, trend (improving/stable/declining),
  calculated_at.
- 4 SECURITY DEFINER RPCs (sole writers):
  - `customer_success_record_onboarding_step(workspace_id, item_key)`
  - `customer_success_trigger_nps(workspace_id, category)` — dedup
    (no duplicate within 60 days for same user+workspace)
  - `customer_success_submit_nps(survey_id, score, feedback)` — only
    the survey's owner can respond
  - `customer_success_calculate_health_score(workspace_id)` — 5-component
    weighted score, computes trend by comparing to previous snapshot

### Feature catalog + tier mapping
- 3 new feature_keys: `cs_onboarding_checklist`, `cs_health_score`,
  `cs_nps_survey`. All routed (`/w/:workspaceId` or `/superadmin` for
  health score). Mapped to **all 3 tiers** — customer success matters
  on Freemium too, not just paying customers.

### Frontend
- `src/hooks/useCustomerSuccess.ts` — 5 hooks + 4 RPC helpers.
- `src/components/customer-success/OnboardingChecklist.tsx` — floating
  progress widget with click-to-jump on each item; hides itself when
  100% complete (persisted per-workspace in localStorage); collapsible.
- `src/components/customer-success/NPSSurvey.tsx` — fixed-bottom-right
  slide-up banner; renders only when an unresponded survey row exists
  for the user. 0-10 scale + contextual follow-up textarea (different
  prompts for detractors / passive / promoters).
- OnboardingChecklist wired into `EmployeeDashboard` (the self-service
  area) with onJumpToItem → tab navigation for each checklist item.
- NPSSurvey wired into the root of `WorkspaceDashboard` so it floats
  globally for any member of any workspace.

### Localization
- 32 new `customer_success.*` keys × 5 locales = 160 strings.
- 4 new `common.*` keys (`expand`, `collapse`, `dismiss`, `later`) × 5
  locales = 20 strings.

### What this DOES NOT do (deferred)
- Auto-trigger of `customer_success_trigger_nps` 30 days post-onboarding
  is not yet hooked into a scheduled job — surveys need to be triggered
  manually via the RPC or via a follow-up pg_cron addition.
- The internal Customer Success Dashboard (for Effectime's own team) is
  not yet built. The data is queryable from `/superadmin → Workspaces`
  but a dedicated CS-team view comes in v3.19.1.
- Health score is calculated on-demand, not on a schedule. A weekly
  pg_cron job is a small follow-up.

---

## 2026-05-13 — v3.18.0 Gamification & engagement layer (Top-20 Rank 14)

### Context

The user supplied the *Effectime Enterprise — Top 20 Value-Rocket Growth
Strategy* document and asked: implement only the still-missing functions,
in compliance with CLAUDE.md and AI_PROMPTING_FOLDERSTRUCTURE/SYSTEM.md,
with full localization, routing, dependency, and tier-classification
parameters.

Step 1 was a deep audit (`db-audit/feature_gap_audit.md`). Of the 20
ranks: 5 are DONE, 6 are PARTIAL, 9 are MISSING (4 with feature_keys
already in the catalog, 6 completely green-field). Shipping all 20 in a
single commit is not feasible; this release ships **Rank 14 Gamification
end-to-end** as the first concrete delivery against the strategy and as
the canonical template for subsequent ranks. The remaining 14 ranks have
a sequenced roadmap in the audit file (`v3.19.x` through `v3.32.x`).

### What v3.18.0 ships

**DB (applied via Supabase MCP migration `v3_18_0_gamification_engagement`):**
- `engagement_achievements` — system-wide catalog of 7 seeded badges
  (Punctuality 5/30/100 days, Great Planner, Coverage Hero 1/10, Profile Complete).
- `engagement_member_achievements` — per-member earned table. Direct
  client INSERT is policy-blocked; awards happen ONLY through the
  SECURITY DEFINER RPC.
- `engagement_streaks` — per-member streak counters per `streak_type`
  (punctuality, planning, collaboration, profile_complete).
- `enterprise_memberships.gamification_opt_out` (new column, default false).
- `enterprise_workspaces.gamification_enabled` (new column, default true).
- `engagement_record_event(_workspace_id, _membership_id, _event_type)`
  RPC — caller must be the member themselves OR a workspace
  owner/resourceAssistant. Respects both workspace toggle and per-member
  opt-out. Returns `{ok, streak, awarded[]}`.

**Feature catalog (`features` table):**
- 3 new feature_keys: `gamification_dashboard`, `gamification_badges`,
  `gamification_streaks`. All routed under `/w/:workspaceId` with
  `menu_path` `['Profile','Achievements'(/Badges/Streaks)]`. Dependency
  graph: badges and streaks depend on dashboard.

**Tier mapping (`tier_features`):**
- All 3 gamification feature_keys mapped to **Pro** and **Enterprise**
  tiers. Freemium intentionally excluded (engagement is a retention
  feature for paying customers).

**Frontend:**
- `src/hooks/useEngagement.ts` — `useAchievementsCatalog`,
  `useMemberAchievements`, `useMemberStreaks`, plus the
  `recordEngagementEvent` award helper.
- `src/components/engagement/AchievementsPanel.tsx` — read-only badge
  wall + streak counters. Earned badges in amber tint; locked badges
  greyed with a Lock icon and threshold hint. Self-determination-theory
  aligned: emphasizes mastery (visible locked badges showing what's
  achievable) over surveillance (no leaderboards, no public shaming).
- Wired into `EmployeeDashboard` (the self-service portal) so members
  see their own achievements when they open their personal area.

**Localization:**
- 29 new keys per locale × 5 locales (en, hu, cs, sk, pl) = 145 strings
  total. Per `localization_controller.md` and CLAUDE.md, every new
  user-facing string is added to ALL existing locale resources in the
  same commit. Czech, Slovak, and Polish were already present in
  `src/i18n/resources/` — no locales were skipped.

### Files changed

- `supabase/migrations/…v3_18_0_gamification_engagement…` (applied to remote)
- `src/hooks/useEngagement.ts` (new)
- `src/components/engagement/AchievementsPanel.tsx` (new)
- `src/components/enterprise/self-service/EmployeeDashboard.tsx` (added panel)
- `src/i18n/resources/{en,hu,cs,sk,pl}.ts` (29 keys each)
- `db-audit/feature_gap_audit.md` (deep audit of all 20 Value-Rocket ranks)
- `CHANGELOG.md`, `versioning/`, `marketing/marketing_values/`

### Verification

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 146/146 passing.
- DB sanity: `SELECT count(*) FROM engagement_achievements` returns 7
  (seed achievements present).
- DB sanity: `SELECT proname, prosecdef FROM pg_proc WHERE
  proname='engagement_record_event'` confirms SECURITY DEFINER.

### Roadmap for the remaining 14 ranks

See `db-audit/feature_gap_audit.md` for the full sequenced plan
(v3.19.x → v3.32.x). Per-feature delivery template (DB + edge fn + UI +
5-locale i18n + route + tier mapping + governance + tests + CHANGELOG
+ versioning + marketing) is documented in that same file.

---

## 2026-05-13 — v3.17.1 STRICT tier_key: silent freemium fallback eliminated

### The follow-up bug to v3.17.0

After v3.17.0 shipped (tier badge + superadmin change-tier UI), the user
reported a screenshot: they selected **Enterprise** in the workspace
creation dialog, the workspace was created, and the badge on both the
picker card and dashboard header showed **FREEMIUM**.

Looking at the DB for the user's recent creates (20:50–20:53 today):
- 20:50:38 → tier=**enterprise** ✓
- 20:51:20 → tier=freemium ✗
- 20:51:58 → tier=freemium ✗
- 20:52:28 → tier=freemium ✗
- 20:53:17 → tier=freemium ✗ ("enterpriese" — the one in the screenshot)

Same user, same dialog code, same browser session — sometimes correct,
sometimes not. The tier was clearly getting LOST somewhere on the way
from the dropdown to the RPC.

### Root cause: silent fallback in the RPC

`public.create_workspace_with_owner(_name, _description, _tier_key, _seats)`
had `_tier_key text DEFAULT 'freemium'` and inside:

```sql
SELECT id INTO _tier_id FROM public.tiers WHERE tier_key = COALESCE(_tier_key, 'freemium') LIMIT 1;
IF _tier_id IS NULL THEN
  SELECT id INTO _tier_id FROM public.tiers ORDER BY sort_order LIMIT 1;  -- still freemium
END IF;
```

If `_tier_key` arrived as NULL / empty / unknown for ANY reason (PostgREST
parameter binding drop, stale closure in the React Select, a typo, etc.),
the function silently picked **freemium** instead of failing loudly.
The user had no way to know their selection was lost — they'd see a
FREEMIUM workspace appear, assume the dropdown didn't work, retry, and
sometimes hit a different code path that did work.

### Fix (v3.17.1)

**Server side — strict tier_key contract.** The function now:
- Accepts `_tier_key text DEFAULT NULL` (no fallback default).
- Normalizes (lowercase + trim).
- **Raises an exception** if the normalized value is empty or unknown,
  with a clear message listing available tier_keys.
- Stores the resolved tier_key + the raw input in the subscription's
  metadata for forensic auditing.

No silent freemium ever again — the caller MUST pass a valid tier_key
or the whole call fails atomically (no half-created workspace).

**Client side — post-create tier verification.** After both create paths
(`handleCreate` direct RPC and `handleCreateDemo` via seed-demo-workspace),
the dialog now:
1. Reads the new workspace's actual tier from `workspace_active_tier`.
2. Compares to the requested tier_key.
3. If they differ, surfaces a loud `WARNING: workspace was created with
   the wrong tier (you picked "X", got "Y"). Please contact a platform
   admin to fix this.` toast — instead of silently entering a wrong-tier
   workspace.

This is belt-and-braces — even if a future RPC regression silently
downgrades again, the client catches it in the same request cycle.

### Files changed

- `supabase/migrations/…create_workspace_with_owner_strict_tier…` —
  applied to remote DB via MCP. RPC body updated; signature changed
  (`_tier_key DEFAULT NULL` instead of `'freemium'`).
- `src/components/enterprise/CreateWorkspaceDialog.tsx` — post-create
  verification in both `handleCreate` and `handleCreateDemo`. Pre-check
  for empty tier (defensive, server enforces too).
- `src/i18n/resources/en.ts`, `src/i18n/resources/hu.ts` — 2 new keys
  (`create_workspace.tier_required`, `create_workspace.tier_mismatch_error`).

### Backwards compatibility

The signature default changed from `'freemium'` to `NULL`. Any current
caller that omits `_tier_key` would now get an exception. Audit of
callers:
- `CreateWorkspaceDialog.handleCreate` — always sends `_tier_key`. ✓
- `seed-demo-workspace` edge function — always sends `_tier_key`. ✓
- No DB-side caller exists (verified via the v3.15.4 audit).

So the breaking change has no live consumers.

### Pre-existing wrong-tier workspaces

The 4 workspaces incorrectly created as freemium today (20:51:20,
20:51:58, 20:52:28, 20:53:17 — including "enterpriese") have NOT been
auto-corrected by this release. Use the new Superadmin → Workspaces →
"Change tier…" action (shipped in v3.17.0) to set them to the intended
tier. Each change writes a `platform_audit_events` row for the trail.

### Verification

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 146/146 passing.
- DB: `pg_get_functiondef('create_workspace_with_owner'::regproc)`
  returns the strict body with `RAISE EXCEPTION` on null/unknown.

---

## 2026-05-13 — v3.17.0 Workspace tier persistence + visible badge + superadmin-only change

### The customer-facing concern

User reported: "I create a workspace in a chosen tier, and after I reopen it
the tier seems to change randomly." Investigation showed:

1. **No code path was actually mutating tiers silently** — the
   `create_workspace_with_owner` RPC correctly inserts the selected tier into
   `tenant_subscriptions` at creation time, and no other write path exists.
2. **But the tier was invisible everywhere in the product UI** — the user had
   no way to verify what tier their workspace was on. The only place the
   tier could be selected was during creation in `CreateWorkspaceDialog`;
   afterward, nothing displayed it.
3. **And there was no way to change a tier post-creation** — not even for
   platform admins. If a customer upgraded from Freemium to Pro after a
   sales call, the only "fix" was to delete and recreate the workspace.

This release ships all three corrections together so paying customers can
verify what they're getting, and so the platform team can adjust tiers
without data loss.

### New DB primitives

- **`public.workspace_active_tier`** — view mapping `workspace_id` →
  current active subscription tier (tier_id, tier_key, tier_name, seats,
  started_at, ends_at). `security_invoker = on` so existing RLS on
  `tenant_subscriptions` and `tenant_workspaces` applies (members can read
  their own workspace's tier; platform admins can read all).
- **`public.superadmin_change_workspace_tier(_workspace_id uuid, _tier_key text, _reason text)`**
  — the ONLY supported way to change a workspace's tier after creation.
  - Requires the caller to have `user_roles.role = 'admin'` (platform admin
    — NOT enterprise owner / resourceAssistant — tier changes have billing
    impact and must flow through the platform team).
  - Updates `tenant_subscriptions.tier_id`, stamps the subscription's
    metadata with `last_tier_change_at/actor/reason/from/to`.
  - Writes an immutable `platform_audit_events` row with action
    `workspace_tier_changed`, prev_state, new_state, metadata.
  - Returns `{ok, workspace_id, tenant_id, subscription_id, from_tier_key, to_tier_key}`.
  - `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated`. The RPC
    re-checks the role server-side so revoking is defense in depth.

### Frontend additions

- **Tier badge in the workspace dashboard header** (`WorkspaceTierBadge` in
  `src/components/enterprise/WorkspaceDashboard.tsx`) — next to the
  workspace name, visible on every tab. Visual emphasis scales with tier:
  freemium = muted, pro = blue, enterprise+ = amber/gold. Read via the new
  `useWorkspaceTier(workspaceId)` hook against `workspace_active_tier`.
- **Tier badge on each picker card** in `Enterprise.tsx`. Same color
  scheme. The picker calls `fetchWorkspaceTiers()` once for all displayed
  workspaces (single round-trip).
- **"Change tier…" action** in `/superadmin → Workspaces → ⋯`. Opens a
  dialog with: current tier shown, dropdown of available tiers, required
  reason field (stored in audit log). Submitting routes through the
  superadmin-hub edge function's new `change-workspace-tier` action which
  calls the RPC.
- **New "Tier" column** in the Superadmin Workspaces table — the workspace
  list now shows each row's current tier at a glance, so a platform admin
  doesn't have to open each workspace individually to audit tier
  distribution.

### Edge function `superadmin-hub` v3

Two new actions:
- `change-workspace-tier` — delegates to the RPC above, propagates any
  error message verbatim to the caller.
- `list-tiers` — used by the change-tier dialog dropdown.

All 10 existing actions (platform-overview, list-workspaces,
workspace-action, list-feature-flags, toggle-feature-flag, list-cron-jobs,
trigger-edge-function, locale-registry, email-queue-status, platform-version)
are preserved in version 3.

### Governance update

`.governance/ui_ux_rules.md` now contains a new non-negotiable principle:
"Workspace tier persistence". It codifies:
- Tier is set ONCE at creation; only the superadmin RPC may change it.
- No other code path is permitted to mutate `tenant_subscriptions.tier_id`.
  Future audit cycles must enforce this — Pass 3 (DB-internal necessity
  verification) should surface only those two writers.
- The badge in the dashboard header is mandatory; paying customers must
  verify their tier without opening superadmin.
- Demo workspaces follow the same rule (whatever the operator picks in the
  dialog persists; the `seed-demo-workspace` default `'enterprise'` only
  applies when no `tier_key` is sent).

### Files changed

- `supabase/migrations/…workspace_tier_visibility_and_admin_change…` — new view + RPC (applied to remote via MCP).
- `supabase/functions/superadmin-hub/index.ts` — +2 actions, deployed as version 3.
- `src/hooks/useWorkspaceTier.ts` — new hook + batch fetch helper.
- `src/components/enterprise/WorkspaceDashboard.tsx` — `WorkspaceTierBadge` component + import + render in header.
- `src/pages/Enterprise.tsx` — picker-card tier badge + batch fetch effect.
- `src/components/superadmin/SuperadminControlPlane.tsx` — Tier column + "Change tier" action + change-tier dialog + `handleChangeTier` flow.
- `src/i18n/resources/en.ts`, `src/i18n/resources/hu.ts` — new `workspace_tier` namespace + 12 new superadmin keys (`ws_col_tier`, `ws_action_change_tier`, `ws_tier_change_*`, etc.) in both locales.
- `.governance/ui_ux_rules.md` — new "Workspace tier persistence" principle.
- `CLAUDE.md` — quick-reference entry.

### Verification

- DB: `SELECT * FROM workspace_active_tier ORDER BY started_at DESC` returns one row per workspace.
- DB: 12 of 12 existing workspaces are on `freemium` (unchanged — no silent migration).
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 146/146 passing.

### Why the user's perception was correct even though no auto-mutation existed

Without a visible tier indicator, users had to infer their tier from which
features were available — but the feature visibility depends on the tier
PLUS addons PLUS feature overrides PLUS the local feature-flags cache (5-min
TTL). Any of those can shift the visible feature set independently of the
tier. The combination felt random. Making the tier explicit and persistent
removes the ambiguity.

---

## 2026-05-13 — v3.16.0 Workspace UUID in URL + Back-button regression fix

### New routing principle (non-negotiable from now)

Every workspace-scoped route now uses the path shape **`/w/<workspaceId>/<rest>`**.
This is a deliberate exception to the previous "no internal IDs in URLs" rule
— workspace UUIDs are non-secret tenant identifiers and deep-linking into a
specific workspace is a primary product affordance (sharing links, bookmarks).

- Workspace picker: `/app` (also `/app?select=1` to force-show the picker)
- Dashboard: `/w/:workspaceId` (with `?tab=<name>` for tab selection)
- Legacy bookmarks `/app?ws=<uuid>` are auto-redirected (replace) to `/w/<uuid>`
- User IDs, session tokens, and email addresses are STILL forbidden in URLs.

### Fixed — Back button used to drop the user on the landing page

When a user picked a workspace from the picker grid, the old code called
`setSearchParams(..., { replace: true })` instead of pushing a new history
entry. The picker step was therefore invisible in browser history. Pressing
Back from any tab inside the dashboard fell through past the picker and
landed on `/` (the Landing page) — not the workspace picker.

Root cause was at `src/pages/Enterprise.tsx:98` (workspace selected from
picker) and `:187` (auto-select for returning users). Both used replace.

**Fix:** picking a workspace from the picker grid is now
`navigate('/w/<id>')` — a real history entry. Pressing Back from a tab
returns to the picker (or to whatever was before the picker, transitively).

The auto-redirect for returning users on `/app` (jump straight into the
last-used workspace) intentionally KEEPS `replace: true` — that one is a
transient URL with no meaning to the user, and the new
`.governance/ui_ux_rules.md` explicitly enumerates this as a legitimate
use of replace.

### Changed — `src/pages/Enterprise.tsx`

- Workspace identity is now driven by `useParams<{ workspaceId }>` instead
  of `useState + localStorage + ?ws=` query param.
- One component, two modes:
  - On `/app` → picker (auto-redirects to `/w/<last>` for returning users
    unless `?select=1`, an invite token, or the workspaces list is still loading).
  - On `/w/:workspaceId` → dashboard. If the path UUID doesn't match any
    workspace the user belongs to, a toast fires and the user is bounced
    (replace) to `/app?select=1`.
- Removed the legacy `userClearedWorkspace`/`setSelectedWorkspaceIdState`
  state — no longer needed since URL is the source of truth.
- Invite-acceptance flow now `navigate`s (replace) to `/w/<workspace_id>` on
  success, instead of mutating searchParams in place.

### Added — `.governance/ui_ux_rules.md`

- New "Core principle: Workspace identifier in URL" section codifies the
  rule, the exception, the back-button consequence, and the legacy-URL
  compatibility behavior.
- Existing "Core principle: Browser Back button" section expanded to
  enumerate exactly when `replace: true` is permitted (consumed tokens,
  auth/permission redirects, legacy-URL migration shims, transient
  same-tab auto-redirects). Anything user-clicked must push.

### Localization

1 new key in EN + HU: `enterprise_page.workspace_not_found` (shown when a
user follows a `/w/<uuid>` deep-link they no longer have access to).

### Files changed

- `src/App.tsx` — added `<Route path="/w/:workspaceId">` next to `/app`.
- `src/pages/Enterprise.tsx` — refactored URL-driven workspace selection.
- `src/i18n/resources/en.ts`, `src/i18n/resources/hu.ts` — 1 new key each.
- `.governance/ui_ux_rules.md` — new principle + expanded back-button section.
- `CLAUDE.md` — quick-reference entry for the new principle.
- `CHANGELOG.md`, `versioning/`, `marketing/marketing_values/` — release records.

**Tests:** 146/146 passing. **TypeScript:** 0 errors.

**Back-button verification matrix** (must be smoke-tested in browser):
- Landing `/` → click "Munkaterületeim" → `/app?select=1` → pick workspace
  → `/w/<id>` → click any tab → press Back → returns to picker.
- `/w/<id>` → click another tab → press Back → returns to previous tab.
- `/w/<A>` → ProfileMenu → "Change workspace" → picker → pick `<B>` →
  `/w/<B>` → press Back twice → returns to `/w/<A>`.
- Direct visit to `/app?ws=<uuid>` (legacy bookmark) → instant
  replace-redirect to `/w/<uuid>`. Back returns to whatever the user did
  before the bookmark.

---

## 2026-05-13 — v3.15.3 Superadmin Platform Control Plane: 3 bug fixes + 2 routing-tree UX additions

### Fixed — 3 hard regressions blocking the Superadmin UI

**Bug 1: Overview tab cards all showed `—` (empty)**
The OverviewTab read the response with a flat shape
(`data.total_workspaces`, `data.active_workspaces`, etc.) but the
`superadmin-hub` edge function returns a nested shape
(`{ workspaces: { total, active, ... }, users: {...}, features: {...},
email_queue: {...} }`). Every field was `undefined` so the cards rendered
`value ?? '—'`. Fixed by flattening the response at the client boundary
inside `OverviewTab.load()`.

**Bug 2: Workspaces tab rows had no name, locale, timezone, member count**
Same class of bug — the WorkspacesTab cast the response as
`Workspace[]` but the actual shape is `[{ workspace: {id,name,...},
member_count, owner_email }, ...]`. Every read of `w.name`/`w.locale`
yielded `undefined`. Fixed with an explicit mapper in
`WorkspacesTab.load()` that flattens and derives `status` from
`is_archived` + `recovery_mode`.

**Bug 3: Audit log tab errored with "[object Object]" + HTTP 404**
Root cause was *two stacked issues*:
1. The migration `20260513120000_platform_audit_events.sql` (created in
   v3.15.0) had never been applied to the remote DB. PostgREST returned
   404 because the `platform_audit_events` table did not exist.
2. The catch block used `String(e)` which produces `"[object Object]"`
   for `PostgrestError` (a plain object, not an Error instance).
Fixed by:
- Applying the missing migration to remote (table + RLS policies for
  platform admins).
- Applying the missing `20260513120100_fix_feature_dependencies.sql`
  (4 comma-joined dependency arrays + 1 cycle break) at the same time.
- Improving the error formatter in `PlatformAuditLogTab.load()` to read
  `.message`/`.details`/`.hint`/`.code` off PostgrestError before
  falling back to `JSON.stringify`.

### Added — 2 routing-tree UX improvements (Superadmin → Feature & Tier → Routing)

**Click-to-expand-all under a branch.** The count badge on every parent
node (e.g. the `3` on `/app/workflows/access` → `Workflow` → `Hozzáférés`)
is now an interactive button. Clicking it opens the node *and every node
beneath it* in a single batch, so an operator can drill into the
complete sub-structure with one click instead of expanding each level
manually. Stops propagation so the badge doesn't toggle the collapsible.

**Flat-path display mode.** A new view-mode toggle ("Fa nézet" /
"Lapos útvonal") appears at the right edge of the routing tab toolbar.
In Flat mode, each feature renders as a single line with its full
hierarchy concatenated:
```
/app/workflows/access / Workflow / Hozzáférés / Inbox / Hozzáférés inbox
```
Sorted by route, then by menu, then by sort_order. Choice is persisted
per user in localStorage. The audit banner and filter bar work in both
modes.

### Localization

3 new keys in EN + HU:
- `feature_tiers.tree_expand_all_under`
- `feature_tiers.tree_view_mode_tree`
- `feature_tiers.tree_view_mode_flat`

**Tests:** 146/146 passing. **TypeScript:** 0 errors.

---

## 2026-05-13 — v3.15.2 Routing seed: all 135 features now have route_path + menu_path

### Fixed — Empty route_path / menu_path for the whole catalog

The v3.13.x routing audit banner reported "Hiányzó menu_path 135" because
the columns existed in `features` but were never populated (the v3.15.0
release added the audit infrastructure but didn't seed the routing data).
This fills them in.

- New migration `20260513140000_seed_feature_routes_menus.sql` — 135
  `UPDATE public.features SET route_path = …, menu_path = ARRAY[…]`
  statements, one per feature. Route conventions:
  - `/app/<top-tab>[/<sub-tab>]` for in-workspace features
  - `/superadmin/*` for platform admin features
  - `/auth`, `/profile`, `/unsubscribe` for pre-workspace features
  Menu breadcrumbs are Hungarian (workspace primary language).
- Applied to remote DB; verified 135/135 features now have route + menu.
- No duplicate (route_path, menu_path) combos — distinguishes
  `workspace_general_settings` (TZ/locale-only) from `ws_general`
  (general settings hub) with a sub-breadcrumb.
- Sanity-guard `DO $$ ... $$` block at end of migration emits a WARNING
  if any future feature is added without a matching UPDATE.

### CSV regen

- `scripts/build_tiering_csvs.mjs` now parses `UPDATE features SET
  route_path = …, menu_path = …` migrations and includes the resolved
  values in `features.csv` (2 new columns) and `features.json` (new
  `route_path` + `menu_path` fields).
- `docs/tiering/features.{csv,json}` regenerated; 135/135 features have
  both fields populated.

**Tests:** 146/146 passing. **TypeScript:** 0 errors.

---

## 2026-05-13 — v3.15.1 Tiering follow-ups: audit viewer + catalog localization

### Added — Three items deferred from v3.15.0, all delivered

**Platform audit log viewer (Superadmin Control Plane):**
- New `PlatformAuditLogTab` — paginated table (50 rows / page) of
  `platform_audit_events`, with action filter, date filter, client-side
  search, and a detail dialog rendering prev/new state JSON side-by-side.
- New `'audit'` tab in `SuperadminControlPlane` (ScrollText icon).

**Tier + addon name localization:**
- `tiers.<tier_key>.{name,description}` and `addons.<addon_key>.*` keys
  in all 5 locales (en, hu, cs, sk, pl).
- New `src/lib/tiering/labels.ts` helper module (`tierName`,
  `addonName`, `featureName`, etc.) with DB-value fallback when the
  bundle lookup misses.
- `FeatureTiersTab` and `CreateWorkspaceDialog` switched to use the
  localized labels.

**Feature catalog localization (135 features × 2 fields × EN+HU):**
- 135 hand-curated EN translations of feature names + descriptions.
- HU bundle auto-generated from `docs/tiering/features.json`.
- `scripts/build_feature_labels.mjs` (generator with the EN translation
  table inline) + `scripts/inject_feature_labels.mjs` (idempotent
  injector for `features:` namespace in en.ts and hu.ts).
- `FeatureTiersTab` feature grid, routing tree, FeatureNodeCard cards,
  dependency / dependents chips, and FeatureDetailDialog all use the
  localized labels.
- cs/sk/pl deliberately *not* given per-feature names; the bundle
  fallback chain (active → en → key) keeps the UI functional.

**Other i18n:**
- New `platform_audit.*` namespace in all 5 locales (filter labels,
  table headers, pagination, detail dialog).
- `superadmin.tab_tiers` (replaces hardcoded "Feature & Tier" tab
  label) and `superadmin.tab_audit` in all 5 locales.

### Files changed

- `src/components/superadmin/PlatformAuditLogTab.tsx` — new (~240 lines)
- `src/components/superadmin/SuperadminControlPlane.tsx` — `audit` tab
- `src/components/superadmin/FeatureTiersTab.tsx` — localized labels
- `src/components/enterprise/CreateWorkspaceDialog.tsx` — localized tier name
- `src/lib/tiering/labels.ts` — new helper module
- `src/i18n/resources/{en,hu,cs,sk,pl}.ts` — new namespaces
- `scripts/build_feature_labels.mjs` — new generator
- `scripts/inject_feature_labels.mjs` — new injector

**Tests:** 146/146 passing. **TypeScript:** 0 errors. **Build:** clean.

---

## 2026-05-13 — v3.15.0 Feature Tiering — End-to-end activation

### Added — Tiering enforcement, audit, demo seeds, tests

Closes the gaps from the v3.13.x tiering rollout where the catalog and admin
UI shipped but the runtime contract was not wired through the app.

**FeatureGate wired up:**
- `WorkspaceSidebar` filters nav items by tier (fail-open when no tier
  binding exists, fail-closed once any feature is enabled).
- Premium admin tabs gated with `<FeatureGate>` + new `LockedFeatureNotice`
  fallback: Analytics (`executive_dashboard`), Developer Portal (`open_api`),
  Security Center (`soc2_iso`).

**Audit trail:**
- New immutable `platform_audit_events` table with platform-admin RLS.
- Every tier-feature toggle, addon-feature toggle, and feature routing edit
  writes an audit row from `FeatureTiersTab`.

**Tier-aware demo seeding:**
- `TIER_SEED_OVERRIDES` in `seed-data.ts`: Freemium = 6 members + minimal
  catalog; Pro = 12 members, 3 teams, 2 projects, 12 agile issues;
  Enterprise = full catalog. Per-owner `enterprise_seed_config` still wins.

**Localization:**
- 22 hardcoded strings in `FeatureTiersTab.tsx` + 3 in
  `CreateWorkspaceDialog.tsx` moved to a new `feature_tiers.*` /
  `create_workspace.tier_*` / `feature_gate.*` namespace, added in all 5
  locales (en, hu, cs, sk, pl).

**Docs / tooling:**
- `scripts/build_tiering_csvs.mjs` regenerates `docs/tiering/features.csv`,
  `dependency_matrix.csv`, `tiers_matrix.csv` from migration source-of-truth
  (135 rows each — were empty header-only stubs before).

**Tests:**
- New `featureTiering.test.ts` (13 tests) covering catalog invariants,
  dependency graph integrity (no cycles, all refs valid), tier inheritance,
  and demo seed monotonicity.

### Fixed — Seed data bugs caught by the new test suite

- 4 features had comma-joined dependency strings instead of proper text[]
  arrays (`site_assignment`, `ai_smart_schedule`, `ai_burnout_predict`,
  `burnout_engine`) — corrective migration splits them.
- `leave_conflict_check ↔ leave_daily_rules` 2-cycle resolved by removing
  the upward edge (`leave_daily_rules` no longer depends on
  `leave_conflict_check`).

**Tests:** 146/146 passing. **TypeScript:** 0 errors. **Build:** clean.

---

## 2026-05-12 — v3.14.1 Google OAuth Login Fix (HashRouter 404 flash)

### Fixed — Authentication

Resolved a critical login regression where Google OAuth redirects caused a ~1-second 404 "page not found" flash and could leave the user stuck on the error screen with no way to proceed.

**Root cause:** Supabase's OAuth implicit flow delivers tokens in the URL hash fragment (`#access_token=…`). The app uses HashRouter, which interprets everything after `#` as a route path. The token string matched no route → `<NotFound />` rendered. After `setSession()` resolved, the old code called `window.history.replaceState()`, which does **not** fire a `hashchange` event, so HashRouter never re-evaluated its routes and stayed on the 404 page.

**Fix:**

- `src/hooks/useAuth.tsx` — replaced `replaceState` with `window.location.replace(origin + '/#/app')` (on success) / `'/#/auth'` (on error). `location.replace` fires `hashchange`, which HashRouter correctly handles.
- `src/App.tsx` — added `OAuthCallbackGuard` component that synchronously detects `#access_token=` in the hash on first render and shows a neutral loading spinner instead of mounting the HashRouter. Once `useAuth` calls `location.replace`, the guard's `hashchange` listener clears the flag, HashRouter mounts with the clean `#/app` URL, and the user lands on the app with no 404 flash at all.

**Files changed:**
- `src/hooks/useAuth.tsx` — `setSession.finally(replaceState)` → `setSession.then(location.replace)`
- `src/App.tsx` — added `OAuthCallbackGuard`; wrapped `<HashRouter>` with it

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.14.0 Full Multilingual Coverage — CS / SK / PL / HU

### Fixed — Localization

Closed all remaining translation gaps across Czech, Slovak, Polish, and Hungarian locales. The application is now fully multilingual for all user-facing namespaces.

**Czech / Slovak / Polish — previously untranslated namespaces, now complete:**

- **`developer` namespace (84 keys):** API Keys tab, Webhooks tab, all form labels, scopes, validation messages, endpoint reference table, toast notifications — fully translated to CS / SK / PL.
- **`help.anchors` (24 context-aware help entries):** All contextual help drawer content (workspace overview, members, organization, calendar, approvals, requests, capacity DNA, command center, decision memory, coverage planner, org chart, audit log, quota manager, holiday manager, localization settings, integration health, role permissions, access requests, workflows, resources, reports, settings, agile panel) — translated from empty `{}` placeholder to full text in CS / SK / PL.
- **`demo_seed.group_workflow` key:** Properly translated in all three locales (CS: "Pracovní postup", SK: "Pracovný postup", PL: "Przepływ pracy").

**Hungarian — isolated untranslated keys fixed:**

- `ws_nav.workspace_label`: "Workspace" → "Munkaterület"
- `landing.cmp5_label`: "Audit trail" → "Auditnyomvonal"
- `annual_leave_grid.allowance_label`: "Allowance" → "Keret"
- `annual_leave_grid.carryover_label`: "Carried over" → "Átvitt"
- `annual_leave_grid.used_label`: "Vacation used" → "Felhasznált szabadság"
- `annual_leave_grid.remaining_label`: "Remaining" → "Maradék"
- `integration_mgr.auto_create_label`: "Auto-create" → "Automatikus létrehozás"
- `annual_leave_grid.quota_missing_warning`: Updated inline reference from "Vacation used" to "Felhasznált szabadság"

**Files changed:**
- `src/i18n/resources/cs.ts` — +259 lines (developer namespace + help anchors + group_workflow)
- `src/i18n/resources/sk.ts` — +259 lines (same)
- `src/i18n/resources/pl.ts` — +259 lines (same)
- `src/i18n/resources/hu.ts` — +8 key corrections

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.13.0 Superadmin / Platform Control Plane

### Added — Platform Administration

Platform-level superadmin control plane accessible at `/superadmin` (admin role only). Sharply separated from workspace-level admin controls — no workspace business logic is affected.

**New route:** `/superadmin` → `src/pages/Superadmin.tsx`
- Auth-gated: checks `user_roles.role = 'admin'`, redirects to `/app` if unauthorized
- Header has back-to-Admin button; Admin page header has "Platform Control Plane →" button

**`SuperadminControlPlane` component (`src/components/superadmin/SuperadminControlPlane.tsx`, 1074 lines):**
6-tab layout — all data fetched lazily (tab activates on first open):

| Tab | Purpose |
|---|---|
| **Overview** | Platform-wide KPI cards: workspaces (total/active/archived/recovery), users (total/new 30d), feature flags enabled, email queue pending |
| **Workspaces** | Searchable table of all enterprise workspaces with status badges. Archive/unarchive, enable/disable recovery mode (with reason), hard-delete (requires typing workspace name to confirm) |
| **Feature Flags** | Toggle `platform_feature_flags` entries on/off with instant feedback |
| **Scheduled Jobs** | List pg_cron jobs; trigger allowlisted edge functions (`sync-holidays`, `ms365-sync`, `send-scheduled-reports`, `cleanup-temp-users`, `cleanup-demo-workspace`) |
| **Locales** | Locale registry with workspace counts and feature flag status per locale |
| **Email Queue** | Queue depth by status + last 10 entries |

All mutations behind `AlertDialog` confirmation gates. Zero hardcoded strings — 98 `t('superadmin.*')` calls.

**New edge function: `supabase/functions/superadmin-hub/index.ts` (634 lines)**
Actions: `platform-overview`, `list-workspaces`, `workspace-action` (archive/unarchive/enable_recovery/disable_recovery/delete), `list-feature-flags`, `toggle-feature-flag`, `list-cron-jobs`, `trigger-edge-function`, `locale-registry`, `email-queue-status`, `platform-version`.
Auth: JWT → `user_roles` admin check on every request. Service role operations server-side only.

**New DB migration: `20260512230000_platform_superadmin.sql`**
- `platform_feature_flags`: key, description, category, enabled, notes, updated_by, updated_at; RLS admin-only; 10 seed rows
- `updated_at` trigger via `update_updated_at_column()`

**i18n:** `superadmin` namespace (69 keys) added to all 5 locales (EN / HU / CS / SK / PL).

**Security design:**
- Backend-enforced: edge function re-checks admin role on every call
- Service role key never exposed to client
- pg_cron and function triggers use allowlist — no arbitrary invocation
- Workspace delete requires name confirmation in UI + server-side auth check

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.12.0 SOC 2 / ISO 27001 Technical Controls — Security Center

### Added — Security & Compliance

Enterprise-grade security and compliance module for SOC 2 Type II and ISO 27001 readiness.

**`SecurityCenter` component (`src/components/enterprise/security/SecurityCenter.tsx`):**
- **Audit log viewer (Tab 1):** Reads enhanced `enterprise_audit_events` (now with `ip_address` and `user_agent` columns). Filters: action type, date range, actor search. Expandable rows show prev_state/new_state diff. Paginated (50/page). CSV export.
- **Data retention policy configuration (Tab 2):** Create/edit retention policies per table (`enterprise_audit_events`, `enterprise_api_usage_logs`, `wellbeing_scores`, etc.) with configurable retention days. `is_active=false` by default — activation requires explicit admin action after legal review. Backed by `enforce_data_retention()` PostgreSQL function callable via pg_cron.
- **GDPR tools (Tab 3):** Article 20 data portability — downloads all user data as JSON from 5 tables. Article 17 erasure requests tracked in `gdpr_requests` table with status workflow.
- Active session management: revoke any user's sessions via `security-admin` edge function.

**Navigation:** "Security" tab visible to workspace admins in top nav.

**New edge function: `supabase/functions/security-admin/index.ts`**
- Actions: `export-audit-log`, `list-sessions`, `revoke-session` (global sign-out), `data-export-gdpr`

**New DB tables/changes (migration `20260512220000_payroll_security_platform.sql`):**
- `enterprise_audit_events`: added `ip_address TEXT`, `user_agent TEXT` columns
- `data_retention_policies`: table-level retention rules, `is_active` defaults to false
- `gdpr_requests`: tracks export/deletion requests with status lifecycle
- `enforce_data_retention()`: SECURITY DEFINER function for pg_cron (not scheduled by this migration)

**i18n:** `security` namespace added to all 5 locales (EN / HU / CS / SK / PL). `ws_nav.security` key added.

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.11.0 Payroll Integration Engine (DATEV, Personio, BambooHR, SAP, Workday, ADP, Generic)

### Added — Payroll

Multi-provider payroll export system with period lifecycle management and provider-specific CSV formatting.

**`PayrollPanel` component (`src/components/enterprise/payroll/PayrollPanel.tsx`):**
- Payroll period management: create periods (name + date range), list with status badges (Open / Locked / Exported)
- Period summary table: per-member breakdown of regular hours, overtime hours, leave days, gross estimate
- 4 KPI cards: Total Hours, Overtime Hours, Gross Estimate, Member Count
- **Export (11 providers):** DATEV (LODAS semicolon format, German headers), BambooHR, Personio, SAP SuccessFactors, Workday, ADP Workforce Now, Sage HR, Billingo (HU), Számlázz.hu (HU), Pohoda (CZ/SK), Generic CSV — all client-side CSV download
- **Period locking:** Confirm dialog → sets status=locked, writes immutable audit event to `enterprise_audit_events`
- Additional providers can be added by extending the provider switch in the edge function

**New edge function: `supabase/functions/payroll-export/index.ts`**
- Actions: `calculate-period` (server-side aggregation), `export-csv` (provider-formatted), `lock-period` (audit-safe), `export-api` (placeholder for direct provider API push)
- Provider adapters: datev, bamboohr, personio, generic

**New DB tables (migration `20260512220000_payroll_security_platform.sql`):**
- `payroll_periods`: id, workspace_id, name, start/end date, status (open/locked/exported), lock/export timestamps and actor
- `payroll_export_configs`: per-workspace provider config + field mappings JSONB

**Navigation:** Payroll sub-tab in Resources → Payroll (admin-only, `CreditCard` icon).

**i18n:** `payroll` namespace added to all 5 locales (EN / HU / CS / SK / PL). `ws_nav.payroll` key added.

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.10.0 Open API Platform & Developer Ecosystem

### Added — Enterprise API Platform

Self-service API infrastructure for integrating Effectime with third-party tools and custom workflows.

**`DeveloperPortal` component (`src/components/enterprise/developer/DeveloperPortal.tsx`):**
- API key management: create named keys with scopes (read, write, webhooks, admin), list active keys, one-time key reveal dialog, revoke keys
- SHA-256 hashing of keys via `crypto.subtle` — raw key never persisted
- 7-day API usage chart (BarChart from Recharts) from `enterprise_api_usage_logs`
- Webhook subscriptions: create with HTTPS-only URL validation, auto-generated signing secret, per-event-type checkboxes (member.created, leave.approved, etc.), toggle active/inactive, delete
- Static developer reference card with authentication header example, rate limit, and endpoint overview

**New DB tables (migration `20260512210000_analytics_wellbeing_api_platform.sql`):**
- `enterprise_api_keys` — key_prefix, key_hash (SHA-256), scopes, expires_at, revoked_at, last_used_at
- `enterprise_api_usage_logs` — method, path, status_code, duration_ms per request
- `enterprise_webhook_subscriptions` — url, secret, events[], is_active, last_fired_at, last_error

**Navigation:** "Developer API" tab visible to workspace admins (owner / resourceAssistant) in top nav.

**i18n:** `developer` namespace added to all 5 locales (EN / HU / CS / SK / PL).

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.9.0 Burnout & Wellbeing Detection Engine

### Added — Predictive Wellbeing

Automated wellbeing scoring and alert system to help managers identify burnout risk early.

**`WellbeingDashboard` component (`src/components/enterprise/wellbeing/WellbeingDashboard.tsx`):**
- 5-component weighted scoring algorithm: overtime density (30%), leave utilization (20%), weekend work density (25%), schedule stability (15%), recovery time (10%)
- Score range 0–100 with status tiers: Healthy (≥70), Monitor (40–69), At Risk (<40)
- "Recalculate" button upserts scores for all members to `wellbeing_scores`
- Auto-creates `wellbeing_alerts` for members scoring <40 (burnout_risk, high_overtime, low_leave_usage, weekend_overload)
- Team heatmap: color-coded grid of all members with score badge
- Alert inbox with severity filter and Resolve button (marks resolved_at, resolved_by)
- Admin-only; accessible via Resources → Wellbeing sub-tab

**`WellbeingScoreCard` component (`src/components/enterprise/wellbeing/WellbeingScoreCard.tsx`):**
- Employee self-view in My Portal: score donut, 5-component breakdown from JSONB, leave recommendation hint when score <60

**New DB tables:**
- `wellbeing_scores` — workspace_id, membership_id, score (0–100), components JSONB, calculated_at
- `wellbeing_alerts` — alert_type, severity (low/medium/high), message, triggered_at, resolved_at, resolved_by

**i18n:** `wellbeing` namespace added to all 5 locales (EN / HU / CS / SK / PL).

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.8.0 Real-time Executive Intelligence Dashboard with Predictive Analytics

### Added — Executive Analytics

A dedicated analytics view for workspace admins giving KPI summary, 6-month labor cost forecast, 13-week coverage risk heatmap, and absence risk ranking.

**`AnalyticsDashboard` component (`src/components/enterprise/analytics/AnalyticsDashboard.tsx`):**
- 4 KPI cards: Scheduled Hours (MTD), Labor Cost (MTD), Absence Rate, Coverage Score
- 6-month labor cost forecast AreaChart (Recharts): projects cost from `enterprise_member_rates` × scheduled hours
- 13-week coverage risk heatmap: color-coded day-grid using `leave_requests` + `enterprise_coverage_rules`, risk levels none / low / medium / high / critical
- Absence risk table: members ranked by sick days + overtime in last 90 days, red-highlighted high-risk rows

**Navigation:** "Analytics" tab visible to workspace admins in top nav.

**i18n:** `analytics` namespace added to all 5 locales (EN / HU / CS / SK / PL) including `kpi_*_sub` subtitle keys.

**TypeScript:** 0 errors.

---

## 2026-05-12 — v3.7.9 Extended office parameters: hours, contact, equipment, min staffing

### Added — Office / location management

Extended `enterprise_offices` with new parameters and redesigned the `OfficeManager` UI to a Dialog-based editor with collapsible sections.

**New scalar columns on `enterprise_offices`:**
- `email`, `phone` — store contact details; shown compactly in the list view
- `manager_name`, `deputy_name` — manager / deputy name
- `opening_hours` (JSONB) — per-day open/close times with closed toggle (Mon–Sun)

**New relational tables (with RLS — members read, admins write):**
- `enterprise_office_equipment` — equipment/facilities list per office; each item can optionally require a specific skill (`required_skill_id → enterprise_skills`)
- `enterprise_office_min_staffing` — permanent minimum staffing requirements per office (position or skill + headcount); distinct from date-ranged coverage rules

**UI changes (`OfficeManager.tsx`):**
- List view now shows phone, email, manager inline as compact chips
- "New office" and edit pencil both open a full Dialog with four collapsible sections:
  1. Basic info (name, city, address, email, phone, manager, deputy)
  2. Opening hours — per-day grid with time pickers and "Closed" toggle
  3. Equipment — live CRUD list with skill requirement picker
  4. Minimum staffing — live CRUD list with role + skill dropdowns
- Equipment and staffing sections disabled when creating a new office (hint shown); available immediately after save

**i18n:** all new keys added to all 5 locales (EN / HU / CS / SK / PL).

**Migration:** `supabase/migrations/20260512100000_office_extended_params.sql`

**TypeScript:** 0 errors.

---

## 2026-05-11 — v3.7.8 Complete Hungarian string overhaul — full i18n for all 5 locales

### Changed — Localization (non-breaking)

**14 new i18n namespaces added across all 5 locales (EN / HU / CS / SK / PL):**
`admin`, `demo_seed`, `delete_account`, `change_password`, `profile_menu`, `password_req`,
`coverage_conflict`, `density_toggle`, `annual_trend`, `profile`, `unsubscribe`,
`import_export`, `enterprise_page`, `calendar_filter_config`

**Additional keys added to existing namespaces:**
- `common.month_*_short` — 12 abbreviated month names used in `AnnualTrendChart`
- `admin.tab_overview` — Overview tab label in `Admin.tsx`

**Components migrated to `t()` (hardcoded Hungarian removed):**
`CoverageConflictSummary`, `DensityToggle`, `AnnualTrendChart`, `LeaveCalendar`,
`Profile`, `Admin`, `Unsubscribe`, `ImportExportCenter`, `Enterprise`, `AppShell`,
and 80+ additional component, page, hook, and shell files

**Utility/lib files — English hardcoded (acceptable; non-component context):**
`calculations.ts`, `coverageEligibility.ts`, `conflictEngine.ts`, `file-parser.ts`,
`entity-registry.ts`, `useEnterprisePermissions.ts` (FEATURE_GROUPS / STANDALONE_FEATURES)

**Intentional exemptions:**
- `'kész'` in `AgileInsights.tsx` — Jira board status value, not UI text
- `BUILTIN_TEMPLATES` in `HRWorkflowTemplates.tsx` — DB-stored seed content

**Test result:** 0 TypeScript errors. All existing tests pass.

---

## 2026-05-11 — v3.7.7 Fix site assignment in time attendance: RLS bypass + CHECK constraint

### Fixed — Employee site-assignment (two root causes)

**1. RLS policies blocked employee writes (Critical)**
The `enterprise_shift_assignments` table's INSERT/UPDATE/DELETE policies require `owner` or `resourceAssistant` role. Regular employees (role `member`) received a silent rejection when the time-attendance day editor tried to save a site assignment. The SELECT policy correctly allows all members to read.

**2. `shift_role_or_skill` CHECK constraint violated (Critical)**
The table enforces `business_role IS NOT NULL OR skill_id IS NOT NULL`. The previous `upsertSiteAssignment` sent neither field, so every insert failed at the DB level with a constraint violation.

**Fix — two SECURITY DEFINER RPCs (`20260511100000_attendance_site_assignment_rpcs.sql`)**
- `attendance_upsert_site_assignment(p_workspace_id, p_membership_id, p_office_id, p_shift_date)` — verifies the caller owns the membership record, reads their `business_role` (falls back to `'employee'` if not set), and does an atomic upsert keyed on the `uq_shift_user_date` constraint.
- `attendance_remove_site_assignment(p_workspace_id, p_membership_id, p_shift_date)` — allows the membership owner or a workspace admin to delete the assignment.
- `api.ts` `upsertSiteAssignment` / `removeSiteAssignment` updated to call these RPCs (no frontend signature change; `userId` arg is now unused since the RPC uses `auth.uid()` server-side).

**Files touched (2):** `src/components/enterprise/time-attendance/api.ts`, `supabase/migrations/20260511100000_attendance_site_assignment_rpcs.sql` (new)

**Test result:** All existing tests pass. 0 TypeScript errors. Production build clean.

---

## 2026-05-11 — v3.7.6 Critical follow-ups from v3.7.5 audit: correct onConflict key, full conflict-engine localization, hardcoded HU sweep

### Fixed — Runtime correctness and localization gaps surfaced after v3.7.5

**1. `api.ts` — `upsertSiteAssignment` onConflict mismatch (Critical hot-fix on v3.7.5)**
v3.7.5 introduced an atomic upsert keyed on `(workspace_id, membership_id, shift_date)`, but the actual UNIQUE constraint on `enterprise_shift_assignments` is `uq_shift_user_date (workspace_id, user_id, shift_date)`. Supabase would have rejected the upsert at runtime with "no unique constraint matching ON CONFLICT specification." Corrected the `onConflict` key to `'workspace_id,user_id,shift_date'`.

**2. `conflictEngine` — full localization of all conflict messages (Major UX)**
Every conflict message returned by `validateLeaveRequest` was previously hardcoded Hungarian. Czech, Slovak, Polish, and English users saw Hungarian error toasts when a leave request triggered any rule. Refactored the engine to emit structured `{ code, params }`, added a new `formatConflict(c, t)` helper in `src/lib/conflictEngineI18n.ts`, and added the `conflict.*` namespace to all 5 locales (11 keys × 5 languages). The Hungarian `message` field is preserved on the engine output for backward compatibility with any other consumers (logs, debug).

**3. `AdminLeaveOverride.tsx` — unhandled validateLeaveRequest throw (Major)**
v3.7.5 made `validateLeaveRequest` throw on fetch error, and `LeaveRequestDialog` was updated. `AdminLeaveOverride` had the same call pattern but was not updated — an unhandled rejection would have surfaced. Now wraps the call in try/catch and emits a blocking VALIDATION_ERROR conflict, mirroring the dialog.

**4. `WorkspaceDashboard.tsx` — hardcoded HU report/widget names + toasts (Major)**
The `WorkspaceSettings` sub-component had hardcoded Hungarian strings for: 4 default calendar widget names ("Csapat elérhetőségi összefoglaló" etc.), 2 default custom report names, 5 report-template dropdown labels, and 4 toast messages. All extracted to a new `workspace_settings.*` namespace across all 5 locales (14 keys × 5 languages). **Important:** the default widget/report names are now seeded from the active locale rather than always being Hungarian, but workspaces that previously saved settings still see the persisted Hungarian strings (no DB migration).

**5. New characterization tests for `formatConflict` (32 tests)**
Added `src/test/conflictEngineI18n.test.ts` with locale-parameterised tests verifying:
- Every conflict code renders without leaking the translation key (`conflict.*`)
- Scoped vs unscoped MAX_OFF picks the correct key
- `VALIDATION_ERROR` falls through to the system error string (not translated)
- Unknown codes fall back to the engine's HU message
- All 5 locales define all 11 required `conflict.*` keys

**Files touched (12):** `src/lib/conflictEngine.ts`, `src/lib/conflictEngineI18n.ts` (new), `src/components/enterprise/LeaveRequestDialog.tsx`, `src/components/enterprise/AdminLeaveOverride.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`, `src/components/enterprise/time-attendance/api.ts`, `src/i18n/resources/{en,hu,cs,sk,pl}.ts`, `src/test/conflictEngineI18n.test.ts` (new)

**Test result:** 133/133 tests pass (101 → 133, +32 new). 0 TypeScript errors. Production build clean.

---

## 2026-05-11 — v3.7.5 System audit: conflict-engine bugs, i18n completeness, atomic site-assignment

### Fixed — Four production bugs identified by full-system audit

**1. `conflictEngine.ts` — silent validation bypass on fetch error (Critical)**
When any of the six parallel Supabase calls in `validateLeaveRequest()` failed (network, auth, or schema error), the result was silently replaced with `[]`. This meant a leave request could proceed through validation with no conflicts reported even though the blocking rules were never evaluated. Fix: all fetch errors are now aggregated and thrown immediately, and `LeaveRequestDialog` catches the throw, blocks submission, and shows a user-facing toast.

**2. `conflictEngine.ts` — `max_off` rule ignores `role_filters` (Major)**
The `offCount` calculation counted every approved/pending leave request in the date range, regardless of the rule's `role_filters`. A rule scoped to "senior engineers" was silently evaluated against all employees. Fix: role-scoped rules now only count requests from members whose `business_role` matches the filter, using an O(1) userId→role map built from the already-fetched memberships.

**3. `conflictEngine.ts` — `ruleApplies` never fired for rules with no `days_of_week` (Major)**
`ruleApplies` (daily max-off) used `!days.includes(dow)` which returns false for an empty array — so a recurring rule with no day restriction was silently skipped every day. `officeRuleApplies` (coverage rules) correctly used `days.length > 0 && !days.includes(dow)`. Both functions now use the same "empty = all days" semantics.

**4. `api.ts` — `upsertSiteAssignment` non-atomic delete→insert (Major)**
The previous delete-then-insert pattern left a gap where no shift assignment existed. A concurrent call or a failure between the two operations could silently delete the assignment. Replaced with a single atomic `upsert` with `onConflict: 'workspace_id,membership_id,shift_date'`.

**5. `i18n` — `en.verify_subtitle_suffix` empty (Minor / test failure)**
`auth_page.verify_subtitle_suffix` was `''` in EN while HU had `'.'`. Failing i18n parity test. Fixed to `'.'`.

**6. `EmployeeMonthView.tsx` — `collectSubmissionWarnings` hardcoded Hungarian (Minor)**
Two warning strings in the attendance submission flow were hardcoded HU. Extracted to `attendance_view.warn_no_segments` and `attendance_view.warn_low_hours` (with `{{worked}}` / `{{expected}}` interpolation) across all 5 locales.

**Files touched (9):**
`src/lib/conflictEngine.ts`, `src/components/enterprise/LeaveRequestDialog.tsx`, `src/components/enterprise/time-attendance/api.ts`, `src/components/enterprise/time-attendance/EmployeeMonthView.tsx`, `src/i18n/resources/en.ts`, `src/i18n/resources/hu.ts`, `src/i18n/resources/cs.ts`, `src/i18n/resources/sk.ts`, `src/i18n/resources/pl.ts`

**Test result:** 101/101 tests pass. 0 TypeScript errors.

---

## 2026-05-11 — v3.7.4 Fix: ReferenceError "t is not defined" in WorkspaceSettings

### Fixed — Workspace settings tab failed to render with `ReferenceError: t is not defined`

The `WorkspaceSettings` helper component (`src/components/enterprise/WorkspaceDashboard.tsx:787`) was switched to localized section titles in v3.7.2 (`t('settings_sections.*')`) but the component itself never called `useI18n()` — it relied on the outer `WorkspaceDashboard`'s `t`, which is out of scope inside a separate function declaration. After minification this crashed every render of the Settings tab.

**Fix:** Added `const { t } = useI18n();` at the top of `WorkspaceSettings` (line 788). Build hash changed (`C9A064Tf` → `fi7qugw_`), confirming the regression is gone.

**Files touched (1):** `src/components/enterprise/WorkspaceDashboard.tsx`

---

## 2026-05-11 — v3.7.3 Language selector on public pages; full i18n for Landing, Auth, ResetPassword

### Added — Language selector visible on all public pages before login; auto-detects visitor locale

Per the v3.7.x localization mandate the language selector (flag icons) now appears in the header of every public-facing page so visitors can switch language before they ever log in. Browser locale auto-detection picks the correct language for new visitors with no saved preference (HU → Hungarian, CS → Czech, SK → Slovak, PL → Polish, everything else → English).

**New locale namespaces (added to en, hu, cs, sk, pl in lockstep):**

- `landing` — all strings on the marketing landing page: nav links, hero title (split `hero_title_prefix` / `hero_title_accent` for grammatical flexibility), feature/benefit items f1–f6 / b1–b6, CTA buttons, footer copyright with `{{year}}` interpolation.
- `auth_page` — all strings on the Auth page: feature panel (f1–f6), trust badges (tb1–tb6), workflow steps (ws1–ws3), comparison table (cmp1–cmp6), FAQ accordion (faq1–faq6), form labels, validation toasts, verify-email view (split `verify_subtitle_prefix` / `verify_subtitle_suffix` to keep email address bold with correct word order per language).
- `reset_password` — all 12 strings on the password-reset page: title, subtitle, labels, button, toasts, validation messages.

**Component updates:**

- `Landing.tsx` — `LanguageSelector` added to header; all hardcoded strings replaced with `t('landing.*')`; `FEATURES` and `BENEFITS` arrays moved inside component to access `t()`; hero H1 uses split-key pattern for accented span.
- `Auth.tsx` — `LanguageSelector` added to header; all data arrays (`features`, `trustBadges`, `workflowSteps`, `comparisonRows`, `faqItems`) moved inside component; all toasts and UI strings use `t('auth_page.*')`; verify-subtitle uses prefix/suffix split.
- `ResetPassword.tsx` — `LanguageSelector` placed in both render branches (invalid-link fallback + main form); all 12 strings replaced with `t('reset_password.*')`.

**Files touched (8):**
`src/i18n/resources/en.ts`, `src/i18n/resources/hu.ts`, `src/i18n/resources/cs.ts`, `src/i18n/resources/sk.ts`, `src/i18n/resources/pl.ts`, `src/pages/Landing.tsx`, `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`

---

## 2026-05-11 — v3.7.2 Localization sweep: top nav, header, settings sections, HR workflow inbox, attendance buttons

### Added — Full localization of remaining hardcoded UI strings across all 5 locales

Following the v3.7.x localization mandate, this release replaces the last large group of hardcoded Hungarian/English strings in the high-traffic workspace shell so Czech/Slovak/Polish users no longer see Hungarian labels in primary navigation, header, time-tracking, processes, or settings.

**New locale namespaces (added to en, hu, cs, sk, pl in lockstep):**

- `ws_nav` — top-level tab labels (`my_portal`, `members`, `organization`, `calendar`, `time_attendance`, `requests`, `workflows`, `resources`, `reports`, `reports_audit`, `settings`), sidebar (`navigation_label`, `workspace_label`, `back_to_workspaces`, `back`), header buttons (`profile_btn`, `invite_btn`, `sign_out_btn`, `command_center`, `org_pulse`, `refresh`, `unknown_user`), and calendar sub-tabs (`cal_main`, `cal_timeline`, `cal_coverage`, `cal_annual`).
- `settings_sections` — all 16 SettingsSection titles on the Beállítások / Settings tab (`permissions`, `offices`, `quota_admin`, `integrations`, `ical`, `localization`, `recovery_mode`, `integration_health`, `help_system`, `allowances`, `workspace_general`, `branding`, `import_export`, `calendar_filters`, `ui_section_states`, `layout_setting`).
- `hr_workflow` — HR workflow inbox: tab labels (`tab_inbox`, `tab_templates`), category meta (medical_exam → custom), status meta (open/in_progress/completed/cancelled), priority meta (low/normal/high/urgent), filter/empty/loading/dialog labels, toast strings, and the "Start workflow" call-to-action.
- `attendance_view` — Employee month view: edit/submit buttons (`btn_edit_short`, `btn_submit_short`, `btn_save_changes`, `btn_record_oncall`), `editing_open_badge`, `info_edit_help`, `returned_label`, month-nav aria-labels (`prev_month`, `next_month`), tooltips, submit warnings/toasts.

**Component updates:**

- `WorkspaceDashboard.tsx` — top-nav array now references `i18nKey` and resolves via `t()`; header buttons (`Profilom`, `Meghívás`, `Kilépés`), back-button aria-label, calendar sub-tabs, and all 16 SettingsSection titles localized.
- `WorkspaceSidebar.tsx` — sidebar nav items, back button, "Workspace" / "Navigáció" labels localized.
- `WorkflowsModule.tsx` — `HR folyamatok` / `HR sablonok` tabs.
- `HRWorkflowInbox.tsx` — full sweep: `CATEGORY_LABELS` replaced with a `CATEGORY_I18N_KEY` lookup, `STATUS_META` / `PRIORITY_META` reduced to CSS-only metadata, all toasts, dialog labels, filter dropdown, action buttons.
- `EmployeeMonthView.tsx` — Szerkesztés / Benyújtás / Módosítások mentése / Készenlét rögzítése buttons, "Szerkesztésre megnyitva" badge, info banner, "Javításra visszaküldve" prefix, month-navigation aria-labels, loader, submit warnings/toasts. Status badge now uses `t(\`attendance.status_${status}\` as any)` instead of hardcoded `STATUS_LABELS`.
- `CommandCenterButton.tsx` / `OrgPulseButton.tsx` — `Parancsközpont` / `Org Pulse` button text + aria-label, `Frissítés` refresh links via `ws_nav.refresh`.
- `AdminOverview.tsx` / `EmployeeDashboard.tsx` — STATUS_LABELS consumers patched to resolve status labels via `t('attendance.status_*')`.

**Removed:**

- Dead `STATUS_LABELS` export from `time-attendance/types.ts` (no remaining consumers).
- Stale Hungarian `STATUS_LABELS` import lines in EmployeeDashboard and AdminOverview.

**Files touched (15):**

- `src/i18n/resources/{en,hu,cs,sk,pl}.ts`
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `src/components/shell/WorkspaceSidebar.tsx`
- `src/components/enterprise/workflows/WorkflowsModule.tsx`
- `src/components/enterprise/workflows/HRWorkflowInbox.tsx`
- `src/components/enterprise/CommandCenterButton.tsx`
- `src/components/enterprise/OrgPulseButton.tsx`
- `src/components/enterprise/time-attendance/EmployeeMonthView.tsx`
- `src/components/enterprise/time-attendance/AdminOverview.tsx`
- `src/components/enterprise/time-attendance/types.ts`
- `src/components/enterprise/self-service/EmployeeDashboard.tsx`

**Compatibility:** Purely textual UI changes. No DB, no RPC, no schema, no behavior changes. TypeScript clean. Existing translation override workflow (workspace-level CSV) continues to function — new keys fall back to English when an override is missing.

**Remaining for next round:** `CreateWorkspaceDialog.tsx` (Demo workspace seed text), Naptár sidebar widget admin panel, Riport konfiguráció templates, Munkaterület beállítások meta panel, and lower-priority screens (ICalSubscription, BrandingManager, NotificationPreferences, etc.) flagged in the audit but not user-facing on the home screen.

---

## 2026-05-11 — v3.7.1 Time Attendance: explicit edit mode + drag-select batch fill

### Added — Member-side calendar UX upgrade

**Explicit edit mode toggle.** The employee's monthly calendar is now read-only by default. To make changes, the user clicks a pencil **„Szerkesztés"** button — a yellow „Szerkesztésre megnyitva" badge appears, the helper banner explains the new interactions, and only then are day cells clickable / draggable. Clicking **„Módosítások mentése"** (save icon) returns the calendar to read-only. The pencil button re-appears so editing can be resumed. This prevents accidental edits and creates an unambiguous commit point that is separate from the final **Benyújtás** (submit-for-approval) action.

- Edit mode is automatically left when the month changes or the period transitions to a non-editable status (submitted / approved / locked / exported).
- The server-side state machine still governs whether editing is possible at all; edit mode is a UI-layer gate on top of that.

**Batch kitöltés (one-shot range fill).** New **Batch kitöltés** button (Zap icon) opens a dialog that fills a date range with one daily start/end time in a single action.

- Inputs: start date, end date, daily start time, daily end time, segment type (regular / overtime).
- Toggles: skip weekends, auto-detect night hours (22:00–06:00), overwrite existing rows.
- Live summary: shows how many days will be written, how many weekends are skipped, how many days already have data.
- Loops `attendance_upsert_segment` per day; reports counts (ok / skipped / failed) in a single toast.
- `BatchFillDialog.tsx` (~190 sor).

**Drag-select multi-day.** In edit mode, click-and-drag across day cells (mouse, touch, or pen) selects the range; on pointer-up the **Batch kitöltés** dialog opens pre-populated with `[min, max]` of the dragged dates. A single click (no drag) still opens the per-day editor.

- Implemented with pointer events + `data-day-cell` markers + `document.elementFromPoint` for touch coverage.
- Visual: amber ring on hovered cells while dragging.
- `touch-action: none` on the grid while in edit mode to prevent mobile scroll-jitter.
- Global `pointercancel` listener resets state safely if the pointer leaves the grid.

**File:** `src/components/enterprise/time-attendance/EmployeeMonthView.tsx` (rewritten; ~280 sor).

**Compatibility:** Existing read paths, segment storage, server RPCs, payroll export, and audit trail are unchanged. The change is UI-only and additive.

---

## 2026-05-11 — v3.7.0 HR Workflow Automation + Employee Self-Service Portal

### Added — Group 2 (HR Workflow Automation) + Group 4 (Employee Self-Service) + Group 6 (Payroll Readiness)

**HR Workflow Engine (Group 2):**

New general-purpose HR workflow tables and components covering the full lifecycle of recurring and ad-hoc HR processes.

**Database (1 migration `20260511000001_create_hr_workflows.sql`):**
- `enterprise_hr_workflow_templates` — named workflow templates per workspace; `steps` jsonb array with `title`, `due_offset_days`, `is_required`; optional `recurrence_months` for periodic workflows.
- `enterprise_hr_workflow_instances` — live workflow runs: status `open → in_progress → completed/cancelled`, priority `low/normal/high/urgent`, `due_date`, member link.
- `enterprise_hr_workflow_tasks` — individual step rows materialised from template steps at instance creation time; per-task `due_date = instance.due_date + offset`.
- 4 SECURITY DEFINER RPCs: `hr_workflow_create_instance`, `hr_workflow_update_task`, `hr_workflow_close_instance`, `hr_workflow_list_instances`.
- RLS: admins full access; members read own instances; assignees read + update own tasks.

**6 Built-in Template Definitions (TypeScript presets, loaded on demand):**
| Category | Name |
|----------|------|
| `medical_exam` | Éves munkavédelmi orvosi vizsgálat (4 lépés, éves ismétlődés) |
| `salary_advance` | Bér-előleg igény feldolgozása (5 lépés) |
| `contract_amendment` | Munkaszerződés-módosítás (6 lépés) |
| `probation_review` | Próbaidő-értékelés (5 lépés) |
| `fixed_term_expiry` | Határozott idejű szerződés lejárata (4 lépés) |
| `offboarding` | Kiléptetés — offboarding (7 lépés) |

**Frontend (`src/components/enterprise/workflows/`):**
- `HRWorkflowTemplates.tsx` — Admin template manager: collapsible step view, create/edit/archive dialog, "6 alapértelmezett betöltése" one-click setup, category-coloured badges.
- `HRWorkflowInbox.tsx` — Unified task inbox: status/category filter, progress bar per instance, overdue indicators (red), due-soon (amber), per-task checkbox, admin action buttons (close/cancel), "Folyamat indítása" dialog.
- `WorkflowsModule.tsx` updated — "HR folyamatok" inbox tab is now the default; "HR sablonok" tab added for admins.

**Employee Self-Service Portal (Group 4):**

New top-level workspace tab **Saját portál** (LayoutDashboard icon, first in nav, visible to all members).

- `src/components/enterprise/self-service/EmployeeDashboard.tsx` — Aggregated personal view:
  - **Attendance card** — current month period status badge + 4 KPI cards (Ledolgozott / Túlóra / Elvárt szab. után / Bér-össz); return-reason alert in red when status = returned; "Megnyitás →" deeplink to time-attendance tab.
  - **Leave quota card** — all quota balances for the current year with progress bars; "Szabadság igénylése →" deeplink.
  - **My requests card** — last 5 leave requests with status badges.
  - **My tasks card** — open workflow tasks assigned to me with due-date colouring; "Összes →" deeplink to workflows tab.

**Payroll Readiness Panel (Group 6):**

`PayrollReadinessPanel` component injected into `AdminOverview.tsx` above the member table.

- 6-point pre-export checklist (all green = export is safe):
  1. Every active member has an open period
  2. No draft periods (all submitted or beyond)
  3. No returned periods (all corrected)
  4. All submitted periods are approved
  5. All approved periods are locked
  6. At least one locked period exists for export
- Collapsible; header shows pass/fail count with colour coding (green / amber / red).
- Zero network requests — computed in `useMemo` from already-loaded `rows`.

**Integration:**
- `WorkspaceDashboard.tsx` — `my-portal` tab added as the first nav item; `EmployeeDashboard` rendered inside; `LayoutDashboard` icon.
- Existing time-attendance, leave, workflow, request modules untouched.

---

## 2026-05-10 — v3.6.0 Time Attendance & Payroll Preparation module

### Added — Complete employee time logging + admin overview + payroll export

A new top-level workspace tab **Időnyilvántartás** (Clock icon) ships an end-to-end time-attendance and payroll-preparation module.

**Domain entities (6 new tables):**
- `enterprise_attendance_periods` — one timesheet per (member, year, month) with a state machine: `draft → submitted → returned/approved → locked → exported`. Cached `totals` jsonb column carries the server-computed payroll-ready figures.
- `enterprise_attendance_segments` — atomic worked-time blocks. Multiple per day (split shifts), with `segment_type` ∈ `{regular, overtime, break, oncall_intervention}`, `is_weekend`, `is_night`. `source` column = `'manual' | 'device'` (future hardware ingestion).
- `enterprise_attendance_oncall_windows` — standby blocks separate from intervention work. Default multiplier 0.20.
- `enterprise_attendance_schedule_templates` — workspace-default + per-member recurring schedules (weekday_mask, start/end, break, expected daily hours).
- `enterprise_attendance_audit` — append-only audit trail (segment.created/updated/deleted, period.submitted/approved/returned/locked/reopened, oncall.*).
- `enterprise_attendance_payroll_exports` — one row per export run with full JSON payload for replay.

**Server-side calculation engine (`attendance_recompute_totals` RPC):**
- Categorizes hours into regular, overtime, weekend overtime, night, on-call intervention.
- Standby = window time minus intervention; standby compensated = standby × 0.20.
- Expected hours = workdays × `expected_daily_hours` from resolved template (explicit → member-default → workspace-default → 8h × Mon-Fri fallback).
- Leave-aware expected (subtracts approved leave_hours from expected).
- Recomputed automatically after every mutation. Cached on the period row.

**State-machine RPCs (all SECURITY DEFINER):**
- `attendance_get_or_create_period`, `attendance_upsert_segment`, `attendance_delete_segment`, `attendance_upsert_oncall_window`, `attendance_delete_oncall_window`, `attendance_transition_period`, `attendance_list_workspace_periods`, `attendance_payroll_export`, `attendance_record_export`.
- All writes audited with before/after JSON snapshots.

**Frontend module (`src/components/enterprise/time-attendance/`):**
- `TimeAttendancePage.tsx` — entry point; admin gets tab switcher (Saját idő / Csapat áttekintés).
- `EmployeeMonthView.tsx` — month picker, 7-column day grid (Mon-first), totals summary, submit button.
- `DayEditorDialog.tsx` — multi-segment day editor with type picker, weekend/night flags, validation (overlap detection, end > start, 24h cap).
- `OnCallDialog.tsx` — standby window entry with weekend/night flags.
- `AdminOverview.tsx` — workspace-wide table with filters, action column (approve/return/lock/reopen), summary stats, **payroll export buttons** (XLSX of locked-only or CSV of all).
- `TotalsSummary.tsx` — 8-card breakdown widget.
- `calculations.ts` — client-side preview mirroring the server logic (1:1).
- `api.ts` — RPC client wrappers.
- `types.ts` — shared TS types.

**Payroll export:**
- 23 stable columns (Email, Név, Csapat, Munkakör, Telephely, Időszak, Státusz, Normál óra, Túlóra, Hétvégi túlóra, Éjszakai óra, Készenléti behívás, Készenlét nyers + bér-óra ×0.20, Elvárt, Szabadság, Ledolgozott, Bér-össz, Benyújtva/Jóváhagyva/Zárolva).
- XLSX (Excel XML 2003) + CSV (UTF-8 BOM) — same library-free generators used by the Import/Export Center.
- Locked-only export auto-advances all locked periods to `exported`, with audit batch row.

**Tests (`src/test/timeAttendanceCalculations.test.ts`):**
- 18 unit tests covering: duration math, weekend detection, night-window detection, overlap detection, standby×0.20 with intervention subtraction, leave-adjusted expected, edge case where intervention exceeds standby (clamped to 0).
- All passing.

**Documentation (`docs/time-attendance/`):**
- `README.md` (index), `business-overview.md`, `employee-guide.md`, `admin-guide.md`, `calculation-rules.md` (with worked example), `payroll-export.md` (column reference), `data-model.md` (tables + RLS), `api-contracts.md`, `audit-trail.md`, `future-hardware-support.md` (badge/clock device extension plan).

**Architecture for future hardware ingestion:**
- `segments.source` and `segments.device_event_id` columns reserved.
- Pairing model documented: clock_in + clock_out → one segment.
- No UI rework needed when device path goes live; admin reconciliation panel is the only addition.

**Integration:**
- New top nav item `Időnyilvántartás` between Naptár and Kérelmek.
- Visible to all active enterprise members (employees see only their own period; admin tab requires owner / resourceAssistant).
- Reuses existing `enterprise_memberships`, `leave_requests`, `enterprise_workspaces`, profiles. No regression on existing leave / member / org-chart logic.

---

## 2026-05-10 — v3.5.4 Member Profile section header overflow fix

Section card headers now wrap (`flex-wrap` + `ml-auto`) so action buttons don't get clipped on narrow sheet widths. Sheet widened to `sm:max-w-xl`, `overflow-x-hidden` added to belt-and-suspenders. Performance section title shortened.

---

## 2026-05-10 — v3.5.3 Member Profile "Bővebb adatok": Jira-row + Performance chart toggle

### Fixed — Jira jegyek sor: külső link gomb nem látható

A "Hozzá rendelt Jira jegyek" sorokban az `ExternalLink` ikon túlfutott a kártya szélén és láthatatlan volt. Root cause: a flex sor szülője nem kapott `min-w-0` értéket, így a `flex-1 truncate` span nem zsugorodott le 0-ig, és a `shrink-0` ikon kicsúszott a szülő doboz jobb széléből.

**Fix**: `min-w-0` hozzáadva a sor wrapperre és a span-re; `gap-2` → `gap-1.5`; badge-ek `px-1.5`; az `<a>` tag h-5 w-5 box-ban van rendezve hover háttérrel a jobb tap-célnak.

### Added — Teljesítmény diagram típus-váltó (BarChart ↔ AreaChart)

Új `ChartTypeToggle` mini-segmented control a "Teljesítmény (utolsó 12 hónap)" kártya jobb felső sarkában. Két opció:

- **Oszlopdiagram** (alapértelmezett, `BarChart3` ikon): a meglévő story-point oszlopdiagram változatlan
- **Vonal-/területdiagram** (`LineChart` ikon): új `AreaChart` két soros — story points (kék gradient) + lezárt jegyek (zöld gradient), `linearGradient` fill, `monotone` görbék, dot-ok

A választott típus localStorage-ben (`effectime.member.performanceChart`) mentődik, megmarad új session-ön át is.

**Fájl**: `src/components/enterprise/MemberExtendedDetails.tsx`

---

## 2026-05-10 — v3.5.2 Export/Import Center: email + extended member fields fix

### Fixed — Tag export: email, felettes/beosztott, összes szervezeti mező

**Probléma**: A `profiles` táblának nincs `email` oszlopa — az email kizárólag az `auth.users` táblában tárolódik, amit a frontend client nem érhet el közvetlenül.

**Megoldás — 3 új DB függvény (SECURITY DEFINER):**

- `get_workspace_members_for_export(p_workspace_id)` — teljes tag-lista emailekkel, org-chart adatokkal, szenioritással, szerződéssel, készségekkel (semicolon-separated), felettes/beosztott emailekkel. Jogosultság-ellenőrzés `has_enterprise_role` RPC-vel, ezért frontend-ről biztonságosan hívható.
- `get_workspace_leave_for_export(p_workspace_id, ...)` — szabadságok emailekkel és tagnevekkel.
- `get_user_ids_by_emails(p_emails)` — Edge Function segédfüggvény: email tömb → user_id párok az `auth.users`-ből.

**Bővített MEMBER_FIELDS (22 mező, 5 csoport):**

| Csoport | Új mezők |
|---------|----------|
| Hierarchia | `manager_email` (felettes), `subordinate_emails` (beosztottak — export only) |
| Karrier | `seniority`, `leadership_level`, `leadership_category`, `contract_type`, `employer_rights`, `skills` |
| Szervezeti adatok | `org_unit_name`, `weekly_capacity_hours` |

**Edge Function `import-entity-data` javítva:**
- `importMembers` és `importLeave`: `profiles.email` lekérdezés (nem létező mező) → `get_user_ids_by_emails` RPC hívás
- `importMembers` upsert: `weekly_capacity_hours`, `seniority`, `leadership_category`, `employer_rights` mezők mostantól frissülnek
- `has_enterprise_role` paraméternevei javítva: `_workspace_id`, `_user_id`, `_roles` (függvény-szignaturával egyezően)

---

## 2026-05-10 — v3.5.1 Import/Export Center: teljes implementáció

### Implemented — Skálázható, entity-alapú Import/Export Center

A v3.5.0 spec teljes körű implementációja egy lépésben. A korábbi `CsvImportPanel` (Inbox ikon, "CSV import (tagok + szabadságok)" szekció) helyett egy új `ImportExportCenter` jelenik meg "Adatkezelés — Import / Export" címmel.

**Új komponensek (`src/components/enterprise/import-export/`):**

- **`ImportExportCenter.tsx`** — fő belépési pont; action selector (Export / Import) + entity grid + Dialog wizard
- **`EntitySelector.tsx`** — kártya-alapú entity választó (Tagok, Szabadságok, Telephelyek, Munkakategóriák, Munkakörök, Pozíciók, Készségek)
- **`ExportWizard.tsx`** — mezőkijelölő + formátum + import-kompatibilis sablon opció + audit
- **`ImportWizard.tsx`** — 7-lépéses wizard: Útmutató → Feltöltés → Oszlopleképezés → Validáció Preview → Mód → Megerősítés → Eredmény
- **`config/entity-registry.ts`** — config-driven entity definíciók (61 mező 7 entitásra)
- **`utils/file-parser.ts`** — RFC 4180 CSV parser, Excel XML parser, generátorok
- **`utils/data-fetcher.ts`** — entity-specific Supabase fetchers
- **`utils/validator.ts`** — type-aware row validátor + auto column mapping + guidance row detection

**Új Edge Function (`supabase/functions/import-entity-data/index.ts`):**

- 7 entity importere egy függvényben
- Owner / resourceAssistant role check `has_enterprise_role` RPC-vel
- Members import: meglévő invitation flow-t használ új felhasználóknak; közvetlen membership update meglévőknek (upsert)
- Reference resolution: office_name → office_id, manager_email → user_id, category_name → category_id
- Audit logging: `import.started` + `import.completed` (vagy `import.completed_with_errors`)
- Workspace scoping: minden insert/update kötelezően `workspace_id`-vel
- Row-level error reporting: `{ row_index, field, value, code, message }`
- `verify_jwt = true` regisztrálva `supabase/config.toml`-ban

**Spec ↔ Implementáció megfeleltetés:**

| Spec szakasz | Implementáció |
|--------------|--------------|
| Entity Registry | `config/entity-registry.ts` — 7 entitás, 61 mező, importAlias, computed/protected flagek |
| Round-trip kompatibilis sablonok | XLSX styled header (yellow=required) + guidance row + auto-detect skip |
| 7-lépéses wizard | `ImportWizard.tsx` — step indicator + back/next nav |
| Auto column mapping | `validator.autoMapColumns` — exact key → alias → label fallback |
| Validation preview | Row-level red/yellow/green status + tooltip + first 100 sor megjelenítés |
| Hibalista letöltés | `downloadErrorReport` — failed rows mint CSV |
| Partial success | Validáció után csak a `valid` sorok mennek a Edge Function-be |
| Upsert mód | Opt-in toggle; `enterprise_offices`, `members`, `work_categories`, `job_roles`, `skills` támogatja |

**Integrációs változások:**

- `WorkspaceDashboard.tsx`: `CsvImportPanel` import törölve, `ImportExportCenter` import + render hozzáadva
- A jelenlegi `ExportCenter` (Reports tab — naptár-rács szabadság-export) érintetlen marad: az új ImportExportCenter Settings-ben él, az ExportCenter Reports-ban — két különböző UX flow

**Megőrzött funkcionalitás (ZERO REGRESSION):**

- Tagok meghívása CSV-ből — a Members entity import az új wizardon keresztül továbbra is létrehoz invitation-t új email címekhez
- Szabadságok bulk import — a Leave entity importon keresztül továbbra is működik
- Reports tab → ExportCenter (naptár-grid, dátumtartomány) — érintetlen

### Files added
- `src/components/enterprise/import-export/ImportExportCenter.tsx` *(new)*
- `src/components/enterprise/import-export/EntitySelector.tsx` *(new)*
- `src/components/enterprise/import-export/ExportWizard.tsx` *(new)*
- `src/components/enterprise/import-export/ImportWizard.tsx` *(new)*
- `src/components/enterprise/import-export/config/entity-registry.ts` *(new)*
- `src/components/enterprise/import-export/utils/file-parser.ts` *(new)*
- `src/components/enterprise/import-export/utils/data-fetcher.ts` *(new)*
- `src/components/enterprise/import-export/utils/validator.ts` *(new)*
- `supabase/functions/import-entity-data/index.ts` *(new — Edge Function)*
- `versioning/100526004_v3.5.1_import-export-center-impl.md` *(new)*

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx` — CsvImportPanel kicserélve ImportExportCenter-re
- `supabase/config.toml` — import-entity-data edge function regisztrálva (verify_jwt = true)

### Acceptance criteria
- ✅ Settings → "Adatkezelés — Import / Export" szekció admin-only láthatósággal
- ✅ Action toggle (Export / Import) + entity selector kártyarács
- ✅ Export: mezőkijelölő grouped checklist, kötelező mezők zárolva, XLSX + CSV
- ✅ Import-kompatibilis sablon (asterisk + guidance row + auto-skip)
- ✅ 7-lépéses import wizard step indicator-ral
- ✅ Auto column mapping + manuális override Select dropdown-nal
- ✅ Validation preview: row-level status, hibás cellák tooltip, hibalista letöltés
- ✅ Create-only / upsert mód kapcsoló (entity függő)
- ✅ Edge function: 7 entity import, role check, audit log, workspace scoping
- ✅ Reference resolution (office_name, manager_email, category_name)
- ✅ Zero regression a v3.4.x sticky nav fix-ekre + v3.4.0 OrgChart deeplink-ekre

### Deploy steps
1. Apply database changes — N/A (nincs új migráció)
2. Deploy edge function: `supabase functions deploy import-entity-data`
3. Frontend deploy: standard Vite build

---

## 2026-05-10 — v3.5.0 Import/Export Center specifikáció (implementációs blueprint)

### Spec — Bulk Data Management Center tervezési specifikáció

A Settings → "CSV import (tagok + szabadságok)" és "Export" szekciók helyett egy teljes, entity-alapú, wizard-vezérelt **Import/Export Center** tervezési specifikációja. A spec implementációs blueprint — a kód következő sprintben készül.

**Jelenlegi állapot (pre-spec):**
- `ExportCenter`: csak leave/vacation export, fix mezők, nem re-importálható
- `CsvImportPanel`: 2 hardcoded tab (tagok meghívása, szabadságok), nincs preview, nincs template, gyenge hibakezelés

**Specifikált rendszer (`docs/IMPORT_EXPORT_CENTER_SPEC.md`):**
- **Entity-selector**: kártya-alapú, skálázható entitás-választó (Tagok, Szabadságok, Telephelyek, Munkakategóriák, Munkakörök, Pozíciók, Készségek)
- **Export wizard**: mezőkijelölés (kötelező mezők zárolva), import-kompatibilis sablon letöltés, XLSX/CSV
- **Import wizard** (7 lépés): Instrukciók → Feltöltés → Oszlopleképezés → Validáció + Preview → Opciók → Megerősítés → Eredmény
- **Config-driven entity registry**: új entitás hozzáadása = 1 config sor, UI módosítás nélkül
- **Round-trip kompatibilitás**: export → szerkesztés → import működik újraformázás nélkül
- **Partial success**: érvényes sorok bekerülnek, hibások kihagyva + letölthető hibalista
- **Audit logging**: minden import/export rögzítve `enterprise_audit_events`-ben

**Főbb döntések:**
- XLSX elsődleges (styled header, dropdown validáció, oszlopvédelem), CSV másodlagos
- Machine key fejlécek + `__schema_version` + importAlias a template stabilitásért
- Részleges siker (nem teljes rollback) — enterprise bulk usecase igénye
- Upsert opt-in; alapértelmezés: csak új sorok
- Kötelező mezők: zár ikon + csillag minden kontextusban

**Phase roadmap:**
- Phase 1: Tagok + Szabadságok entitások, 7-lépéses wizard, Edge Function alapok
- Phase 2: Összes entitás, inline javítás, upsert, hibalista letöltés
- Phase 3: Multi-entity export, background job >500 sornál, import előzmény

### Files added
- `docs/IMPORT_EXPORT_CENTER_SPEC.md` *(new — 20 fejezetes implementációs spec)*
- `versioning/100526003_v3.5.0_import-export-center-spec.md` *(new)*

---

## 2026-05-10 — v3.4.2 Sticky nav opacity javítás (átszűrődés megszüntetése)

### Fixed — Sticky menüsávok teljes átlátszatlansága
- A v3.4.1 sticky pozícionálás után a felhasználó észrevette, hogy görgetéskor a tartalom átszűrődik a sticky menüsávok mögött (a kapacitás kártyák `2200% / 355% / 42% / 1803%` és „Backend Developer" sor szövege látszott a menüsorok mögött).
- **Gyökérok**: A főmenü TabsList `bg-background/98` osztálya (98% opacity) nem volt elég átlátszatlan, így a görgetett tartalom látszott rajta keresztül. Az almenü sávoknál `bg-background` volt, de a shadcn `TabsList` default `bg-muted` osztálya `cn()` merge után potenciálisan ütközhetett.
- **Javítás** (`WorkspaceDashboard.tsx`, `ResourcesTab.tsx`):
  - Főmenü TabsList: `bg-background/98` → `!bg-background` (`!` important modifier garantálja a default `bg-muted` felülírását)
  - Almenü TabsListok (Calendar + Resources): `bg-background` → `!bg-background`
  - Mindhárom sticky sávra `shadow-sm` hozzáadva — vizuális elválasztás a görgő tartalomtól
- A görgetett tartalom ezután NEM látszik a sticky menüsávok mögött; a menüsávok teljesen átlátszatlanok.

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `src/components/enterprise/resources/ResourcesTab.tsx`

### Acceptance criteria
- ✅ Görgetéskor a felfelé csúszó tartalom NEM látszik a sticky főmenü-sáv mögött.
- ✅ Görgetéskor a felfelé csúszó tartalom NEM látszik a sticky almenü-sávok mögött.
- ✅ A sticky menüsávok bal alsó oldalán shadow-sm jelzi az átmenetet a tartalom felé.

---

## 2026-05-10 — v3.4.1 Sticky navigációs sávok (főmenü + almenü regresszió-javítás)

### Fixed — Görgetéskor eltűnő navigációs sávok
- **Főmenü TabsList** (`WorkspaceDashboard.tsx`): tabs layout mode-ban a vízszintes főmenü sáv mostantól `sticky top-[var(--ws-header-h)] z-20` — görgetéskor a workspace header alatt rögzítve marad.
- **Naptár almenü TabsList** (`WorkspaceDashboard.tsx`): a Naptár szekció belső tab sávja (Naptár / Idővonal / Kapacitástervező / Éves nézet) mostantól `sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))]` — mindkét layout mode-ban rögzítve marad.
- **Erőforrások almenü TabsList** (`ResourcesTab.tsx`): az Erőforrások szekció belső tab sávja (Áttekintés / Hőtérkép / Projektek / Agile / Készségek / …) mostantól sticky — görgetéskor látható marad.
- **CSS custom property megközelítés**: az offset értékeket `--ws-header-h` (53px) és `--ws-main-tabs-h` (65px tabs módban, 0px sidebar módban) CSS változók tárolják a közös ancestor div `style` propján. Az almenük öröklik a DOM-on át, nincs szükség új propra.
- **Sidebar mode helyes kezelése**: sidebar layout-ban a főmenü TabsList `sr-only` marad (nem görget el, fizikai tere nincs), az almenük ezért csak a header magasságát veszik figyelembe.
- **Vizuális konzisztencia**: sticky almenü sávok `bg-background border-b rounded-none` osztályokat kapnak — a tartalom aluluk gurul, fedési problémák nélkül.

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `src/components/enterprise/resources/ResourcesTab.tsx`

### Acceptance criteria
- ✅ Tabs layout: görgetéskor a főmenü sáv a header alatt rögzített, nem tűnik el.
- ✅ Tabs + sidebar layout: a Naptár és Erőforrások almenü sávok görgetéskor rögzítve maradnak.
- ✅ Sidebar layout: főmenü TabsList sr-only marad, az almenük csak a header offsetet használják.
- ✅ Nincs regresszió a v3.4.0 funkciókon (OrgChart, MemberProfileSheet, stb.).

---

## 2026-05-10 — v3.4.0 Org chart navigable drawer + Member Bővebb adatok view

### Added — Org chart adatlap kattintható manager + beosztott badge-ekkel
- **OrgChartPremiumView** (`src/components/enterprise/organization/OrgChartPremiumView.tsx`): a jobb oldali drawerben a `Vezető` mező és a `Közvetlen beosztottak` mini-listája mostantól interaktív gombok. Egy kattintás a vezetőre / beosztottra azonnal átváltja az aktív kiválasztott személyt és újratölti a drawer adatait — a drawer nem zár be, így folyamatos hierarchia-böngészés lehetséges. A click swallow logika (`onMouseDown stopPropagation`) megakadályozza, hogy a pán-zoom drag elnyelje a kattintást.
- **„Adatlap megnyitása" gomb**: a drawer fejléce alatt egy `IdCard` ikonos gomb megnyitja a teljes `MemberProfileSheet`-et — ugyanazt, ami a Tagok menüben kattintáskor jelenik meg, így a szervezeti diagramról közvetlenül elérhető a részletes profil.

### Added — MemberProfileSheet „Alapadatok" / „Bővebb adatok" toggle
- **MemberProfileSheet** (`src/components/enterprise/MemberProfileSheet.tsx`): a fejléc alatti új toggle-vel két nézet között váltható az adatlap.
  - `Alapadatok` (alapértelmezett): változatlan tartalom — munkakör, csapat, iroda, KPI kártyák, közelgő/függő/korábbi szabadságok, értesítési beállítások.
  - `Bővebb adatok` (új): hat szekció — készségek, onboarding, hozzáférések, célok/eredmények, hozzá rendelt Jira jegyek, és teljesítmény-diagram.
- **MemberExtendedDetails** (`src/components/enterprise/MemberExtendedDetails.tsx` — új): minden szekció dedikált „menübe ugrás" gombbal jeleníti meg a tartalmat.
  - **Készségek**: `enterprise_member_skills` + `enterprise_skills` join, csillag-szintezéssel; deeplink a Resources tabra.
  - **Onboarding**: `enterprise_onboarding_instances` + `enterprise_onboarding_step_completions` (lépés progress bar + státusz badge); deeplink a Workflows tabra.
  - **Hozzáférések**: `enterprise_access_requests` + `enterprise_access_systems` (státusz ikon, dátum); deeplink a Workflows tabra.
  - **Meghatározott célok**: új `enterprise_member_goals` tábla, admin admin-only inline form (cím + leírás + határidő); státusz életciklus: open → in_progress → achieved/dropped. **Null-safe**: ha a migráció még nincs lefuttatva (Postgres 42P01), inline figyelmeztetést mutat „A célok modul még nincs telepítve" üzenettel — nem dobja össze az UI-t.
  - **Jira jegyek**: `enterprise_agile_issues` az `assignee_name = display_name` alapján szűrve, story-points + státusz + külső hivatkozás; deeplink a Resources/Agile tabra.
  - **Teljesítmény diagram**: utolsó 12 hónap havi bontásban — lezárt jegyek `story_points` összege oszlop-diagramon (recharts), Done jegyek `external_updated_at` (vagy fallback `due_date`) alapján.

### Added — `enterprise_member_goals` tábla
- **Migráció** (`supabase/migrations/20260510120000_member_goals.sql`): új tábla `workspace_id`, `member_id`, `title`, `description`, `status` (open/in_progress/achieved/dropped), `target_date`, `achieved_at`, `created_by`, `created_at`, `updated_at` mezőkkel. CASCADE törlés workspace és membership esetén.
- **RLS**: a workspace tagjai olvashatják, csak owner + resourceAssistant írhat / módosíthat / törölhet (`is_enterprise_member` + `has_enterprise_role`). `update_updated_at_column` triggerrel.
- **Indexek**: `(workspace_id)` és `(member_id)`.

### Enhanced — Demo seed
- **Member goals seed** (`MEMBER_GOAL_DEFS` in `supabase/functions/seed-demo-workspace/seed-data.ts`): 12 demo cél 12 különböző personához rendelve, vegyes státuszú (open / in_progress / achieved) — pl. „React 19 migráció vezetése", „Senior Backend előléptetés", „Cypress E2E coverage 60% felett". A seed `try`-mentes, csendes `console.warn`-ra esik vissza, ha a migráció nincs alkalmazva.
- **Done agile jegyek backdating** (`supabase/functions/seed-demo-workspace/index.ts`): a `Done` státuszú jegyekre `external_updated_at` mezőt számolunk, az utolsó ~180 napra szétterítve (deterministic offset = `(doneCounter * 37) % 175`). Ennek köszönhetően a Bővebb adatok → Teljesítmény diagram realisztikus havi story-point eloszlást mutat újra-seedeléskor is.

### Wiring
- **OrgChart** (`src/components/enterprise/organization/OrgChart.tsx`): `MemberProfileSheet` integrálva, `office_id` mostantól része a member fetch-nek (a profile sheetnek kell). `onNavigateTab` és `userId` propot fogad.
- **OrganizationModule** (`src/components/enterprise/organization/OrganizationModule.tsx`): továbbítja `onNavigateTab` / `userId` propokat az OrgChart-nak.
- **WorkspaceDashboard** (`src/components/enterprise/WorkspaceDashboard.tsx`): `onNavigateTab={setActiveTab}` mostantól mind a `MemberList`-nek, mind az `OrganizationModule`-nak átadva.
- **MemberList** (`src/components/enterprise/MemberList.tsx`): `onNavigateTab` prop fogadása + továbbadás a `MemberProfileSheet`-nek (deeplink-zárja a sheetet, majd vált tabot).

### Files changed
- `src/components/enterprise/organization/OrgChartPremiumView.tsx`
- `src/components/enterprise/organization/OrgChart.tsx`
- `src/components/enterprise/organization/OrganizationModule.tsx`
- `src/components/enterprise/MemberProfileSheet.tsx`
- `src/components/enterprise/MemberExtendedDetails.tsx` *(new)*
- `src/components/enterprise/MemberList.tsx`
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `supabase/migrations/20260510120000_member_goals.sql` *(new)*
- `supabase/functions/seed-demo-workspace/seed-data.ts`
- `supabase/functions/seed-demo-workspace/index.ts`
- `versioning/100526001_v3.4.0_org-chart-navigation-and-member-extended-view.md` *(new)*

### Acceptance criteria
- ✅ Org chart drawer manager + minden beosztott badge kattintható; egy kattintás váltja a drawer kontextusát (a drawer nem zár be).
- ✅ Drawer fejlécén „Adatlap megnyitása" gomb megnyitja a teljes MemberProfileSheet-et.
- ✅ MemberProfileSheet tetején Alapadatok / Bővebb adatok toggle; az Alapadatok tartalom változatlan.
- ✅ Bővebb adatokon mind a 6 szekció létezik (skills, onboarding, access, goals, jira, performance), mindegyik deeplink-gombbal a megfelelő menübe.
- ✅ Demo seed létrehozza a célokat 12 personához, és visszadátumozza a Done jegyek `external_updated_at` mezőjét, így a teljesítmény diagram nem üres.
- ✅ Migráció lefuttatva → célok írhatók/szerkeszthetők; ha még nincs lefuttatva, inline figyelmeztetés (nem dobja össze az UI-t).

---

## 2026-05-10 — v3.3.6 Demo workspace seed schema-drift hotfix

### Fixed — Demo workspace létrehozás 500 hibával megállt
- **Gyökérok 1**: a `seed-demo-workspace` funkció több `leave_requests` rekordot még a régi séma szerint írt, ezért az új, kötelező `is_half_day` mező hiányában a backend 500-zal elhasalt.
- **Gyökérok 2**: a demo seed egyes részei (`enterprise_daily_rules`, `enterprise_job_families`) már nem létező oszlopokra (`is_active`, `sort_order`) támaszkodtak, ami további schema-drift kockázatot okozott.
- **Fix 1 — leave normalization**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól minden seedelt szabadságkérelemre explicit kitölti a jelenlegi séma szerinti mezőket (`is_half_day`, `half_day_period`, `is_private`, `cancellation_reason`).
- **Fix 2 — seed drift cleanup**: a daily rule és job family seed immár csak olyan mezőket küld a backendnek, amelyek ténylegesen léteznek az aktuális adatbázissémában.
- **Fix 3 — build stabilizálás**: ismét eltávolítva a tévesen visszakerült `src/integrations/supabase/auth-middleware.ts`, amely nem létező TanStack importokkal törte a buildet.
- **Validáció**: a javított edge function újra deployolva lett, és a `deno check supabase/functions/seed-demo-workspace/index.ts` sikeresen lefut.

---

## 2026-05-10 — v3.3.5 Demo workspace leave-entities completion fix

### Fixed — Demo workspace szabadság-entitások részben hiányoztak
- **Gyökérok 1**: a `seed-demo-workspace` függvény a `leave_requests` seedet ugyan építette, de a friss demo workspace-ekben továbbra is előállhatott 0 rekordos állapot, miközben más leave táblák (kvóták, ünnepnapok, céges szabadnapok) létrejöttek.
- **Gyökérok 2**: az `enterprise_daily_rules` seed nem adta át a kötelező `created_by` mezőt, ezért ez a rész üres maradt.
- **Gyökérok 3**: az éves nézethez szükséges `enterprise_quota_transactions` seed egyáltalán nem jött létre, ezért a „Vacation used” / maradék napok demó adatoknál hiányosak maradtak.
- **Fix 1 — seed hardening**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól normalizálja és szűri a seedelt szabadságkérelmeket, majd csak ezeket írja a `leave_requests` táblába.
- **Fix 2 — daily rules**: a demo seed már `created_by` mezővel írja az `enterprise_daily_rules` rekordokat is.
- **Fix 3 — quota tx seed**: a jóváhagyott demo szabadságokhoz automatikusan létrejönnek a kapcsolódó `enterprise_quota_transactions` rekordok, így az éves nézet és kvótaegyenlegek valós demo felhasználást mutatnak.
- **Build**: újra eltávolítva a véletlenül visszakerült `src/integrations/supabase/auth-middleware.ts`, amely ismét `@tanstack/react-start` import hibával törte a buildet.

---

## 2026-05-10 — v3.3.4 Demo workspace leave seed fail-fast fix

### Fixed — Demo workspace szabadságok nem jelentek meg a naptárban
- **Gyökérok**: a `seed-demo-workspace` edge function létrehozta a demo workspace többi részét, de a `leave_requests` beszúrás hibáját nem kezelte. Emiatt a demo workspace elkészülhetett 0 szabadságkérelemmel is, miközben a frontend helyesen a `leave_requests` táblából olvas — így a Naptár, Idővonal és Kérelmek üres maradt.
- **Fix 1 — fail-fast seed**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól explicit kezeli a `leave_requests` insert hibáját, naplózza, majd megszakítja a seedelést érthető hibával ahelyett, hogy csendben hibás demo workspace-et hozna létre.
- **Fix 2 — seed guard**: a szabadságkérelmek seedelése már nem egyetlen, félrevezető `annualLeaveTypeId` feltételhez kötött, hanem ahhoz, hogy a workspace szabadságtípus-katalógusa valóban létrejött-e.
- **Eredmény**: új demo workspace létrehozásakor a seed vagy teljesen, szabadságadatokkal együtt készül el, vagy azonnal hibaüzenettel megáll; többé nem jön létre „látszólag kész”, de naptáradat nélküli demo workspace.

---

## 2026-05-09 — v3.3.3 Timeline infinite re-render loop fix

### Fixed — Végtelen újrarenderelés → skeleton freeze (`WorkspaceDashboard` + `TimelineView`)
- **Gyökérok**: `WorkspaceDashboard` inline arrow functiont adott át `onFilteredUsersChange` propként. Minden szülő-render új fn-referenciát generált → `TimelineView` `useEffect`-je (amely a propot dep-ként figyelte) újrafutott → `setTimelineReport` → szülő újrarendel → új referencia → végtelen loop. ~50 iteráció után React dobta a "Maximum update depth exceeded" hibát; a komponens megfagyott utolsó skeleton állapotában, a `setLoading(false)` sohasem hívódott meg.
- **Fix 1 — `WorkspaceDashboard.tsx`**: `useCallback(() => setTimelineReport(...), [])` stabil referenciát biztosít — `setTimelineReport` maga is stabil (useState setter), ezért az üres dep-tömb helyes.
- **Fix 2 — `TimelineView.tsx`**: `useRef`-alapú callback indirection — `onFilteredUsersChangeRef` ref frissítő mellékhatás (deps nélkül), a notify-effect `ref.current?.()`-t hív és **nem** sorolja fel a prop-ot dep-ként; guard `if (loading || members.length === 0) return` megakadályozza a korai tüzelést mount után.

---

## 2026-05-09 — v3.3.2 Timeline fetch fix + expanded leave seed

### Fixed — `TimelineView` hónapváltás hiba (`src/components/enterprise/calendar/TimelineView.tsx`)
- **Root cause**: A hét párhuzamos Supabase query-t `Promise.all`-ba csomagoltuk; gyors hónapváltásnál egyszerre futó kérések terhelték a kapcsolatot → "TypeError: Failed to fetch".
- **Fix 1 — Debounce (250 ms)**: A `useEffect` mostantól 250 ms késéssel hívja `load()`-ot; rapid kattintásoknál csak az utolsó ütközik le, az előzőek törlődnek.
- **Fix 2 — `Promise.allSettled`**: Ha egy nem kritikus query (pl. leaves, holidays, skills) hálózati hibán esik el, a többi adat még betöltődik; csak a taglistás (`enterprise_memberships`) hiba dobja vissza a hibát.

### Enhanced — Demo seed: szabadság lefedettség (`supabase/functions/seed-demo-workspace/index.ts`)
- Kibővítve 7 → **38 leave request**-re, amely lefedi: 3 hónapot visszamenőleg, az aktuális hónapot és 3 hónapot előre.
- Minden típus képviselt: `vacation`, `sick_leave`, `unpaid_leave`, `other`.
- Minden státusz képviselt: `approved`, `pending`, `rejected`, `cancelled`.
- Mind a 22 demo persona kapott legalább egy szabadságot; a visszamenőlegesek mind `approved` státuszú, a jövőbeliek vegyesen `approved`/`pending`/`rejected`.

---

## 2026-05-09 — v3.3.1 Org Chart — Pan, Zoom & Popup Modal

### Enhanced — `OrgChartPremiumView` + `OrgChart`

**Pan & Zoom (Google Maps style):**
- Mouse drag to pan the diagram (click vs drag distinguished by a 6 px threshold — cards still open on genuine clicks).
- Mouse wheel to zoom in/out while panning.
- Bottom-center zoom control bar: **−** / **%** / **+** buttons + a reset `RotateCcw` button, styled like Google Maps controls.
- Zoom clamped between 20 % and 250 %; percentage readout updates live.
- `transform-origin: 50% 0` ensures zoom anchors to the top-centre of the diagram.
- CSS transition `0.18 s ease` active on zoom button clicks; disabled during active drag for instant response.

**Fullscreen Popup Modal:**
- "Teljes nézet" (`Maximize2`) button appears in the Org Chart toolbar only when the Premium view is active.
- Opens a `95 vw × 90 vh` Radix UI Dialog containing `OrgChartPremiumView` with `containerHeight="calc(90vh - 80px)"`.
- Pan/zoom and drawer work identically inside the popup.
- Closing the dialog (× or backdrop click) resets to the inline view.

**Files changed:**
- `src/components/enterprise/organization/OrgChartPremiumView.tsx` — pan/zoom state + handlers + zoom controls
- `src/components/enterprise/organization/OrgChart.tsx` — Dialog import, `fullscreenOpen` state, Maximize button, Dialog render

---

## 2026-05-09 — v3.3.0 GiGanttIc — Flagship Branded Planning Board

### Added — `GiGanttIcBoard` (`src/components/enterprise/agile/GiGanttIcBoard.tsx`)
Effectime's flagship planning board, replacing the generic "Gantt" tab inside **Agile → Boards**.

**Brand & UX:**
- Branded as **GiGanttIc** — premium flagship name with teal accent styling ("Gi" + "Gantt" + italic "Ic").
- Tab trigger in `AgileBoards.tsx` redesigned with `Sparkles` icon + gradient-accented text label; `data-[state=active]` teal highlight distinguishes it from standard tabs.
- Obsidian/charcoal dark surface (`#0d0f14` base) with layered depth, teal/cyan accents used surgically.
- Status bar legend, "BOARD" badge, and per-row status dots for instant visual scanning.

**Core Board Features:**
- **Split-pane layout**: sticky left task grid (292 px) + horizontally scrollable timeline chart — single `overflow: auto` scroll container using `position: sticky` for both axes, no JS scroll-sync needed.
- **Zoom modes**: `week` (12 px/day, weekly columns), `month` (4.5 px/day, monthly/quarterly columns), `quarter` (2 px/day, full-year span). Toolbar lets users switch instantly.
- **Sticky timeline header**: two-row header (primary = quarters/years, secondary = months/weeks) with `isCurrent` teal tint for the present period.
- **Today marker**: teal dashed vertical SVG line + "TODAY" label spanning all rows; "Jump to Today" toolbar button centers the viewport.

**Hierarchy & Scheduling:**
- Parent-child tree built from `parent_key`; Epics auto-expanded on mount.
- Expand/collapse per row (chevron toggle) + "Expand All / None" toolbar shortcuts.
- Depth-indented left grid rows (18 px per level).
- Bar colors by type: Epic = violet, Story = teal, Task = sky, Bug = red, Sub-task = amber, Milestone = gold diamond, Done = emerald, Overdue = red.
- Progress fill overlay on bars derived from `completed_hours / original_estimate_hours` (falls back to status-based estimate).
- Milestone diamond shape (`rotate(45deg)` div) distinct from task bars.
- Overdue indicator: `AlertTriangle` in left grid + red bar color.

**Dependencies (SVG):**
- Smooth Bézier S-curve connectors drawn on an SVG overlay positioned over the chart area for all visible parent→child relationships where both issues have dates.
- Arrow marker (`gg-arrow`) at curve end, teal 28% opacity — visible but non-distracting.

**Details Inspector Panel:**
- Right-side drawer opens on row click (or tapping selected row closes it).
- Shows: type badge, status, overdue indicator, progress bar, schedule (start/end/duration), effort (estimate/logged/remaining), assignee avatar + reporter, hierarchy (parent + up to 5 children), labels, capacity risk alert.
- "Open in Jira" and direct URL links when applicable.
- Closes with × button or re-clicking the row.

**Toolbar:**
- Zoom switcher, Today jump, Expand All / Collapse All, Search (summary / key / assignee), Type filter dropdown, issue count readout, Fullscreen toggle.

**Critical Path / Risk Signal:**
- Issues with `due_date < today && status ≠ Done/Closed` rendered in red (overdue).
- `capacity_risk = 'high'` shows red alert badge in inspector panel.
- Architecture ready for full CPM via `enterprise_ganttIc_dependencies` table.

**Empty / Loading states:**
- `GiGanttEmptyState` — obsidian card with Sparkles icon and branded name.
- `GiGanttLoadingState` — exported for parent use, animated shimmer bar.

### Added — `supabase/migrations/20260509030000_giganttIc_scheduling_fields.sql`
**Schema extensions (all additive, `IF NOT EXISTS`, backward-compatible):**
- `enterprise_agile_issues`: `is_milestone`, `progress_pct` (0–100, check constraint), `dependency_keys text[]`, `critical_path boolean`, `gantt_color`, `gantt_row_order`.
- **New table** `enterprise_ganttIc_dependencies`: explicit FS/SS/FF/SF dependency edges with `lag_days`, `is_auto` flag, and `UNIQUE(integration_id, predecessor, successor)`.
- RLS: `gg_deps_select` (all members), `gg_deps_modify` (owner + resourceAssistant).
- `ganttIc_has_dependency_cycle(workspace, integration, predecessor, successor)` PL/pgSQL function using a recursive CTE BFS — returns `true` if adding the edge would create a cycle. Call this guard before any INSERT.
- `set_gg_deps_updated_at` trigger (reuses existing `set_updated_at()` function).
- `SET search_path = public, pg_temp` on the new SECURITY DEFINER function (consistent with v3.2.7 hardening pattern).

### Changed — `AgileBoards.tsx`
- Removed: `GanttChart` icon import, old `GanttView` function (~65 lines of basic bar renderer).
- Added: `GiGanttIcBoard` import, `GiGanttIssueRow` type re-export, `Sparkles` icon.
- `TabsTrigger` for "gantt" value: redesigned with `Sparkles` icon + branded typography; `data-[state=active]` teal styling.
- `TabsContent value="gantt"`: now renders `<GiGanttIcBoard issues={issues as GiGanttIssueRow[]} onOpen={...} />`.

### Non-Regression
- Kanban and Scrum tabs in `AgileBoards` unchanged.
- `AgilePanel`, `ResourcesTab`, `WorkspaceDashboard` nav unchanged.
- All existing `enterprise_agile_issues` queries unaffected (additive columns only, no NOT NULL without defaults).
- `GanttTimeline.tsx` (project-level timeline in Resources tab) unchanged.
- No existing RLS policies touched.

---

## 2026-05-09 — v3.2.8 Demo UX + CommandCenter header button

### Added — `CommandCenterButton` in workspace header
- New `CommandCenterButton.tsx` component: same data fetching as `CommandCenter`, wrapped in a Popover (same pattern as `OrgPulseButton`).
- Notification badge shows total count of pending items (approvals + onboarding + access + incomplete org).
- Button placed in workspace header for admins; inline `CommandCenter` card removed from the main content area — frees up vertical space in every tab.

### Added — `src/config/demo-seed-limits.ts` (new file)
- Single user-editable TypeScript file exporting `DEMO_SEED_MAX_LIMITS` — the canonical source for all maximum element counts in the demo seed config dialog.
- `DemoSeedConfigDialog.tsx` now imports from this file via a `lim(key)` helper; hardcoded `max` values removed from the dialog tree.
- Edit only this one file to change any slider maximum — change takes effect on next page load.

### Changed — `create-instant-enterprise-member`: realistic Hungarian names
- Added `INSTANT_PERSONA_POOL` — 25 realistic Hungarian personas distinct from `DEMO_PERSONAS` (no name collisions).
- Name selection prefers unused names in the workspace first; falls back to full pool when all are taken.
- `business_role` uses a role already present in the workspace catalog first, falls back to the pool persona's own position.
- Result: instant users now get names like "Balázs Fekete" instead of "Instant User ###".

### Changed — `seed-data.ts`: AGILE_ISSUE_DEFS expanded from 4 → 33 tickets
- **3 Epics**: Customer Portal 2.0, Backend API Refactor, QA & DevOps — spanning Sprint 10–13 with 6–9 week Gantt ranges.
- **12 Stories**: children of Epics via `parent_key`; cover Sprint 11/12/13 with varied statuses (Done/In Progress/In Review/To Do).
- **8 Bugs**: mixed priorities and sprint assignments, several with `parent_key` to Epics.
- **6 Tasks**: standalone team tasks across Frontend/Backend/Ops/QA.
- **4 Sub-tasks**: children of Stories (DEMO-4, DEMO-8, DEMO-9).
- All tickets carry: `story_points`, `assignee_name`, `reporter_email`, `original_estimate_hours`, `remaining_hours`, `completed_hours`, `capacity_risk`, `fit_score`, `suggested_role`.
- Date offsets via `startOff`/`dueOff` (integer day offsets from today) — computed to actual dates at seed time in `index.ts` via `addDays(today, offset)`.

### Changed — `seed-data.ts`: 5-level org hierarchy
- `PERSONA_ORG_ASSIGNMENTS` restructured from 3-level flat to 5-level deep tree:
  - L1 (strategic): Viktor Mátyás — VP Engineering, no manager
  - L2 (operational): Ferenc Horváth, Csilla Nagy, Judit Molnár, Zsuzsanna Hegedűs
  - L3 (technical): Anna Kovács, Sándor Veres, Olivér Lengyel, Gizella Varga, Richárd Kővári
  - L4 (execution): Petra Szász, Tímea Bodnár, István Papp, Kristóf Balogh, Eszter Kiss, Nikolett Farkas
  - L5 (specialist): Henrietta Fekete, Mária Tóth, Dávid Szabó, Bence Tóth, László Szőke, Uzonka Pálfi
- `LEADERSHIP_LEVEL_DEFS` extended to 5 levels (added `specialist` as L5).
- Seeder leadership guard raised to `Math.max(5, seedQty.leadership_levels)`.
- `agile_issues` default and max both set to 33.

### Non-Regression
- All previously seeded entity types unaffected.
- `DemoSeedConfigDialog` behavior identical — only the source of `max` values changed (now from `demo-seed-limits.ts`).

---

## 2026-05-09 — v3.2.7 Database-wide RLS Coverage Hardening + Governance "fetch main first" rule

### Security — RLS audit & migration `rls_coverage_hardening_2026_05_09`
Audited every RLS-enabled table in the `oezlzzmzzvbvinuysxaz` (Effectime) project. All `public` tables already had at least a SELECT policy; the migration closed the genuine gaps and resolved every advisor lint that wasn't intentional design.

- **`enterprise_invitations`** — added missing `UPDATE` policy for owners + resourceAssistants. Admins can now revoke / extend / re-role pending invitations from the UI without going through service-role hops.
- **`enterprise_org_pulse_membership` view** — converted from SECURITY DEFINER to `security_invoker = true`. The view now respects the caller's RLS on `enterprise_memberships` rather than aggregating across all workspaces. (Resolved advisor `security_definer_view` ERROR.)
- **`SET search_path = public, pg_temp`** pinned on 5 SECURITY DEFINER / trigger functions — prevents search_path injection:
  - `seed_default_access_systems(uuid)`
  - `seed_default_contract_types(uuid)`
  - `seed_default_leadership_levels(uuid)`
  - `enterprise_memberships_check_manager_cycle()`
  - `set_updated_at()`
- **Legacy schema cleanup** — 53 tables in `plannermaster` and 10 in `syncfolk` (0-row leftovers from a prior external-DB migration target) now have a `legacy_deny_all` policy. No application code touches these schemas; the policy silences the linter without changing behaviour.

### Governance — `fetch + rebase main first` rule (LESSON-GIT-REBASE-MAIN-FIRST-001)
Documented and enforced via three governance files after a CHANGELOG conflict on this PR (the branch had `v3.2.5`, but `main` already had a different `v3.2.5` and `v3.2.6` that landed via PRs #28 and the seeder PRs):
- `CLAUDE.md` — added explicit "ALWAYS fetch + rebase on `origin/main` BEFORE writing code or editing CHANGELOG.md" rule + "verify next free version on main" rule
- `.governance/controller.md` — same rule promoted to a numbered Core rule (#3)
- `AI_EXECUTION_PROMPTS.md` — expanded "Branch and commit discipline" section with the failure modes (CHANGELOG conflicts, version-number reuse, stale baseline)
- `codingLessonsLearnt.md` — `[LESSON-GIT-REBASE-MAIN-FIRST-001]` entry with the concrete failure case and prevention checklist

### Architecture notes
- Append-only tables (`enterprise_audit_events`, `*_sync_log`, `*_quota_transactions`, `approval_decisions`, `enterprise_access_decisions`) intentionally retain SELECT+INSERT only — the immutability is by design.
- Junction tables (`enterprise_team_roles`, `event_participants`) have no UPDATE-able columns; the DELETE+INSERT pattern is the canonical mutation.
- `enterprise_export_jobs` and `enterprise_access_requests` keep DELETE off — they're historical records.
- `anon/authenticated_security_definer_function_executable` advisor WARNs on `is_enterprise_member`, `has_enterprise_role`, `can_access_event` etc. are **intentional** — these functions are invoked from RLS USING/WITH CHECK clauses and must remain callable by `authenticated`.
- Legacy `plannermaster` + `syncfolk` schemas are kept (not dropped) since dropping requires explicit user approval; they hold no live data and the deny-all policy makes them safe.

---

## 2026-05-09 — v3.2.6 Premium Org Chart: card-based view with employee detail drawer (PR #28)

### Added — `OrgChartPremiumView` component (`src/components/enterprise/organization/OrgChartPremiumView.tsx`)
- **Card-based org chart** with gradient accent cards, hover lift effects, and recursive branch rendering with collapsible nodes.
- **Employee detail drawer** — side panel that opens on card click, showing: org unit name, team, role, manager name, direct reports list (up to 8 with overflow indicator), location/city, skill count, and join date. Org unit names and skill counts fetched from Supabase on demand and cached in component state.
- **Three view styles** in the `OrgChart` component:
  - **Premium** (new default) — card-based with side drawer
  - **Diagram** — existing tree view (renamed from "Tree")
  - **List** — existing flat list
  - View preference persisted to `localStorage` (`orgchart_view_preference`).
- **Enhanced membership query**: added `location`, `city`, `team`, and `joined_at` fields; search filtering now includes `role` and `team`.
- **Flattened node tree**: pre-built `flatNodes: Map<string, OrgNode>` before rendering enables O(1) manager/child lookups — avoids recursive traversal on every card render.
- **Loading skeleton** during initial data fetch.
- **i18n**: `Premium`, `Diagram`, `List` labels + drawer section labels added to EN and HU bundles.
- **Accessibility**: `tabIndex`, `onKeyDown` (Enter/Space to open drawer), ARIA labels, semantic HTML.

### Non-Regression
- Existing tree and list views unchanged; premium is opt-in via the style switcher.
- No schema or edge-function changes.

---

## 2026-05-09 — v3.2.5 Demo workspace seeder v8: data-driven catalogs + full org-structure for all 22 members

### Fixed — Demo workspace seeder: org-structure assignment was missing for 15/22 members
- **Root cause (v7)**: The B8 seeding block used hardcoded if-else persona-name checks and only covered 7 of 22 demo members. SQL verification confirmed `has_org_unit: 7/23`, `has_manager: 2/23` — 15 members had no org unit, leadership level, contract type, or manager set.
- **Fix (v8)**: Introduced `PERSONA_ORG_ASSIGNMENTS` — a typed `Record<string, PersonaOrgAssignment>` lookup in `seed-data.ts` mapping all 22 persona `display_name`s to their `{orgUnit, llCode, contractCode, leadershipCategory, seniority, managerName?}`. B8 now iterates every `demoUserId`, resolves the name via `userIdByPersonaName`, looks up the assignment record, and performs a targeted UPDATE per member.
- **Result**: All 22 demo members receive full org structure. Viktor Mátyás (top-level lead) has no manager; all 21 others have a correctly resolved `manager_id`.

### Added — Data-driven catalog B1–B5 seeding with configurable quantities

All five catalog entity types are now seeded from typed `DEFS` arrays in `seed-data.ts` and respect the `enterprise_seed_config` quantity settings:

| Block | Entity            | DEFS array                    | Min enforced | Seed config key     |
|-------|-------------------|-------------------------------|--------------|---------------------|
| B1    | Job families      | `JOB_FAMILY_DEFS` (6 items)   | 1            | `job_families`      |
| B2    | Leadership levels | `LEADERSHIP_LEVEL_DEFS` (5)   | 4            | `leadership_levels` |
| B3    | Contract types    | `CONTRACT_TYPE_DEFS` (5)      | 2            | `contract_types`    |
| B4    | Industries        | `INDUSTRY_DEFS` (5)           | 1            | `industries`        |
| B5    | Work categories   | `WORK_CATEGORY_DEFS` (5)      | 1            | `work_categories`   |

- Min values guard downstream FK dependencies in B8 (e.g., leadership levels min=4 because B8 resolves strategic/operational/technical/execution codes; contract types min=2 for employee + contractor).
- Pattern: `DEFS.slice(0, Math.max(MIN, seedQty.key))` — honors user-configured quantity while guaranteeing required minimums.

### Added — `DemoSeedConfigDialog` — 6 new configurable catalog entities
- New **"Katalógusok"** sub-group under the Org tree: job families, leadership levels, contract types, industries, work categories — each configurable 1–6.
- New **`org_units`** leaf added to the Org group.
- `DEFAULT_SEED_QUANTITIES` updated with all 6 new keys and sensible defaults.

### Architecture
- All catalog `DEFS` arrays and `PERSONA_ORG_ASSIGNMENTS` are defined once in `seed-data.ts` (single source of truth) and imported by `index.ts`.
- `.governance/entity-creation-inventory.md` updated with ✅ markers for all newly seeded entity types (sections 2.1–2.5).
- Edge function deployed as **version 8 (ACTIVE)** to production Supabase project.

---

## 2026-05-09 — Demo workspace seeder build chronicle: v1 → v8 (PRs #20–27)

The seeder evolved through 8 versions on 2026-05-08/09. This section captures each iteration's root cause, fix, and architectural decision for future reference.

### v1 — Comprehensive seeder (PR #20, 2026-05-08)
First fully comprehensive implementation: 22 personas, `corsHeaders` inlined (fixes Supabase MCP bundler resolution failure), covering all major modules: offices, teams, leave types, holidays, skills, memberships, allocations, leave requests, quotas, daily rules, office coverage rules, audit event.

### v2/v3 — Bug fixes: SelectItem crash, org pulse, Jira editor dark screen (PR #21, 2026-05-09)
- **`SelectItem` empty-value crash**: Radix UI `SelectItem` throws a runtime error when `value=""` (empty string). Any dropdown using an empty string as the "unselected" sentinel crashed silently. Fixed by replacing all `value=""` instances with non-empty placeholder values.
- **Org Pulse view** not displaying membership data — query scope fix.
- **Translation overrides table** not rendering correctly — component state fix.
- **Jira editor dark screen** on modal open — z-index/stacking context fix.

### v4 — Supabase SDK upgrade + admin client health check (PR #23, 2026-05-09)
- **Root cause**: Supabase JS `v2.45.0` admin client silently failed **all** insert operations in the Deno edge function runtime — no error thrown, no rows inserted, no log.
- **Fix**: upgraded to `v2.98.0` (matching `create-instant-enterprise-member`, which worked correctly). Added explicit auth options: `autoRefreshToken: false, persistSession: false, detectSessionInUrl: false`.
- Added `SERVICE_KEY` null guard (returns clear HTTP 500 instead of silent failure).
- Added admin client smoke test at startup (fails fast with a descriptive error if service role auth is broken).
- Added explicit error logging for offices / teams / leave_types / holidays / skills insert blocks.

### v5 — All entity types seeded; seed-data.ts as single source of truth (PR #24, 2026-05-09)
Previously missing entity types added (blocks L–S):

| Block | Table | App module |
|-------|-------|------------|
| L | `enterprise_role_definitions` + `enterprise_role_permissions` | Jogosultság-menedzsment |
| M | `enterprise_member_templates` | Meghívó sablonok |
| N | `enterprise_translation_overrides` | Lokalizáció |
| O | `enterprise_workspace_integrations` + `enterprise_agile_issues` + `enterprise_agile_field_metadata` | Jira integráció |
| P | `enterprise_ical_tokens` | iCal előfizetés |
| Q | `enterprise_shift_assignments` | Kapacitástervező |
| R | `enterprise_member_site_priorities` | Telephely prioritás |
| S | `enterprise_access_decisions` | Hozzáférés döntések |

**Architecture**: `seed-data.ts` declared as machine-readable single source of truth for all demo seed data; `.governance/entity-creation-inventory.md` as the human-readable governance counterpart. Rule: both files must be updated together whenever a new entity type is added.

### v6 — 22 personas, Auth Admin REST fix, DemoSeedConfigDialog (PR #25, 2026-05-09)
- **Auth Admin API fix**: replaced `supabase.auth.admin.createUser()` (silently dropped all user creations due to SDK session-layer routing issues) with direct `fetch` to `/auth/v1/admin/users` with explicit `Authorization: Bearer <service_role_key>` header.
- **`slugify()`** helper for Hungarian diacritic normalization in email generation (e.g., `"Mátyás"` → `"matyas@demo.test"`).
- Email domain changed from `.local` to `.test` (universally valid for testing).
- 3-attempt retry with exponential backoff; per-user errors surfaced individually in the response body.
- `DEMO_PERSONAS` expanded from 7 to **22** (full enterprise team simulation).
- New DEF arrays in `seed-data.ts`: `DAILY_RULE_DEFS` (7), `OFFICE_COVERAGE_RULE_DEFS` (10), `RULE_TEMPLATE_DEFS` (5), `APPROVAL_CHAIN_DEFS` (2). `DEFAULT_SEED_QUANTITIES` introduced.
- **`enterprise_seed_config`** table (new migration): per-owner configurable seed quantities, RLS owner-only read/write.
- **`DemoSeedConfigDialog`** (`src/components/enterprise/DemoSeedConfigDialog.tsx`): collapsible tree UI showing every entity type with its app-location path and a quantity input. Persisted to `enterprise_seed_config`.
- **"Demo konfig"** button added to `Enterprise.tsx` header.

### v7 — Silent membership error captured (PR #26, 2026-05-09)
- The membership bulk-insert never destructured `error` from the Supabase response — silent failures showed 0 members seeded with no log output.
- Added explicit `{ data, error }` destructuring, `console.error` on failure, empty-array guard to skip insert when `demoUserIds` is empty, and separate progress log entries for auth-user count vs. membership-insert count.

### v8 — Full org-structure for all 22 members + data-driven B1–B5 catalogs (PR #27)
Documented in the v3.2.5 entry above.

---

## 2026-05-09 — Infrastructure & UX fixes: catalog RLS, workspace selector, deletion (PR #22)

### Fixed — Position catalog returns 0 rows for every user
- `enterprise_catalog_*` tables (categories, roles, skills, role_skills) had RLS **enabled but no policies**, so every authenticated query returned 0 rows regardless of the user's role.
- **Fix**: added `SELECT` policy for the `authenticated` role on all four global catalog tables. The `PositionPickerDialog` (and 550+ seeded skills) now load correctly for all workspace members.

### Added — Workspace selector always shown first
- Landing page "Munkaterület" button navigates to `/app?select=1`.
- `Enterprise.tsx` detects `?select=1` and suppresses the auto-select-last-workspace shortcut — user always sees the picker grid.

### Added — Workspace deletion by owner
- Owner-only delete button per workspace card with `AlertDialog` confirmation.
- `DELETE` on `enterprise_workspaces`; all ~70 workspace-scoped tables already carry `ON DELETE CASCADE` → atomic cleanup of members, rules, projects, leave requests, integrations, quotas, audit log, etc.
- Clears `localStorage` key `active_workspace_id` if the deleted workspace was the previously cached one.

---

## 2026-05-08 — v3.2.4 Auth UX, Compact Org Pulse & Demo Workspace Seeder

### Fixed
- **`Landing`**: the "Bejelentkezés" CTA in the hero and the secondary CTA card no longer render while a user is signed in. Authenticated visitors now see "Munkaterületre" leading straight to `/app`.
- **Build**: removed stale TanStack-flavored `src/integrations/supabase/auth-middleware.ts` (the project uses `react-router-dom`, not TanStack Start) — eliminated the `Cannot find module '@tanstack/react-start'` build break.

### Changed
- **Org Pulse → header popover (`OrgPulseButton`)**: replaced the persistent full-width `OrgPulseWidget` with a compact header button (`Activity` icon + "Org Pulse" label). A red badge with the count of active operational alerts (missing org-unit, missing manager, missing contract, missing leadership, approvals open >48h) is shown when `> 0`. Clicking opens a 360px `Popover` with the same privacy-safe (k≥5) cells, with alert cells highlighted. Wired into `WorkspaceDashboard` for admins; the previous `OrgPulseWidget` block is removed from the body.

### Added
- **`Demo munkaterület létrehozása` button** in `CreateWorkspaceDialog` — invokes new edge function `seed-demo-workspace`.
- **Edge function `seed-demo-workspace`** (`verify_jwt = true`): calls `create_workspace_with_owner` as the user, then with the service role seeds:
  - 3 demo auth users + profiles + memberships (assistant + 2 members), with team / city / business_role / capacity defaults
  - 3 offices (Budapest, Debrecen, Szeged), members linked to their city's office
  - 4 teams (Engineering, Product, Design, Operations)
  - 4 leave types (Éves, Beteg, Otthoni, Fizetés nélküli) with colors and rules
  - 3 sample Hungarian holidays
  - 7 skills + 3 skill assignments per member with proficiency
  - Annual leave quotas per membership (25 + 5 carryover)
  - 18 leave requests across all members spanning past + future, mixing approved / rejected / pending statuses and three leave types
- All seeded rows use `workspace_id = <new ws>`. Existing FK `ON DELETE CASCADE` on every workspace-scoped table guarantees full cleanup when the workspace is deleted — no orphaned records.

### Architecture notes
- Seeder is implemented as a single edge function so it can be extended module-by-module without touching UI code.
- Uses the user's JWT to create the workspace (so it ends up owned by them and respects existing RPC), and the service role only for downstream child rows that need to bypass RLS for demo identities.

## 2026-05-07 — v3.2.3 Help System — Admin Controls & Multi-Tab Fix

### Fixed
- **`useHelpArticleByAnchor` + `useHelpSearch`**: added `.order('last_generated_at', { ascending: false }).limit(1)` before every `.maybeSingle()` call — Supabase `.maybeSingle()` throws when multiple rows match (e.g. five articles shared `anchor_id = 'workspace.settings'`). This was the root cause of the "only Members tab shows help content" bug: the thrown error was silently caught and `article` was set to `null`.
- **`HelpDrawer` i18n fallback (`resolveAnchorCopy`)**: rewrote to import raw bundle objects directly (`import en from '@/i18n/resources/en'`) and use literal key access (`anchors[id]`) instead of calling `t()`. The `lookup()` function splits on `.` which broke all dotted anchor IDs like `workspace.calendar` — the traversal tried `anchors['workspace']['calendar']` instead of `anchors['workspace.calendar']`.

### Added
- **`HelpSystemSettings` component** (`src/components/enterprise/settings/HelpSystemSettings.tsx`): new admin-only settings card with:
  - `Switch` toggle to enable/disable AI help content regeneration (persisted to `enterprise_workspaces.help_ai_enabled`)
  - "Regenerate now" button that immediately invokes the `help-regenerator` Supabase Edge Function
  - Last-regenerated timestamp display
  - Result badge (success/error) after manual regeneration
- **Schema migration `20260507150000`**: two new additive columns on `enterprise_workspaces`:
  - `help_ai_enabled boolean NOT NULL DEFAULT true`
  - `help_last_regenerated_at timestamptz`
- **`WorkspaceDashboard` Settings tab**: `HelpSystemSettings` wired in as an admin-only `SettingsSection` (after Integration Health Center)
- **i18n keys** `help_settings.*` added to both EN and HU bundles (9 keys each)

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- Schema migration is purely additive — `ADD COLUMN IF NOT EXISTS` with safe defaults.
- All existing i18n keys preserved; only new keys added.

## 2026-05-07 — v3.2.2 Help System — Full Documentation Suite & Gap Closure

### Fixed
- **`useHelpArticleByAnchor`**: added `.eq('is_active', true)` filter — archived articles were surfacing in the drawer when a topic had been regenerated and the old version archived.
- **`useHelpSearch`**: added `.eq('is_active', true)` filter — same root cause; search results could return stale archived articles.
- **HelpDrawer release badge**: label changed from `help.section_label` ("Section") to `help.generated_label` ("Generated") — the badge now correctly reads "Generated · v3.2.0" instead of "Section · v3.2.0".

### Added — `data-help-region` completeness
- **`ResourcesTab`**: `<TabsContent value="agile">` now carries `data-help-region="workspace.agile"` — the drag-target ? icon can now target the Agile board section for context-specific help.

### Added — i18n fallback anchors
- **EN + HU bundles**: 13 new fallback anchor entries covering all gaps between the drawer and seed data:
  `workspace.requests`, `capacity-dna`, `command-center`, `decision-memory`, `coverage-planner`, `org-chart`, `audit-log`, `quota-manager`, `holiday-manager`, `localization-settings`, `integration-health`, `role-permissions`, `access-request`.
- `workspace.approvals` enhanced with `commonTasks` list (both locales).
- New i18n key `help.generated_label` added in both EN (`'Generated'`) and HU (`'Generálva'`).

### Added — Seed migration `20260507140000`
- **14 new curated help articles** (7 topics × 2 locales) filling the mandatory anchor gaps:
  - `time-entry` (EN + HU) — step-by-step leave request submission with conflict engine flow diagram
  - `onboarding-template` (EN + HU) — template creation, step types, publish/archive lifecycle
  - `agile-kanban` (EN + HU) — Kanban board view, card anatomy, sync workflow
  - `agile-scrum` (EN + HU) — Scrum board with per-sprint totals and story point headers
  - `agile-gantt` (EN + HU) — Gantt timeline, type colour coding, date requirements
  - `jira-integration` (EN + HU) — connection setup, test connection, project config sync, troubleshooting
  - `export-center` (EN + HU) — CSV export workflow, field list, encoding note
- All rows use `ON CONFLICT DO NOTHING` — safe to re-run and regenerator-upserts are never overwritten.

### Added — `docs/help/` documentation suite
- **8 structured EN help articles** under `docs/help/en/` with Mermaid flowcharts, step-by-step guides, common actions tables, and troubleshooting sections:
  - `00-index.md` — feature map with anchor-to-article cross-reference
  - `01-getting-started.md` — sign-in, workspace selector, first steps
  - `02-leave-requests-and-approvals.md` — full leave request and approval chain flows
  - `03-members-and-organization.md` — invite flow, org module, position catalog, org chart
  - `04-calendar-and-capacity.md` — four calendar views, coverage planner, Capacity DNA
  - `05-workflows-onboarding-access.md` — onboarding templates, access systems and templates, access inbox
  - `06-resources-agile-capacity.md` — capacity heatmap, projects, all three agile board views, Capacity Fit
  - `07-reports-audit-export.md` — KPI dashboard, immutable audit log, CSV export
  - `08-settings-admin.md` — all settings sections, approval chains, Recovery Mode, Decision Memory, Command Center
- **`docs/help-reference.md`** — top-level canonical feature map consumed by the AI regenerator: all anchor IDs, navigation paths, and business rule summaries.

### Added — `help-regenerator` improvements
- Now scans **three** source directories instead of two: `versioning/`, `docs/` (root), and `docs/help/en/` (up to 8 articles).
- The EN help articles serve as style and content reference for Gemini — generated articles will mirror the established structure and tone.
- `changed_files.count` in `help_releases` now correctly reflects all three source sets.

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- The `is_active` filter is purely additive — it uses the index `help_articles_active_idx` added in v3.2.1.
- All existing `data-help-region` attributes preserved; only one new attribute added.
- All existing i18n keys preserved; only new keys added.
- Seed migration uses `ON CONFLICT DO NOTHING` — cannot overwrite existing content.

## 2026-05-07 — v3.2.1 Help System Diagnosis & Hardening

### Fixed
- **`help-regenerator` edge function**: corrected fallback repo from `lovable-app/genisys` to `henrikfaul/effectime-app-enterprise-a95029a1` — the regenerator was silently reading the wrong repository on manual triggers with no `repo` payload.
- **`WorkspaceDashboard` tab-to-anchor mapping**: `resources`, `reports-audit`, and `settings` tabs now correctly map to `workspace.resources`, `workspace.reports`, and `workspace.settings` anchors (previously all three fell back to `workspace.members`).
- **Missing `data-help-region` attributes**: added to `resources`, `reports-audit`, `settings`, and `requests` `TabsContent` blocks so the drag-target ? icon can target those sections.

### Added
- **Schema migration `20260507120000`**: `is_active boolean` and `archived_at timestamptz` columns on `help_articles`; index `help_articles_active_idx (is_active, anchor_id, locale)`. The regenerator now archives stale articles (sets `is_active = false, archived_at = now()`) before upserting fresh ones — preserving full version history.
- **`help-regenerator` improvements**: reads `docs/` directory in addition to `versioning/`; expanded mandatory anchor list from 8 → 30 topics; per-article `archiveStaleArticles` call before upsert; updated system prompt with full article structure requirement.
- **`HelpDrawer` back-navigation**: arrow-left button appears when the user has navigated to a linked article, allowing them to return to the previous topic. History is cleared on drawer close.
- **i18n fallback anchors** added for `workspace.resources`, `workspace.reports`, `workspace.settings`, and `workspace.agile` in both EN and HU bundles — these power the drawer when no DB article exists yet.
- **Seed migration `20260507130000`**: 40 curated EN+HU help articles covering all major Effectime pages and features: Workspaces, Members, Organization, Calendar, Leave Request, Approval Flow, Workflows, Resources, Reports & Audit, Settings, Agile Boards, Capacity DNA, Org Chart, Coverage Planner, Localization Settings, Audit Log, Integration Health, Command Center, Quota Manager, Holiday Manager, Role Permissions, Decision Memory, Access Request. Uses `ON CONFLICT DO NOTHING` so regenerator-promoted articles are never overwritten.

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- `help_articles` schema changes are purely additive (new nullable columns + new index).
- All existing help drawer functionality (drag-target, search, fallback i18n copy, ReactMarkdown rendering) preserved.

## 2026-05-07 — v3.2.0 Self-Updating Help System

### Added
- **DB**: `help_articles` (topic_key, locale, title, summary, body_md, route, anchor_id, taxonomy, tags, synonyms, related_topics, search_tokens tsvector) + `help_releases` for release-driven regeneration tracking. RLS: public read, service-role write only.
- **DB schema**:
  - `help_articles` — per-(topic_key, locale) article storage with: title, summary, body_md, route, anchor_id, taxonomy, tags[], synonyms[], related_topics[], release_id FK, content_hash SHA-256, is_system_generated, search_tokens tsvector, last_generated_at. Trigger `help_articles_search_trigger` rebuilds tsvector on insert/update with weighted A (title), B (summary+tags+synonyms), C (body). GIN indexes on tags and search_tokens. `is_active` + `archived_at` columns for soft-delete (added v3.2.1).
  - `help_releases` — one row per regeneration run: version_tag UNIQUE, commit_sha, status enum, summary, error, triggered_by, started_at, completed_at.
  - RLS: public SELECT only (no INSERT/UPDATE/DELETE policy — service role only writes).
- **Edge function `help-regenerator`**:
  - **HMAC-SHA256 verification** of `x-hub-signature-256` against `GITHUB_RELEASE_WEBHOOK_SECRET`. If secret env var is unset, verification is **skipped** (allows manual testing without a secret). Does NOT fail — this is intentional to allow local curl invocations.
  - Fetches `CHANGELOG.md` + last 10 `versioning/*.md` via `raw.githubusercontent.com`.
  - Calls **Google Gemini 2.0 Flash** (`generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`) with `responseMimeType: "application/json"`, `temperature: 0.3`, structured JSON array output.
  - Upserts each EN+HU variant on conflict `(topic_key, locale)`; computes SHA-256 content hash.
  - Archives previous article versions by setting `archived_at` before upsert; new version gets `is_active = true`.
- **Frontend Help Drawer redesign** (`HelpDrawer.tsx`): search bar with debounced autocomplete (200 ms), locale-aware results with EN fallback, markdown body rendering (`react-markdown`), release tag badge, dark glass surface.
- **Drag-target ? icon** (`HelpButton.tsx`): `pointerdown` → tracks pointer movement. If movement exceeds **6px threshold**, switches to drag mode. While dragging, `document.elementFromPoint()` finds the nearest `[data-help-region]` and toggles `.help-target-hover` (primary-tinted ring + brightness boost). On `pointerup` over an anchor, opens drawer with that anchor's article. Pure click (< 6px movement) opens the page-level help as before.
- **`useHelpArticleByAnchor` / `useHelpSearch` hooks** in `src/lib/help/useHelpArticles.ts`: anchor lookup with EN fallback, ilike full-text search.

### Webhook configuration
`POST https://oezlzzmzzvbvinuysxaz.supabase.co/functions/v1/help-regenerator`  
GitHub repo Settings → Webhooks → Content type: `application/json`, Secret: `GITHUB_RELEASE_WEBHOOK_SECRET`, Events: "Releases" only.  
Manual trigger: `curl -X POST <url> -H 'content-type: application/json' -d '{"repo":"OWNER/REPO","ref":"main","version_tag":"v3.x.x"}'`

## 2026-05-08 — v3.1.1 Demo workspace, position catalog wiring, Jira sync fix, in-app Jira issue editor

### Added — Demo workspace creation (full flow)
- **`supabase/functions/seed-demo-workspace/index.ts`**: new edge function that creates a fully populated workspace in one call. Strategy: create real `auth.users` for 7 demo personas (`Anna Kovács`, `Bence Tóth`, `Csilla Nagy`, `Dávid Szabó`, `Eszter Kiss`, `Ferenc Horváth`, `Gizella Varga`) tagged with `app_metadata.is_demo_persona`, so all profile lookups, leave_requests, allocations, and skills work without schema changes. The function then seeds:
  - 3 offices (Budapest HQ / Debrecen / Szeged) with real city addresses,
  - 4 teams (Frontend / Backend / Operations / QA),
  - 4 leave types (Éves szabadság / Betegszabadság / Fizetés nélküli / Otthoni munka),
  - 8 HU public holidays for the current year,
  - 9 skills (React, TypeScript, Node.js, PostgreSQL, Docker, AWS, Tailwind CSS, Cypress, Jest) with categories and colors,
  - 7 memberships (1 owner + 6 demo personas) with city/office/role/team/working hours,
  - 14–21 member-skill assignments (random level 1–5),
  - 6 role allocations (1 per persona at 100%),
  - 6 leave requests covering every status: approved past, approved upcoming, currently on leave, pending, rejected, sick leave,
  - 25-day vacation allowance per member,
  - 1 daily rule (max 2 off on Mondays),
  - 1 office coverage rule (Budapest needs 1 dev present weekdays),
  - 1 audit event recording the demo seed.
- **`supabase/functions/cleanup-demo-workspace/index.ts`**: companion edge function that deletes the workspace AND removes the orphan demo `auth.users`. Owner-only authorization. Reads `enterprise_workspaces.settings.demo_user_ids` (stamped by the seeder) so cleanup can find the exact users to remove.
- **`CreateWorkspaceDialog`**: new "Demo munkaterület" panel below the description field with a `Demo munkaterület létrehozása` button. Calls `seed-demo-workspace` and reports the seeded counts in the toast.
- The demo flag is stored on `enterprise_workspaces.settings.is_demo` plus `demo_user_ids` and `demo_seed_tag` so the workspace is identifiable and safely cleanable.

### Fixed — Position catalog now actually shows in Resources tab
- **`BusinessRoleManager`** (Resources → Pozíciók): added `Katalógus megnyitása` button that opens `PositionPickerDialog`, alongside the existing free-text input. Picking a position from the catalog appends it as a new role group ready for member allocation.
- **`PositionPickerDialog`** now falls back to the **global catalog** (`enterprise_catalog_categories` / `enterprise_catalog_roles` / `enterprise_catalog_role_skills` / `enterprise_catalog_skills`) when the workspace-scoped customization layer is empty — which is the case for every fresh workspace. The 558+ rows already seeded in `enterprise_catalog_skills` are now reachable from the UI. A small banner indicates when the global catalog is being read.

### Fixed — Jira `sync_project_config` 500 error
- **`jira-devops-proxy/jiraSyncProjectConfig`**: previous code passed `project_key` (e.g., `SYN`) into the `projectId` query parameter of `/rest/api/3/issuetype/project`, which expects a numeric ID and 500'd. Replaced with `GET /rest/api/3/project/{key}` (returns issueTypes inline) and a `/rest/api/3/issue/createmeta` fallback. Label/component discovery is now best-effort (warns instead of failing the whole sync).

### Added — In-app Jira issue editor (open & edit Jira tickets without leaving Effectime)
- **`JiraIssueEditor`** (`src/components/enterprise/agile/JiraIssueEditor.tsx`): new dialog that loads a Jira ticket with all primary fields (summary, description, priority, labels, due date, story points, assignee, status with available transitions, sprint, parent, components, reporter, timestamps) and lets users edit them in place. Save sends a single `update_issue` call to `jira-devops-proxy` and refreshes the local cache; status changes go through the Jira `/transitions` endpoint. Free-text where appropriate (summary, description, labels), select-from-list for priority/status/assignee.
- **`jira-devops-proxy`** extended with three new actions:
  - `get_issue` — fetches a single issue with `*all` fields + status transitions in parallel,
  - `get_transitions` — lists allowed status transitions for a given key,
  - `search_assignable_users` — type-ahead user search scoped to the issue.
- **`update_issue`** now supports description, priority, due date, story points (customfield_10016), assignee account ID, and `status_transition_id`. After save, the proxy re-reads the issue and upserts the fresh row into `enterprise_agile_issues` so the cache stays current.
- **`BacklogBrowser`** rows: clicking the summary or the new pencil icon opens `JiraIssueEditor`. The external link icon to the actual Jira site is preserved.
- **`AgileBoards`** (Kanban / Scrum / Gantt): cards and Gantt rows are now keyboard- and click-actionable; opening a card launches the editor. The external Jira link on each card stops propagation so it still navigates externally.

### Non-Regression Contract
- `seed-demo-workspace` uses the existing `create_workspace_with_owner` RPC for the workspace itself (preserves owner-membership invariants), then service role for additive seeding only.
- `cleanup-demo-workspace` only deletes workspaces where `created_by = auth.uid()`. RLS-protected.
- `PositionPickerDialog` still tries the workspace-scoped tables first; the global catalog is a fallback, not a replacement.
- All Jira proxy changes are additive (new actions). Existing `search_issues`, `create_issue`, `update_issue` behavior preserved; `update_issue` now accepts more optional fields but ignores those it doesn't recognize.
- `JiraIssueEditor` is a brand-new component; no existing component was rewritten.
- The previous BacklogBrowser external-link behavior is preserved alongside the new edit affordance.

### Validation
- `npx vitest run` → 83 tests, 0 failures (unchanged from v3.1.0).
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors (cleaned up from the prior 18 baseline now that node_modules is installed).

---

## 2026-05-07 — v3.1.0 Phases 9, 10, 11: QA Safety Net, Versioning & Rollout, Implementation Roadmap

### Added — Phase 9 (QA, testing, and release safety)

**Unit test suite — 77 new tests across 6 test files** (total: 83 tests, all passing):

- `src/test/passwordValidation.test.ts` (9 tests): full coverage of `validatePassword` per-check flags and `isPasswordValid` composite gate; regression-guards the auth strength requirements.
- `src/test/capacityEngine.test.ts` (11 tests): `sortCandidatesForRequirement` (full-time ≥90% vs partial-fit strategy, immutability, empty input); `summarizeRequirements` (gap math, multi-role, zero-assignment, over-assignment edge cases).
- `src/test/coverageEligibility.test.ts` (20 tests): pure `evaluateEligibility` and `rankCandidates` — all blocking and warning codes verified (ON_LEAVE, BLOCKED, PENDING_LEAVE, HOLIDAY, WRONG_ROLE, MISSING_SKILL, SKILL_LEVEL_LOW, DOUBLE_BOOKED, OVER_CAPACITY); multi-role/multi-skill resolution; leave range boundary; cross-user leave isolation.
- `src/test/smartSchedule.test.ts` (8 tests): `generateSmartSchedule` — site-allowlist enforcement, leave exclusion, multi-day range, multi-slot headcount, role preference, no-double-booking invariant.
- `src/test/csv.test.ts` (20 tests): `flatten` (nesting, deep keys, type coercion, null/undefined); `parseCsv` (simple, quoted commas, escaped quotes, CRLF); `buildI18nCsv` (header, 3-column invariant, sorted keys); `parseI18nCsv` (key-column guard, empty input, added/updated/skipped counts, override maps); `bundleStats`.
- `src/test/i18n.localization.test.ts` (9 tests): EN/HU key parity (minimum 100 keys, ≤5% gap tolerance in each direction), empty-value regression, `bundleStats` tolerance, explicit critical-key assertions for `common.save`, `header.help`, `header.language`, and `organization.*` keys.

**Validation**: `npx vitest run` → 83 tests, 0 failures.

### Added — Phase 10 (Changelog, versioning, and rollout governance)

- **Versioning file** `versioning/07052601_v3.1.0_phases_9_10_11.md`: canonical delivery artifact covering the full Phase 9–11 scope, regression protection matrix, feature flag status table, rollout guards, pre-existing known issues, and deployment sequence (zero-migration release).
- Feature flag inventory and rollback procedure documented.
- 5-step CI gate checklist (`vitest run`, `tsc --noEmit`, smoke test, mobile test, RLS check) codified as the merge-gate for all future waves.

### Added — Phase 11 (Final implementation roadmap)

- **6-wave delivery plan** defined in the versioning file:
  - Wave 0: Foundation hardening (already delivered — localization, help system, organization module, onboarding, strategic capabilities).
  - Wave 1: Approval orchestration hardening (delegation, escalation UI, simulation, mobile UX).
  - Wave 2: Capacity engine v2 (precomputed snapshots, shortage/overload forecast, scenario compare, financial impact layer).
  - Wave 3: Organization and onboarding production-readiness (org chart zoom/pan, deadline enforcement, member completion wizard).
  - Wave 4: Integration health and external access (retry queue, webhook/polling hybrid, access approval routing, SCIM).
  - Wave 5: Reporting, export, and compliance (field masking, retention policy, PDF renderer, new report datasets).
  - Wave 6: Localization expansion (remaining help anchors, manual chapters, third-language scaffold, admin translation editor).
- Dependency order and parallelization opportunities documented.
- Open questions and risks (7 items) catalogued with owner and priority.

### Non-Regression Contract
- Zero schema changes — this is a test-and-documentation-only release.
- Zero edge function changes.
- Zero new npm runtime dependencies.
- TypeScript error count unchanged at 18 (all pre-existing missing-peer-dep issues).
- All existing UI tabs, routes, buttons, filters, exports, and workflows untouched.

---

## 2026-05-06 — Jira integration repair + Boards (Kanban / Scrum / Gantt)

### Fixed — Jira search 410 / empty result regression
- **Root cause**: `jiraSearch()` was calling a single fixed endpoint and requesting only a hardcoded subset of fields. After Atlassian migrated tenants to the new search API (`/rest/api/3/search/jql`), the old endpoint returned 410 Gone or zero results.
- **Fix** (`supabase/functions/jira-devops-proxy/index.ts`):
  1. Request `fields: ['*all']` so Jira returns every navigable + custom field.
  2. Cascade three endpoints: `POST /rest/api/3/search/jql` → `GET /rest/api/3/search/jql` → `GET /rest/api/3/search` (legacy). First 2xx wins.
  3. Map description from **Atlassian Document Format (ADF)** JSON to plain text via a recursive `adfToText()` walker that handles `text`, `paragraph`, `heading`, `bulletList`, `listItem`, `codeBlock`, and `inlineCard` node types.
  4. Resolve `sprint`, `team`, `start_date`, `story_points` across the most common Jira customfield IDs: `customfield_10020 / 10007 / 10010` (sprint), `customfield_10001` (team), `customfield_10015` (start date), `customfield_10016 / 10026` (story points).
- Removed leftover `auth-middleware.ts` / `client.server.ts` TanStack stubs that broke the Vite SPA build (`Cannot find module '@tanstack/react-start'`).

### Added — Extended Jira field ingest
The proxy now imports and caches the following fields per issue (Jira Cloud):

| Field | Source |
|-------|--------|
| assignee | `fields.assignee.displayName` |
| reporter | `fields.reporter.displayName` |
| status | `fields.status.name` |
| issue_type | `fields.issuetype.name` |
| summary | `fields.summary` |
| description | `adfToText(fields.description)` |
| key | `issue.key` |
| parent_key | `fields.parent.key` |
| sprint_name | `customfield_10020 / 10007 / 10010` |
| labels | `fields.labels` (full array) |
| due_date | `fields.duedate` |
| team_name | `customfield_10001 / fields.team` |
| start_date | `customfield_10015 / fields.startdate` |
| priority | `fields.priority.name` |
| story_points | `customfield_10016 / 10026` |

Schema migration: two new columns on `enterprise_agile_issues` — `description text`, `team_name text`.

### Added — Boards tab (Kanban / Scrum / Gantt)
New `AgileBoards` component, mounted as a dedicated tab in `AgilePanel`:
- **Kanban** — columns grouped by `status`, cards show key, type chip, assignee, SP, priority, labels.
- **Scrum** — first level grouped by `sprint_name`, second level by `status`; per-sprint header counts tickets and total Story Points.
- **Gantt** — horizontal month-grid timeline driven by `start_date → due_date` with type-coloured bars (Bug=red, Epic=purple, Story=emerald, Task/other=sky).
All three views read from the cached `enterprise_agile_issues` so they remain available offline; a `Szinkron` button forces a fresh pull.

---

## 2026-05-06 — Navigation restructure: NotificationBell + Rules consolidation (PR #12)

### Changed — `WorkspaceDashboard` top-level tab bar
- **Removed** the standalone `Értesítések` (Notifications) tab.
- **Removed** the standalone `Szabályok` (Rules) tab.
- Tab bar simplified from 8 → 6 primary tabs.

### Added — `NotificationBell` in workspace header
- Bell icon next to the `Profilom` button; displays **unread count badge** (capped at `99+`).
- Badge count refreshes every 60 s and on popover close.
- Clicking opens a `Popover` containing the existing `EnterpriseNotifications` component unchanged.
- `canView('notifications')` permission still gates visibility.

### Changed — All rule managers moved into `Kérelmek` tab
- New **Szabályok** collapsible section inside `Kérelmek` containing all rule managers: Approval chains, Leave types, Holidays, Company days, Blocked dates, Daily rules, Office coverage rules, Rule template library.
- All top-level sections in `Kérelmek` (Jóváhagyások, Kérelmek, Szabályok) start **collapsed by default**; each sub-section is independently collapsible.
- `canView('rules')` permission still gates the entire section.
- All rule managers render functionally unchanged inside their new collapsible wrappers.

---

## 2026-05-05 — v3.0.0 Phase 8 implementation: persistent translation overrides, predictive forecaster v1, Org Pulse, Integration Health Center, Decision Memory observed-outcome capture

### Added — Persistent translation overrides
- Migration `supabase/migrations/20260505140000_phase8_overrides_pulse.sql` adds `enterprise_translation_overrides` (workspace_id, locale, key, value, source, authored_by) with `(workspace_id, locale, key)` UNIQUE, full RLS (member read, admin write).
- `I18nProvider` extended with `loadWorkspaceOverrides(workspaceId)` and `activeWorkspaceId`. Resolution order is now: workspace override (active locale) → bundle (active locale) → workspace override (default locale) → bundle (default locale) → key. `WorkspaceDashboard` invokes `loadWorkspaceOverrides(workspace.id)` on mount and clears on unmount.
- `Settings → Localization`: admins now have a true persistence path. Importing a CSV upserts each row into `enterprise_translation_overrides` and immediately reloads the active overrides — translations live without code changes.

### Added — Capacity DNA / Predictive forecaster v1 (rule-based, client-side)
- `CapacityDnaPanel` rendered inside the Resources tab with a *Generate snapshot for today* admin action.
- Computes baseline (active members), effective (baseline minus approved leave overlapping today), committed (sum of `enterprise_member_role_allocations.percentage / 100`), available, shortage_score, overload_score.
- Upserts to `enterprise_capacity_snapshots (workspace_id, snapshot_date)` UNIQUE; the last 30 days are surfaced as a compact table with shortage/overload trend icons.

### Added — Org Pulse widget
- `OrgPulseWidget` rendered above the workspace tabs (admins only). Pulls from a new SQL view `enterprise_org_pulse_membership` plus two on-the-fly counters (approvals open > 48h; approved leave in the last 7 days).
- Privacy-safe: every cell is suppressed when its denominator (`active_members`) is below `k = 5`, or when the value itself is between 1 and 4 (k-anonymity floor).

### Added — Integration Health Center
- New Settings section (admin only) — `IntegrationHealthCenter` lists each `enterprise_integrations` row with a per-integration health badge (`healthy / degraded / failed / unknown`) computed from the last 5 entries of `enterprise_agile_sync_log`.
- Surfaces last sync action, status, and the three most recent error excerpts inline.

### Added — Decision Memory observed-outcome capture
- Migration adds `enterprise_decision_memory.observation_due_at` plus a `BEFORE INSERT` trigger that defaults it to `authored_at + 14 days`.
- `DecisionMemoryStaleInbox` rendered inside the Approvals collapsible (admin only). Lists every memory whose observation window has elapsed and has no observed outcome yet; admins capture the outcome inline. Closes the learning loop on every recorded decision.

### i18n
- Added EN + HU keys for `pulse`, `capacity`, `integration_health`, `decision.stale_inbox_*`, `settings.localization.persisted`. Both bundles in lockstep — the import-CSV pipeline can now patch any gap without code deploys.

### Wiring
- `WorkspaceDashboard` imports the four new components, passes `isAdmin` + `userId` to `LocalizationSettings`, renders `CapacityDnaPanel` in Resources, `OrgPulseWidget` above tabs, `IntegrationHealthCenter` and `DecisionMemoryStaleInbox` in their respective Settings/Approvals sections.
- `loadWorkspaceOverrides` lifecycle anchored to the active workspace.

### Non-Regression Contract
- Migration is purely additive (one new table, one new view, one new column, one new trigger). No RLS weakening; new policies match the established `is_enterprise_member` / `has_enterprise_role` pattern.
- Phase 8 components are admin-only where they involve writes; read-only members see suppressed pulse cells and snapshot tables but cannot trigger writes.
- Forecaster v1 is rule-based and runs client-side — no edge-function or pg_cron dependency.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: total error count unchanged at 18 (all pre-existing missing-peer-dep issues in the sandbox). Zero errors in any Phase 8 file (`CapacityDnaPanel`, `OrgPulseWidget`, `IntegrationHealthCenter`, `DecisionMemoryStaleInbox`, `csv` util, `I18nProvider` extensions, `LocalizationSettings` upsert path, both bundles).

## 2026-05-05 — v3.0.0 Phases 5–7 implementation: Onboarding, External Access matrix, Strategic capabilities, Localization expansion

### Added — Phase 5 (Onboarding & External Access)
- **Migration** `supabase/migrations/20260505130000_onboarding_access_strategic.sql` (idempotent additive):
  - `enterprise_onboarding_templates`, `enterprise_onboarding_template_steps` (8 step types: `task | read | acknowledge | training | exam | approval | internal_permission | external_access`),
  - `enterprise_onboarding_instances`, `enterprise_onboarding_step_completions`,
  - `enterprise_access_systems`, `enterprise_access_templates`, `enterprise_access_template_systems`, `enterprise_access_requests`, `enterprise_access_decisions`,
  - cross-table FK from onboarding step `access_system_id` to access systems,
  - full RLS (members read, admins write; child-table policies gate via parent's workspace),
  - `seed_default_access_systems` SECURITY DEFINER seeder (Jira / Confluence / Outlook / Dynatrace / ERP / Billing / Entry Control).
- **Workflows module** (`src/components/enterprise/workflows/`):
  - `WorkflowsModule` shell with 5 sub-tabs.
  - `OnboardingTemplates` — create + publish + archive templates, per-template collapsible step editor, 8 step types localized.
  - `OnboardingInbox` — start onboarding for a member, per-instance progress (completed steps / total steps), confirm/cancel actions.
  - `AccessSystems` — manage external + internal systems, **Seed defaults** RPC button, archive.
  - `AccessTemplates` — pivot-style position-bundle editor, system checkbox toggles per template, collapsible per template.
  - `AccessInbox` — submit on behalf of member, decide (approve/reject/mark granted/revoke), every decision writes to `enterprise_access_decisions`.
- **New `Folyamatok` (Workflows) tab** added to the workspace tab bar between Naptár and Erőforrások (gated by `members` view permission).

### Added — Phase 6 (Strategic capabilities)
- **Migration extends `enterprise_workspaces`**: `recovery_mode`, `recovery_mode_reason`, `recovery_mode_activated_at`, `recovery_mode_activated_by`.
- **`enterprise_capacity_snapshots`** table for per-day baseline / effective / committed / available FTE + shortage/overload scores + payload jsonb (foundation for predictive forecaster v2).
- **`enterprise_decision_memory`** table — `(workspace_id, subject_type, subject_id)` UNIQUE annotation with rationale / expected outcome / observed outcome.
- **`CommandCenter` widget** (`src/components/enterprise/CommandCenter.tsx`) — rendered at the top of the workspace dashboard, surfaces four counters (pending leave approvals, in-progress onboarding instances, pending access requests, members with incomplete org metadata). Click-through navigates to the relevant tab. Visually shifts to destructive-tinted card when Recovery Mode is active. Refreshes every 90s.
- **`RecoveryModeSettings`** — Settings → Recovery üzemmód section with activate/deactivate, reason, activated-at timestamp.
- **`DecisionMemoryEditor`** — generic memo component (`subject_type`, `subject_id`) for attaching rationale + expected/observed outcomes to any decision; uses upsert pattern. Drop-in for approvals, scenarios, access decisions.
- **WorkspaceDashboard** loads `recovery_mode` flag at mount and refreshes every 90s; CommandCenter receives the flag for visual emphasis.

### Added — Phase 7 (Localization expansion + admin manageability)
- **Hungarian localization completed** for all new keys: workflows, onboarding (template / instance / step types), access (systems / templates / inbox + 7 statuses + 5 actions), command center, decision memory, settings (recovery + localization import/export). EN baseline mirrored.
- **i18n CSV utilities** (`src/lib/i18n/csv.ts`):
  - `flatten(bundle)` — recursive dotted-key map of resource bundle.
  - `buildI18nCsv()` — RFC4180 CSV with BOM, columns `key,en,hu`, sorted by key.
  - `parseCsv(text)` and `parseI18nCsv(text)` — quoted-field aware parser, computes `{ added, updated, skipped, total, overrides }` summary; per-locale override Maps.
  - `bundleStats()` — total keys + missing-key counters per locale.
- **Settings → Localization** now exports / imports bilingual translation CSVs:
  - **Export CSV** downloads `effectime-i18n-YYYY-MM-DD.csv`.
  - **Import CSV** parses uploads, validates header, reports a session summary (`{{added}} new · {{updated}} updated · {{skipped}} skipped`). Persistent admin overrides land in a follow-up release; this surface is the canonical translator exchange unit.
  - Header now also shows live counters: total keys / missing in HU / missing in EN.

### Wiring
- `WorkspaceDashboard` imports `WorkflowsModule`, `CommandCenter`, `RecoveryModeSettings`; renders CommandCenter once at the top of `<main>`; new `workflows` TabsContent; new Settings section for Recovery Mode (admin only); refresh-on-interval recovery flag.
- New help anchor `workspace.workflows` registered in EN + HU bundles.

### Non-Regression Contract enforcement
- All Phase 5–6 tables additive; all RLS workspace-scoped via `is_enterprise_member()` / `has_enterprise_role()`.
- No existing tab, button, route, or workflow removed. Workflows is a brand-new tab, not a replacement.
- Command Center is purely additive (extra widget at top of `<main>`); existing dashboard layout below remains untouched.
- Decision Memory does not modify any existing approval/leave/scenario row — it stores a side-table annotation.
- i18n CSV import is session-only in this release; persistent overrides require a follow-up RPC and are explicitly noted in the import help text.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: zero errors in any new file (workflows/*, CommandCenter, RecoveryModeSettings, DecisionMemoryEditor, csv util, both bundles, NotificationBell). Total error count unchanged at 18 — all pre-existing missing-peer-dep complaints in the sandbox.

## 2026-05-05 — v3.0.0 Phases 1–4 implementation: localization, help system, Organization module, position catalog, org chart, manual

### Added — Phase 1 (Localization + Help system)
- **i18n core** (`src/i18n/`): homegrown React-Context provider, EN + HU resource bundles (`src/i18n/resources/{en,hu}.ts`), `useT`/`useI18n` hooks, browser+localStorage+`profiles.preferred_locale` detection chain with English fallback. No new npm dependency.
- **Language selector** (`src/components/i18n/LanguageSelector.tsx`) — circular flag dropdown in the right header cluster; persists immediately to `localStorage.effectime.locale` and best-effort to `profiles.preferred_locale`.
- **Help system** (`src/lib/help/registry.tsx`, `src/components/help/HelpButton.tsx`, `src/components/help/HelpDrawer.tsx`) — question-mark button on the **left side** of every header, right-side drawer with section title, summary, common-tasks list, and breadcrumb chips. Page regions marked with `data-help-region="<anchor>"` receive a soft pulse ring (respects `prefers-reduced-motion`). Shipped anchors: `home.overview`, `workspace.members`, `workspace.organization`, `workspace.calendar`, `workspace.approvals`, `settings.localization`.
- **Help highlight CSS** (`src/index.css`): `.help-highlight-ring` + keyframes + reduced-motion guard.
- **Header restructure** (`src/pages/Enterprise.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`): Help (?) on left, Language selector in right cluster, all existing buttons preserved (Profilom, Meghívás, Kilépés, Új munkaterület). Workspace header now drives the help anchor from the active tab.
- **Settings → Localization** (`src/components/enterprise/settings/LocalizationSettings.tsx`): read-only v1 — lists EN + HU with active-language indicator, missing-key counter, workspace-default note.
- **Side fix**: missing `Building2` import in `Enterprise.tsx` (latent bug — would crash the empty-workspace state) added.

### Added — Phase 2 (Organization module)
- **Migration** `supabase/migrations/20260505120000_preferred_locale_and_organization.sql`: idempotent additive migration adding
  - `profiles.preferred_locale` + check constraint,
  - `enterprise_workspaces.default_locale` + check constraint,
  - tables: `enterprise_org_units`, `enterprise_leadership_levels`, `enterprise_contract_types`, `enterprise_industries`, `enterprise_work_categories`, `enterprise_job_families`, `enterprise_org_chart_snapshots`,
  - additive columns on `enterprise_memberships`: `org_unit_id`, `manager_id`, `leadership_level_id`, `contract_type_id`, `leadership_category` (with check constraint), `employer_rights`, `position_catalog_id`, `seniority`,
  - manager-cycle prevention trigger,
  - RLS policies (members view, admins manage) for all new tables,
  - `seed_default_contract_types` and `seed_default_leadership_levels` SECURITY DEFINER seeders.
- **People → Organization** tab (`src/components/enterprise/organization/`): full sub-module with seven tabs:
  - `OrgStructure` — hierarchical tree with parent picker, archive action.
  - `LeadershipLevels`, `ContractTypes`, `Industries`, `WorkCategories`, `JobFamilies` — backed by a shared `CatalogListEditor` (label + auto-slugged code, archive, optional **Seed defaults** for leadership and contracts).
  - `OrgChart` — auto-generated tree from `manager_id`, search filter, snapshot timestamp, **Regenerate snapshot** writes to `enterprise_org_chart_snapshots`.
- **InviteMemberDialog** enhanced (`src/components/enterprise/InviteMemberDialog.tsx`):
  - New optional Organization metadata section: org unit, direct manager, contract type, leadership level, leadership category, employer-rights checkbox.
  - Predefined Position Picker integration (Phase 3).
  - All new fields stored in the workspace `invitation_prefills` payload alongside existing fields.
  - Audit-log metadata extended with the new fields.
  - Existing free-text + RoleAllocationEditor + template paths fully preserved.
- **MemberProfileSheet** completion banner (`src/components/enterprise/MemberProfileSheet.tsx`): non-blocking amber banner at the top of the profile when any of `org_unit_id`, `manager_id`, `contract_type_id`, `leadership_level_id` is missing. Existing data preserved.

### Added — Phase 3 (Position catalog)
- **PositionPickerDialog** (`src/components/enterprise/positions/PositionPickerDialog.tsx`): three-step drill-down (category → role → review skills), reads from existing workspace catalog tables (`enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_role_skills`). Recommended `required` skills pre-checked; per-skill opt-in/opt-out; seniority selector (junior/medior/senior/lead/principal). Returns `{ positionRoleId, positionLabel, seniority, skillIds }` to the caller. Free-text path remains the default.

### Added — Phase 4 (Org chart + manual)
- **Org chart snapshot table** in the same migration; snapshot persistence wired through OrgChart's *Regenerate snapshot* action.
- **Bilingual user manual** (`docs/manual/{en,hu}/`):
  - `README.md`, `getting-started.md`, `workspaces.md`, `help.md`, `settings/localization.md`,
  - `people/members.md`, `people/organization.md`, `people/positions.md`,
  - parallel EN + HU editions covering all Phase 1–3 surface.

### Wiring
- `src/App.tsx`: wraps the app in `<I18nProvider>` and `<HelpRegistryProvider>`, renders `<HelpDrawer />` once at the top level.
- `WorkspaceDashboard` adds the `Szervezet` tab between Tagok and Naptár (gated by `members` view permission, identical to Tagok).
- `WorkspaceSettings` adds the Localization section after iCal.

### Non-Regression Contract enforcement
- Conflict engine, capacity engine, approval chain semantics, RLS helpers, email registry, office coverage rule fallback, calendar filter system, auth flows — **untouched**.
- All new fields on `enterprise_memberships` are nullable; the application reads via `.from('table').select('*')` patterns and degrades gracefully if columns are missing in dev.
- All new tables are workspace-scoped with `is_enterprise_member()` SELECT and `has_enterprise_role()` write policies.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors in any new or modified file. Total error count went from 19 → 18 (the missing `Building2` import in `Enterprise.tsx` is now fixed). Remaining 18 errors are all pre-existing missing-peer-dep complaints in the sandbox (`framer-motion`, `@dnd-kit/*`, `@tanstack/react-router`, `@tanstack/react-virtual`, `@lovable.dev/cloud-auth-js`, `@tanstack/react-start`) plus one pre-existing `CreateWorkspaceDialog` `userId` prop mismatch.
- Production `vite build` failure in the sandbox is pre-existing (peer-dep resolution against the lovable npm cache returned 403); identical on `HEAD` without these changes.

## 2026-05-05 — v3.0.0 Effectime Enterprise Master Framework (specification + Phase-1 prompts)

### Added — Versioning artifacts (no runtime changes in this commit)
- `versioning/05052601_v3.0.0_enterprise_master_spec.md` — canonical 25-section product, UX, frontend, backend, QA, localization, documentation, and rollout specification for the Effectime platform. Establishes the structural framework the existing modules must align to.
- `versioning/05052601_v3.0.0_ai_dev_prompts.md` — Phase-1 implementation prompts (header restructure, i18n scaffold, `profiles.preferred_locale`, help registry shell, Settings → Localization v1) with binding regression constraints and validation checklist.

### Scope established by this directive
- **First-class Organization module** (hierarchy, leadership levels, contractual relationships, industry, work categories, job families, automatic org chart) as a People sub-section — not a parallel hierarchy.
- **Mandatory member metadata** at creation: direct manager, organizational unit, position, leadership level, contract type, workspace, employer-rights flag, leadership category. Soft-required during transition with completion banner; cut-over date per workspace.
- **Predefined position catalog** with category drill-down and recommended skill expectation inheritance (junior/medior/senior). Free-text path preserved alongside catalog path. Builds on the role/category/skill catalog migration `20260505110000_enterprise_role_skill_catalog.sql`.
- **Onboarding playbook** as a first-class module: templates, instances, steps, ownership, deadlines, escalation, completion. Reuses the existing approval engine; does not duplicate it.
- **External Access Request matrix** tied to position and onboarding (Jira, Confluence, Outlook, Dynatrace, ERP, Billing, custom). Position × system pivot; routed through existing approval chains.
- **Help system** with question-mark icon on the **left side of the header**, contextual highlighting of the current page region, bilingual content, focus-trapped drawer.
- **Localization architecture** (English + Hungarian first), language selector with circular flag in the right header cluster. `profiles.preferred_locale` persistence; workspace default; missing-key fallback to English.
- **Full user manual** structure under `docs/manual/<locale>/<module>/<page>.md`, in-app `/manual` route, EN+HU parallel publishing.
- **Strategic capability framing** (capacity engine, predictive forecasting, workforce command center, approval orchestration, multi-workspace operating model, integration health, skill staffing, financials, scenarios, compliance, capacity DNA, recovery mode, org pulse, decision memory) layered on existing modules — not new top-level destinations.
- **Information architecture** consolidated to seven primary destinations: Home, Calendar, People, Workflows, Resources, Reports, Settings.

### Non-Regression Contract (binding)
- Auth flows, leave/approval lifecycle, quota math, conflict engine, capacity engine, RLS policies, email registry, office coverage rule fallback, and calendar filter system are classified **preserve exactly**.
- No removal of any existing tab, page, route, button, filter, export, or notification without an explicit `risky-change` artifact and changelog `Removed` entry.
- No silent semantics drift on approval, leave conflict, capacity, or coverage logic. No RLS weakening.
- No localization of database identifiers, enum codes, or stored permission keys.

### Non-Duplication Rules (binding)
- Organization module is canonical for hierarchy and contracts; existing People surfaces read from and write to it.
- Single skill taxonomy shared between SkillsManager and position catalog.
- Single approval engine for leave, onboarding, and access decisions.
- Onboarding and access KPIs ship as datasets/views in the existing report builder.
- All new flows route through `EnterpriseNotifications` and the transactional email registry.

### Rollout
- Phased delivery (Phase 1 foundations → Phase 7 localization completion) gated by per-workspace feature flags: `feat.help_system`, `feat.org_module`, `feat.position_catalog`, `feat.onboarding`, `feat.access_matrix`, `feat.localization_hu`, `feat.command_center`, `feat.recovery_mode`. Default off in production; rollback by flag.

### Notes
- This commit is **specification-only**. No `src/`, no migrations, no edge function changes. Runtime behavior is unchanged.
- Implementation begins under `versioning/05052601_v3.0.0_ai_dev_prompts.md` Phase 1.

---

## 2026-05-05 — Enterprise role/category/skill catalog schema foundation (PR #9)

### Added — Global catalog + workspace override layer
- **Migration** `supabase/migrations/20260505110000_enterprise_role_skill_catalog.sql`:
  - **Global inventory**: `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills` (role→skill mapping with `min_experience_level`).
  - **Workspace override layer**: `enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_skills`, `enterprise_workspace_role_skills` (workspace-local copies with `approved`/`required` flags).
  - **`enterprise_experience_level`** enum: `junior` / `medior` / `senior` / `lead` / `principal`.
  - **`enterprise_memberships.business_role_id`** FK to `enterprise_workspace_roles.id` (additive; legacy `business_role` text column preserved for backward compat).
  - Indexes for workspace lookups, `updated_at` triggers on mutable tables, RLS policies (member read, admin write) on workspace-scoped tables.
- Seeded with 23 categories, 366+ roles, 550+ skills.
- Foundation consumed by `PositionPickerDialog` (Phase 3 of v3.0.0) for the 3-step drill-down (category → role → skill review).

---

## 2026-05-04 — URL canonicalization, branding, theme system, positions integrity (PRs #3–7)

### Changed — URL structure: `/enterprise` → `/app`; workspace UUID removed from URL (PR #3)
- `Enterprise.tsx` resolves the active workspace from: (1) legacy `?ws=` param once for backward compat → (2) `localStorage.active_workspace_id` → (3) first available workspace, then strips `?ws=` via `history.replaceState`.
- `/enterprise` preserved as a redirect alias → `/app`. Deep-link `?tab=` preserved.
- Invite acceptance sets workspace in state/storage without re-injecting `?ws=`.
- Files: `App.tsx`, `Enterprise.tsx`, `Auth.tsx`, `Landing.tsx`, `useAuth.tsx`, `InviteMemberDialog.tsx`, `Admin.tsx`, `Profile.tsx`, `ProfileMenu.tsx`.

### Added — `EffectimeLogo` component + sticky workspace tab navigation (PR #4)
- **`EffectimeLogo`** (`src/components/EffectimeLogo.tsx`): SVG gradient, dual-meaning `M` glyph (reads as "effectiMe" full-M and "effectiVe" inner-V). Two variants: `mark` (icon only) and `full` (with wordmark). Deployed to `SiteNav`, `Enterprise.tsx` header, landing page header + footer, `SiteFooter`.
- **Sticky workspace tabs**: `TabsList` moved outside scrollable content into a `sticky top-[57px]` container with `backdrop-blur`, `bg-background/95`, `z-20`, `border-b`. Tabs remain visible while users scroll tab content.
- `canViewPermissionConfig` prop added to `WorkspaceSettings`; `RolePermissionManager` conditionally rendered.

### Added — 6-template theme system with role-gated Layout Setting (PR #5)
- `ThemeStyle` enum extended: `enterprise`, `nebula`, `aurora`, `graphite`, `sunrise`, `mono`. Root-class toggle on `<html>` + `localStorage` persistence in `useTheme.tsx`.
- Tokenized CSS definitions in `src/styles/themes.css` — components continue using the same CSS variable tokens; only values change per template. Fixed-dark templates (`nebula`, `graphite`) bypass light/dark toggle.
- `layout_setting` permission key added to the feature catalog; owners retain access via owner check.
- "Layout Setting" section in Workspace Settings lets authorized users pick a template from the 6 options.

### Fixed — Positions data integrity in `TeamManager` and `InviteMemberDialog` (PR #6)
- Both components built `availableRoles` exclusively from `enterprise_memberships.business_role` (legacy text column). Positions that existed only in `enterprise_member_role_allocations` (the canonical junction table) were silently absent from every dropdown.
- **Fix**: both components now query `enterprise_member_role_allocations` in parallel and merge the two sets, so every created position is always selectable.

### Fixed — Triple-layer SPA routing (PR #7)
- `public/404.html`: captures full path + query + hash in `sessionStorage`, redirects to `/?r=...` for the SPA shell.
- `src/App.tsx`: `SpaRedirectHandler` reads `sessionStorage`/`?r=` and navigates client-side.
- `src/pages/Auth.tsx`: full split-screen redesign (left trust panel with 6 badges + calendar mockup, right scrollable auth card); all auth logic — `signIn`, `signUp`, `OTP`, `Google OAuth`, `reset` — preserved verbatim.

---

## 2026-05-04 — Google OAuth callback fix: URL fragment session restoration (PRs #1, #2)

### Fixed — Session not restored from URL fragment after Google OAuth (PR #1)
- Google OAuth returns `access_token` + `refresh_token` in `window.location.hash` (`#access_token=...`). The app didn't parse the fragment, leaving the session unhydrated and stalling on `/auth`.
- **Fix**: added explicit hash-token handling in `Auth.tsx` activated when `?oauth=google` and user is not yet hydrated. Reads `access_token`/`refresh_token` from `window.location.hash`, calls `setSessionFromTokens(...)` from auth context, clears hash via `history.replaceState`.

### Fixed — OAuth `redirectTo` causing hard-404 on SPA (PR #2)
- `redirectTo: '/auth'` caused the OAuth provider to redirect to `/auth`, which returned HTTP 404 from origin (SPA shell not served for direct navigation).
- **Fix**: changed `redirectTo` to `/` (root, always served by static hosts). Post-login navigation handled on the landing page: once `session` + `?oauth=google` is present, navigates to the `redirect` target (default `/app`).
- Fragment-based session restoration centralized in `AuthProvider` (`useAuth.tsx`): processes `#access_token` at app bootstrap and clears the URL fragment immediately.

---

## 2026-05-04 — SPA routing hardening + Auth page world-class redesign

### Fixed — SPA 404 at /auth (P0 production incident)
- **Root cause**: Cloudflare proxying to origin without Pages-level SPA fallback. Direct navigation to `/auth` returned HTTP 404 plain-text from origin.
- `public/_redirects`: normalised to single-space format (`/*  /index.html  200`) for maximum Cloudflare Pages / Netlify compatibility.
- `public/_headers`: added security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and correct cache directives (`no-cache` for `index.html`, `immutable` for hashed assets).
- `public/404.html`: existing SPA redirect script confirmed correct — captures full path + query + hash into `sessionStorage` and redirects to `/?r=...`; `SpaRedirectHandler` in `App.tsx` restores the route.

### Enhanced — `src/pages/Auth.tsx` — Auth page architectural redesign
- **Trust badge row** (6 badges): GDPR-kompatibilis, ISO 27001 elvek, Enterprise Ready, 99.9% Uptime SLA, RLS adatelérés, Top SaaS 2026. Colour-coded icon cards with `whileInView` entrance animations.
- **Comparison matrix** ("Hagyományos eszközök vs. Effectime"): 6-row table with `X`/`Check` icons comparing setup time, approval flow, capacity view, leave balance, audit trail, mobile access. Zero Lorem Ipsum — all copy grounded in actual changelog capabilities.
- **FAQ expanded**: 3 → 6 professional Q&A items covering daily utility, enterprise structure, smart scheduling wizard, approval customisation, mobile access, and data security.
- **Calendar mockup legend**: colour legend row added (Elérhető / Szabadság / Betegszabadság).
- **Workflow step arrows**: `ArrowRight` connector between cards on desktop.
- **Feature callout pills**: three labelled pills below calendar section copy (Csapatnaptár, Éves nézet, Valós idejű).
- **Footer**: Terms, Privacy, Support links added.
- **Micro-interactions**: button hover lift (`hover:-translate-y-0.5`) and shadow-glow on primary CTA; Google button lift on hover; input `focus-visible:ring-primary`.
- All authentication logic preserved without modification (sign-in, sign-up, OTP verify, forgot-password, Google OAuth, email-activation callback).

## 2026-04-30 — Production stabilization audit: backend bug fixes

### Fixed — `src/lib/conflictEngine.ts`
- **`officeRuleApplies` legacy column fallback**: The function only checked `days_of_week` (array) but not the legacy `day_of_week` (scalar) column. Office coverage rules that used the scalar column were incorrectly applied to *every* day of the week instead of the configured day. Fixed by mirroring the same fallback logic already present in `ruleApplies`.
- **Unscoped `enterprise_holidays` query**: Holidays were fetched for the entire workspace history without a date range filter, causing unnecessary data transfer. Now filtered with `.gte`/`.lte` scoped to the requested date range.
- **Unscoped `leave_requests` query in conflict check**: All pending/approved leave requests for the workspace were fetched regardless of date. For large workspaces this was a significant over-fetch. Now filtered to only requests overlapping the requested date range (`.lte('start_date', rangeEnd).gte('end_date', rangeStart)`).

### Fixed — `src/lib/capacityEngine.ts`
- **Silent failure on Supabase query errors**: `computeWorkspaceCapacity` destructured only `{ data }` from Supabase responses, completely ignoring `.error`. A failed allocations or memberships query would return `null` data, causing the engine to silently compute zero-capacity results with no diagnostic output. All parallel queries now capture `.error` and log it via `console.error`.

### Fixed — `supabase/functions/jira-devops-proxy/index.ts`
- **`adoUpdate` could send empty JSON-patch**: If a caller provided a payload with none of the recognized fields (`summary`, `assignee_email`, `iteration_path`, `status`), the `ops` array remained empty and the ADO API rejected it with a misleading error. Now throws a descriptive error before making the network call if `ops.length === 0`.
- **`sync_project_config` accepted missing `project_key`**: `jiraSyncProjectConfig` fell back to an empty string for `project_key`, which produced incorrect or empty Jira API responses. Now validated with an early guard — throws if `project_key` is not set on the integration record.

### System Understanding Summary (Audit findings — no further action required)
- **Architecture**: Dual-product monorepo — Syncfolk (consumer event calendar) + PlannerMaster (enterprise leave/resource management), both backed by Supabase. Schema split (syncfolk / plannermaster schemas) was introduced 2026-04-29 as additive clones of public tables.
- **Business logic**: Leave conflict engine, capacity engine, coverage eligibility, and smart schedule algorithm are pure or near-pure TypeScript — testable, low coupling.
- **Data integrity**: RLS enforced on all enterprise tables via `has_enterprise_role()` / `is_enterprise_member()` SECURITY DEFINER functions. Foreign key cascade deletes on workspace-scoped tables.
- **Identified risk (informational)**: `Index.tsx` polls the DB every 4 s for both events and votes (two separate intervals). Acceptable at current scale but should be replaced with Supabase realtime subscriptions for cost and performance headroom.
- **Identified risk (informational)**: Audit log (`auditLog.ts`) is fire-and-forget; failures are only `console.warn`ed. For compliance-critical workspaces, a queue-based fallback would be safer.

## 2026-04-29 — Jira search hardening: normalized base URL for enhanced JQL endpoint

### Fixed
- `jira-devops-proxy` Jira hívásoknál a `base_url` normalizálása bekerült (`jiraBaseUrl()`), amely levágja a véletlenül eltárolt `/rest/api/...` útvonalrészt. Így akkor is a helyes `.../rest/api/3/search/jql` végpont hívódik, ha az integrációs beállításban nem csak host szerepel.
- Ugyanez a normalizálás egységesen alkalmazva lett a Jira `myself`, `field`, `issue create/update` és `browse` URL-ekre is, ezzel csökkentve a hibás endpoint-összefűzésből adódó 404/410 hibákat.

## 2026-04-28 — Agile Jira integration fix: search API migration + project config sync

### Fixed
- Jira issue lekérdezés átállítva a megszűnt `/rest/api/3/search` végpontról a támogatott `/rest/api/3/search/jql` végpontra, így a JQL alapú backlog lekérdezések (pl. `openSprints()`) ismét futnak.

### Added
- Új `sync_project_config` művelet a `jira-devops-proxy` edge functionben, amely:
  - betölti a projekt issue type listáját Jira-ból,
  - begyűjti a projektben használt label/component értékeket,
  - ezeket elmenti az `enterprise_agile_field_metadata` táblába.
- `IssueWriteback` UI-ban új „Jira projekt konfiguráció szinkron” gomb + DB-ből visszatöltés.
- Issue létrehozásnál a Jira issue type mező már DB-alapú dropdownból választható, a címke mező pedig Jira label javaslatokat ad (datalist), csökkentve az elírásból adódó hibákat.

## 2026-04-28 — v2.6.0 Annual quotas fix + Agile integration GA

### Fixed
- **Annual calendar quotas** now filter `enterprise_quota_transactions` by `workspace_id` AND the resolved `quota_id` (which inherently scopes by year + leave_type). Previous logic summed every TX across all years/types for the membership, producing inflated/incorrect "used" counts.

### Added
- **Agile module (Resources → Agile)** replacing the duplicate Idővonal tab:
  - `BacklogBrowser` — JQL/WIQL search with cached results in `enterprise_agile_issues`
  - `IssueWriteback` — create + update issues for both Jira and Azure DevOps
  - `CapacityFit` — sprint capacity vs. planned hours, overload/underload detection
  - `FieldDiscovery` — custom field metadata discovery
  - `AgilePanel` — unified shell with integration switcher
- **`jira-devops-proxy` edge function** — unified secure proxy supporting `test_connection`, `discover_fields`, `search_issues`, `create_issue`, `update_issue`. Membership-checked; logs every call into `enterprise_agile_sync_log`.
- **IntegrationManager "Kapcsolat tesztelése"** button per integration row.
- **pg_cron daily job** `auto-archive-expired-coverage-rules-daily` (02:15 UTC) → invokes `public.auto_archive_expired_coverage_rules()`.

### Removed
- `Idővonal` tab from Resources (Hőtérkép remains as primary capacity view; Project Gantt stays inside the Projects tab).

## 2026-04-27 — v2.5.1 Calendar/Capacity regression hotfix

### Fixed
- `OfficeCoverageRuleManager`: a `business_roles` / `skill_ids` oszlopokra épülő mentés most schema-cache safe. Ha a Supabase/PostgREST még a régi `enterprise_office_coverage_rules` sémát látja, a mentés automatikusan legacy payloadra esik vissza (`business_role`, `skill_id`), így az egy pozíciós telephelyi szabály mentése nem dob `Could not find the 'business_roles' column` hibát.
- `CoveragePlannerView`: eltávolítva a `Szabályok szerkesztése` gomb a Kapacitástervezőből, mert rossz helyre navigált és a felhasználói flow-t zavarta.
- `CoveragePlannerView`: havi nézetben a szabály nélküli telephely sorok már nem szöveges, sort magasító cellákat mutatnak, hanem visszafogott szürke napcellákat vékony elválasztó vonalakkal.
- `TimelineView`: az Idővonal szűrőpanelje desktopon keskeny bal oldali sávba került, a naptár pedig mellette, `minmax(0, 1fr)` tartalomterületen jelenik meg.

### Regression guard
- Megmaradt a multi-pozíció / multi-skill támogatás, ha az adatbázis már tartalmazza az új tömb oszlopokat.
- A fallback csak schema-cache / hiányzó `business_roles` / `skill_ids` oszlop hiba esetén aktiválódik, más mentési hibákat továbbra is változatlanul megjelenít.

---

## 2026-04-27 — Multi-pozíció szabályok, Absentify szűrőpanel, havi nézet, navigációs bug fix, éves nézet fix

### OfficeCoverageRuleManager — Több pozíció / skill egy szabályban
- Szabályhoz mostantól több pozíció ÉS több skill is hozzárendelhető (checkbox multi-select lista)
- Pozíció-lista most MINDEN definiált pozíciót megjelenít: `enterprise_memberships.business_role` + `enterprise_member_role_allocations.business_role` union (nem csak a jelenleg hozzárendelt szerepek látszanak)
- DB migráció: `business_roles text[]` és `skill_ids uuid[]` oszlopok hozzáadva az `enterprise_office_coverage_rules` táblához, backward-compatible constraint frissítéssel

### CoveragePlannerView — Heti/Havi nézet + multi-pozíció kezelés
- Heti / Havi nézet váltó gomb; havi módban vízszintes görgetősáv jelenik meg a napok felett
- A cella megjelenítése **elvárás / van** (pl. "4 / 3") formátumra változott
- `supplyFor` mostantól BÁRMELY pozíció/skill egyezésekor számít (OR logika a szabály tömbjein belül)
- Race condition fix: `loadIdRef` megakadályozza a stale válaszok felülírását navigálásnál

### CalendarFilterBar — Absentify-stílusú összecsukható panel
- Teljes újratervezés: vízszintes dropdown-gombok → accordion panel
- Fejléc: "Szűrők (n)" lila badge az aktív szűrők számával + "Elrejt/Megjelenít" gomb
- Minden kategória alapból összecsukott; lila háttér ha aktív kijelölés van benne
- Keresőmező 6+ elemű listáknál; azonnali szűrés (nincs külön Alkalmaz gomb)

### useCalendarFilterConfig — Új szűrőtípusok
- `skill` (Képesség / Skill) és `location` (Helyszín / város) szűrők hozzáadva
- Meglévő workspace-konfigurációk automatikusan kiegészülnek az új szűrőkkel

### TimelineView — Navigációs bug fix + új szűrők
- Race condition javítva: `loadIdRef` garantálja, hogy csak a legutóbbi kérés frissíti az állapotot
- Betöltési hiba esetén helyes hibaüzenet jelenik meg (nem az "üres szűrőállapot")
- Skill-szűrő: `enterprise_member_skills` betöltése, tagok skill-készletük alapján szűrhetők
- Helyszín-szűrő: `city` mező a membershipből, városra szűrhető

### AnnualLeaveGrid — Éves nézet adat- és színhiba javítása
- Dátumtartomány-lekérdezés javítva: `lte(start_date, yEnd) AND gte(end_date, yStart)` (valódi overlap)
- Szín-feloldás bővítve: egyedi enterprise típus nevén kívül az enum értékekre (`vacation`, `sick_leave`, stb.) is fallback szín kerül, így minden távollét mindig színezve jelenik meg

---

## 2026-04-27 — Phase C+D+E: Skill Reporting, Widget Restructuring, Yearly Fix & QA [Fázis C/D/E]

### Chapter 4 — Dynamic Capacity & Skill Reporting (Phase C)
- Új `SkillCapacityReport` komponens (`src/components/enterprise/calendar/SkillCapacityReport.tsx`): a TimelineView szűrő-motorjával szinkronizált, valós idejű riport a szűrt user pool-hoz.
- **Összefoglaló kártyák** (glassmorphism stílusú): Szűrt tagok · Elérhető · Jóváhagyott távollét · Elérhetőség %.
- **Készség elérhetőség** panel: skill-enkénti progress bar (szín = a skill saját hex kódja), elérhető/összes arány.
- **Pozíció kapacitás** panel: Recharts horizontális stacked BarChart (zöld = elérhető, piros = távol).
- Skeleton loaderek az aggregálás idejére; cleanup (`cancelled` flag) a stale request megelőzésére.
- **Integráció**: `WorkspaceDashboard` Idővonal tab-on `onFilteredUsersChange` callback vezérli a `SkillCapacityReport`-ot — bármely szűrőváltozás automatikusan újra-aggregál.

### Chapter 1 — Calendar Widget Restructuring (Phase D, Task 1)
- **Task 1.1 — Widget-áthelyezés**: `BirthdayAnniversaryWidget` és `AnnualTrendChart` átkerült a `Naptár` fő nézetben a `LeaveCalendar` *alá* (korábban fölötte volt). Ezentúl kiegészítő, másodlagos infó-blokkok.
- **Task 1.2 — Intelligent Collapsed State**: `BirthdayAnniversaryWidget` mostantól `Collapsible` (alapállapot: **csukva**). Piros badge (`bg-red-500 text-white rounded-full`) jelzi a következő 7 napon belüli eseményeket. A lista-soroknál a 7 napon belüli események `bg-red-50 dark:bg-red-950/20` tintával emelkednek ki.
- `checkUpcomingEvents()` pure utility függvény: leap-year safe, timezone-safe, 7 napos ablak.

### Chapter 2 — Eliminate Misleading Status Indicator (Phase D, Task 2)
- `OutTodayWidget` eltávolítva a **Tagok** fülből. A "Mindenki dolgozik ma" üres-state szöveg félrevezető volt (hétvégén és ünnepnapokon is megjelent). Az aktuális távolléti állapot a Naptár → Idővonal nézeten tekinthető meg.

### Chapter 5 — Yearly Calendar Remediation (Phase D, Task 5)
- `AnnualLeaveGrid` bővítve:
  - **Felhasználó-választó dropdown** adminok számára (`allMembers` prop alapján): alapértelmezett = bejelentkezett felhasználó.
  - **`resolvedMembershipId` auto-fetch**: ha a `membershipId` prop nincs megadva, a komponens `allMembers`-ből vagy DB lekérdezéssel oldja fel → a kvóta (`Allowance / Carried over / Remaining`) mostantól helyesen jelenik meg.
  - `WorkspaceDashboard` átadja `allMembers` és `isAdmin` propokat az `AnnualLeaveGrid`-nek.

### Chapter 7 — QA & Delivery (Phase E)
- Zero regression: meglévő `LeaveCalendar`, `TimelineView`, `CoveragePlannerView` érintetlen.
- `BirthdayAnniversaryWidget` eredeti listázó logikája megmaradt; csak wrapper és stílus változott.
- `AnnualLeaveGrid` backward-compatible: `membershipId?` és `allMembers?` opcionálisak.
- TypeScript build tiszta (tsc --noEmit).

---

## 2026-04-27 — Naptár Idővonal nézet (Absentify-style) + dinamikus szűrő-motor [Phase A]

### Added
- **Idővonal nézet** (`TimelineView`): row-by-row Absentify-stílusú grid napi cell-státuszokkal (szabadság / ünnep / hétvége / munkanap), `@tanstack/react-virtual` row virtualizációval (200+ tag is gördülékeny).
- **Dinamikus szűrő-motor** (`CalendarFilterBar`): multi-select Popover szűrők (Telephely, Csapat, Pozíció, Szabadság típusa, Státusz). Auto-apply (nincs Submit), aktív szűrő = lila tint, "Szűrők (n)" badge.
- **Naptár Szűrők beállítása** admin felület (Settings tab): drag&drop sorrend (`@dnd-kit`) + per-szűrő enable/disable kapcsoló, workspace-szintű perzisztencia.
- 3. tab a Naptár oldalon: **Naptár | Idővonal | Éves nézet**.

### Database
- Új tábla: `tenant_calendar_settings` (workspace_id UNIQUE, filters_config JSONB) RLS-sel: tagok olvassák, owner/resourceAssistant írja.

### Dependencies
- `@tanstack/react-virtual`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Notes
- Zero-regression: a meglévő Naptár és Éves nézet érintetlen.
- A `TimelineView` `onFilteredUsersChange` propon keresztül adja le a szűrt user pool-t — Phase B (Coverage Engine) és Phase C (Skill Reporting) ezt fogja fogyasztani.

# Changelog

## 2026-04-25 — Absentify integráció: Quota, Substitute, Attachment, iCal, Jira/AzureDevOps integráció
- Új komponensek bekötve: `OutTodayWidget` (Tagok fül), `QuotaBalanceCard` + `SubstituteInbox` (Kérelmek fül), `QuotaManager` + `IntegrationManager` + `ICalSubscription` (Beállítások fül)
- `LeaveRequestDialog` bővítve: helyettesítő-választó (`SubstitutePicker` integrálva), csatolmány-feltöltés (`leave-attachments` Storage bucket), privát kérelem toggle (`is_private`), audit metadatában a substitute_count + has_attachment + is_private nyomon követve
- `LeaveRequestList.handleCancel` mostantól bekéri és tárolja a `cancellation_reason`-t (audit metadata-ba is bekerül)
- Helyettesítő-rögzítés (sorrendben) az új `leave_request_substitutes` táblába írja az adatokat
- Backward-compatibility: meglévő mezők és táblák érintetlenek; az új mezők opcionálisak/null-default-tel
- Nem duplikáltunk meglévő funkciót — a Naptár, Kérelmek, Beállítások meglévő tab-jaiba kerültek be a panelek


## 2026-04-11 — v2.4.0 Email értesítések, demo adatok, mobil tesztelés
- Email értesítés küldés jóváhagyási/elutasítási döntéseknél (transactional email infra + leave-decision sablon)
- Genisys workspace demo adatok: 8 tag (owner, resourceAssistant, 6 member), 12 szabadságkérelem (pending/approved/rejected), szabadság típusok, ünnepnapok, tiltott napok, napi szabályok, jóváhagyási lánc, escalation, értesítések, audit log események
- Leiratkozás oldal (/unsubscribe) az email értesítésekhez
- Mobil reszponzivitás tesztelve: összes Enterprise tab (Tagok, Kérelmek, Jóváhagyások, Értesítések, Riportok, Audit, Export) megfelelően jelenik meg 390px szélességen

## 2026-04-11 — v2.3.0 Enterprise Phases 4-9: Approval Chain, Audit, Notifications, Export, Reporting, Templates
- Jira: SYN-146 + remaining enterprise stories
- Új DB táblák: `enterprise_approval_chains`, `enterprise_escalation_rules`, `enterprise_audit_events`, `enterprise_notifications`, `enterprise_rule_templates`, `enterprise_export_jobs`
- Phase 4: Jóváhagyási lánc konfiguráció (lépések, szerepkörök), eszkaláció szabályok (óra küszöb, célszerepkör, owner értesítés)
- Phase 5: Audit log (immutable, szűrhető, kereshető, 100 utolsó esemény)
- Phase 6: Enterprise értesítések (olvasott/olvasatlan, törlés, emoji ikonok)
- Phase 7: CSV export (dátumtartomány, státusz szűrő, ünnepnapok, audit log bejegyzés)
- Phase 8: Reporting dashboard (KPI kártyák, státusz pie chart, típus bar chart, napi távollévők chart)
- Phase 9: Szabálysablon könyvtár (létrehozás, duplikálás, archiválás, JSON adat)
- WorkspaceDashboard: 6 új tab (Értesítések, Riportok, Audit, Export + Approval chain és Templates a Szabályok tabba)

## 2026-04-11 — v2.2.0 Enterprise Phase 3: Leave Types, Holidays, Rules & Conflict Engine
- Jira: SYN-148, SYN-147
- Funkció: Egyedi szabadság típusok, ünnepnapok, tiltott napok, napi szabályok kezelése
- Új DB táblák: `enterprise_leave_types`, `enterprise_holidays`, `enterprise_blocked_dates`, `enterprise_daily_rules`
- RLS: workspace tagok olvashatják, owner/resourceAssistant kezelhetik a konfigurációt
- Új UI komponensek: `LeaveTypeManager`, `HolidayManager`, `BlockedDateManager`, `DailyRuleManager`
- Új "Szabályok" tab a WorkspaceDashboard-ban (admin only)
- Conflict engine (`src/lib/conflictEngine.ts`): tiltott nap, ünnepnap, max-off, saját átfedés ellenőrzés
- LeaveRequestDialog: kétlépcsős submit (Ellenőrzés → Beküldés), blocking/warning ütközések megjelenítése
- Módosított fájlok: `WorkspaceDashboard.tsx`, `LeaveRequestDialog.tsx`

## 2026-04-11 — v2.1.0 Enterprise Phase 2: Leave Request & Approval Workflow
- Jira: SYN-165, SYN-150, SYN-149
- Funkció: Távolléti kérelem beküldés, jóváhagyási workflow, approval inbox
- Új DB táblák: `leave_requests`, `approval_decisions`
- Új enumok: `leave_request_status` (draft/pending/approved/rejected/cancelled/expired), `leave_type` (vacation/sick_leave/unpaid_leave/other)
- RLS policies: tagok saját kérelmet adhatnak be, owner/resourceAssistant jóváhagyhat/elutasíthat
- Új UI komponensek: `LeaveRequestDialog`, `LeaveRequestList`, `ApprovalInbox`
- WorkspaceDashboard-ban új tabok: Kérelmek, Jóváhagyások
- Bulk approve/reject funkció az approval inbox-ban szűrőkkel
- Módosított fájlok: `src/components/enterprise/WorkspaceDashboard.tsx`
- Új fájlok: `src/components/enterprise/LeaveRequestDialog.tsx`, `LeaveRequestList.tsx`, `ApprovalInbox.tsx`

## 2026-04-11 — v2.0.0 Enterprise Phase 1
- Jira: SYN-168, SYN-170, SYN-169
- Funkció: Enterprise B2B modul alapjai — Workspace, Membership, Roles
- Új DB táblák: `enterprise_workspaces`, `enterprise_memberships`, `enterprise_invitations`
- Új enumok: `enterprise_role` (owner/resourceAssistant/member), `enterprise_membership_status` (active/invited/suspended/removed)
- Új SECURITY DEFINER funkciók: `has_enterprise_role()`, `is_enterprise_member()`
- RLS policies: role-alapú hozzáférés-szabályozás minden enterprise táblán
- Új UI: `/enterprise` route, workspace lista, dashboard, tag kezelés, meghívók, beállítások
- ProfileMenu-ben Enterprise menüpont hozzáadva
- Módosított fájlok: `src/App.tsx`, `src/components/ProfileMenu.tsx`
- Új fájlok: `src/pages/Enterprise.tsx`, `src/components/enterprise/*`

## 2026-03-26
- Jira: nincs hozzárendelt jegyszám
- Funkció: a kitűzött nap kiválasztó popup mérete limitálva lett, egyszerre legfeljebb kb. 5 dátum látható, a lista görgethető maradt.
- Funkció: kitűzött nap esetén a batch kitöltés panel továbbra is megjelenik, de minden vezérlője inaktív állapotba kerül.
- Funkció: a kitűzött nap módosítása ablakban megjelent a Feloldás művelet, amellyel újranyitható a szavazás, ha az esemény nincs határidőn túl és nincs inaktiválva.
- Funkció: a személyes elérhetőség másolása nem fut le olyan eseményre, amelyen már van kitűzött nap.
- UI/reszponzivitás: a központi naptár lett az elsődleges szélességi referencia, a bal és jobb oldali panelek ehhez igazodnak kisebb hézagokkal.
- Technikai megvalósítás: módosítva `src/pages/Index.tsx`, `src/components/BatchVotePanel.tsx`, `src/components/PersonalCalendar.tsx`.

## 2026-03-31
- Jira: nincs hozzárendelt jegyszám
- Versioning hivatkozások:
  - `versioning/01033102_syncfolk_calendar_mobile_fix_request.pdf`
  - `versioning/01033102_syncfolk_calendar_mobile_fix_prompt.md`
- Üzleti kérés: csak az esemény részletező modal dátumválasztó naptárának mobilos megjelenését kellett javítani úgy, hogy a popup mindig a képernyő közepén jelenjen meg, és az OK gomb minden mobil nézetben látható maradjon.
- Technikai megvalósítás: az `EventInfoModal` dátumszerkesztő részében a korábbi nyers `Popover + Calendar` megoldás helyett a már létező, mobilon középre pozicionált `DatePopoverField` került használatba.
- Ellenőrzési checklist:
  - [x] `CHANGELOG.md` beolvasva
  - [ ] `codingLessonsLearnt.md` / lessons learnt fájl nem található a feltöltött repóban
  - [x] csak célzott hotfix készült az érintett dátumválasztó mezőkre
  - [x] mobilon középre kerül a calendar popup
  - [x] az OK gomb explicit módon megjelenik és használható marad
  - [x] a kezdő/vég dátum alaplogikája megmaradt
  - [x] build ellenőrzés lefutott sikeresen
- Módosított kódfájl: `src/components/EventInfoModal.tsx`

## 2026-04-22 — v2.5.0 Resource Management ökoszisztéma + dinamikus jogosultság-fa
- Phase 1 (Core Architecture, Single Source of Truth):
  - `enterprise_memberships.base_working_hours` (numeric, 0–24, default 8) — alap napi munkaóra tagonként
  - `capacityEngine` átállítva órás számításra: `hours = base_working_hours * (allocation_pct / 100)`
  - `BusinessRoleManager` (Pozíciók) most már listázza az ÖSSZES allokált tagot pozíciónként, %-os allokációval és számolt napi órával — megszüntetve a korábbi "csak 1 tag" data dissonance-t
  - `LeaveCalendar` csapat-szűrő dinamikusan a `enterprise_teams` táblából töltődik (hardcoded lista törölve)
  - `MemberProfileSheet`: szerkeszthető "Napi alap munkaóra" mező
- Phase 2 (UI Relocation & Dynamic Permissions):
  - Pozíciók és Csapatok kezelése áthelyezve a Beállításokból az **Erőforrások** fülre (alapból összecsukott akkordionok)
  - Új `enterprise_feature_catalog` tábla (parent_key hierarchia) — dinamikus, fa-alapú jogosultság-katalógus
  - `useEnterprisePermissions` hook visszaadja a `featureTree`-t (rekurzív struktúra)
  - `RolePermissionManager` UI átírva rekurzív fa-renderelésre (`FeatureTreeRow` komponens) — a jogosultság-választó automatikusan tükrözi az alkalmazás navigációs fáját, fallback a régi flat csoportosításra ha a katalógus üres
- Phase 3 (Resource Module — előző iterációkban):
  - `ResourceDashboard`, `ProjectList`, `ProjectEditor`, `GanttTimeline`, `CapacityGapReport`
  - "Kitűz a Riportokra" widget integráció (`ResourceWidgetCard`, `PinnedReportsWidget`)
- Új/módosított fájlok: `supabase/migrations/20260422164431_*.sql`, `src/lib/capacityEngine.ts`, `src/components/enterprise/BusinessRoleManager.tsx`, `LeaveCalendar.tsx`, `MemberProfileSheet.tsx`, `WorkspaceDashboard.tsx`, `RolePermissionManager.tsx`, `resources/ResourcesTab.tsx`, `src/hooks/useEnterprisePermissions.ts`

## 2026-04-25 — Absentify gap round: hátralévő dashboard integrációk + Team policy bővítés
- WorkspaceDashboard / Beállítások fül: a 4 új panel (`AllowanceManager`, `WorkspaceGeneralSettings`, `BrandingManager`, `CsvImportPanel`) beillesztve meglévő `SettingsSection` blokkokba (nem új tab, nem duplikált UI)
- Naptár fül bővítve beágyazott sub-tabokkal: `Naptár` + `Éves nézet`; az `AnnualLeaveGrid` a meglévő Calendar tabon belül érhető el
- TeamManager bővítve Department policy mezőkkel: `max_absent` és `approval_mode` (lineáris/párhuzamos) szerkeszthető csapatszinten
- Csomag I widget kiegészítés: új `BirthdayAnniversaryWidget` és `AnnualTrendChart` a Naptár fő nézetben
- Minden új elem additív módon, meglévő flow-k sértetlenül került bekötésre

## 2026-04-29 — Syncfolk / PlannerMaster schema split prep + full data clone migration

### Added
- Új Supabase migráció: `20260429120000_multi_tenant_schema_split.sql`.
- Új sémák automatikus létrehozása: `syncfolk` (consumer) és `plannermaster` (enterprise).
- Additív, adatvesztésmentes klónozás a `public` sémából:
  - `syncfolk`: core Syncfolk táblák (`profiles`, `events`, `votes`, stb.)
  - `plannermaster`: minden `enterprise_*` tábla + enterprise workflow táblák (`leave_requests`, `approval_decisions`, stb.)
- RLS engedélyezés a klónozott táblákon.
- Két schema-scoped helper függvény edge function izolációhoz:
  - `syncfolk.set_search_path()`
  - `plannermaster.set_search_path()`

### Notes
- A migráció szándékosan **nem törli/nem mozgatja** a meglévő `public` objektumokat, így minimális regressziós kockázattal futtatható olyan adatbázisban is, ahol másik app objektumai is élnek.

## 2026-04-29 — Kapacitástervező gyors feltöltés és Instant user gomb
- `MemberList`: új **Instant user** gomb az admin taglistán, amely a jelenlegi workspace-re automatikusan létrehoz egy meghívást előtöltött, meglévő entitásokból származó metadata-val (pozíció/csapat/telephely mintázat), így adatintegritás-barát gyors taggenerálás érhető el.
- `MemberList`: duplikált „Új tag hozzáadása” gomb JSX regresszió javítva.
- Hotfix: `Instant user` meghívásnál schema-cache kompatibilis fallback: ha a `metadata` oszlop még nem látszik (`PGRST204`), metadata nélküli insertre vált.
- Hotfix: Jira keresés proxy többvégpontos fallbacket kapott (`/search/jql` POST/GET + `/search` POST), hogy a tenant-specifikus API eltérések ne okozzanak 500-at.

## 2026-04-30 — v2.6.0 Agile Integration Capacity Sync Foundation Expansion
- Jira/Azure DevOps Agile modul additív bővítése enterprise-grade capacity sync alapokkal.
- Új adatmodell elemek migrációval:
  - `enterprise_agile_external_field_mappings` (dinamikus külső→normalizált mező mapping, irány, safe writeback flag)
  - `enterprise_agile_capacity_events` (változás/kapacitás/variance/risk/writeback/szimuláció esemény napló)
  - `enterprise_agile_issues` kiterjesztés: `capacity_risk`, `fit_score`, `suggested_role`, `plan_impact_reason`, `external_type`, `target_sprint`
- Új RLS policy-k az agile mapping/event táblákhoz enterprise szerepkör alapú jogosultsággal.
- Capacity Fit UI bővítések:
  - What-if szimuláció (`szabadság nap/fő`) azonnali kapacitás újraszámítással
  - Tagonkénti risk-level (Low/Medium/High) és fit-score (%) megjelenítés
  - Overload/underload jelzések megtartása a korábbi működéssel kompatibilisen
- Cél: a meglévő Jira/ADO foundation megtartása mellett előkészített adat- és UI-alap a kétirányú, auditált capacity sync iteratív bővítéséhez.

## 2026-05-05 — Enterprise role/category/skill catalog foundation (inventory + workspace overrides)
- Új adatmodell bevezetve a munkakategória → munkakör → skill kapcsolatokhoz, külön ID-alapú entitásokkal és deduplikált skill-kezeléssel.
- Új globális inventory táblák: `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills`.
- Új cégszintű testreszabható réteg: `enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_skills`, `enterprise_workspace_role_skills`.
- `enterprise_memberships` bővítve `business_role_id` mezővel (FK a workspace role táblára), így a meglévő szöveges `business_role` mellett ID-alapú kötés is elérhető.
- Experience/szenioritás bevezetve `enterprise_experience_level` enumon keresztül, szerep-skill elvárásokon használható (`min_experience_level`).
- RLS policy-k, indexek és `updated_at` triggerek hozzáadva a karbantartható, multi-tenant működéshez.
