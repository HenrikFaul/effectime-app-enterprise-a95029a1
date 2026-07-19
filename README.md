# Effectime Enterprise

Effectime is a Hungarian-first workforce and capacity-management application.
The production web application is available at [effectime.app](https://effectime.app/).
It includes workspace and member administration, RBAC, leave and approval flows,
calendar and capacity planning, time attendance and payroll preparation, resource
and project management, Jira/Azure DevOps integration, reports, analytics,
developer API/webhooks, security administration, and PWA support.

## Architecture

- **Web client:** React 18, TypeScript, Vite, React Router, TanStack Query,
  Tailwind CSS and Radix/shadcn components.
- **Backend:** Supabase Auth, PostgreSQL/RLS, Storage, RPCs, Edge Functions and
  scheduled jobs.
- **Application entry points:** `/` (public site), `/auth`, `/app`, and
  `/w/:workspaceId` (workspace shell). Public invite, calendar-feed and embed
  routes are mounted separately in `src/App.tsx`.
- **Native/PWA:** the web app registers a service worker and exposes an install
  prompt. Version-controlled Capacitor 8 Android and iOS projects package the
  same React source as a CSP-hardened `dist-mobile` artifact and use the same
  Supabase Auth/PostgreSQL/RLS/RPC/Edge data platform as the web client. Native
  auth uses PKCE, the system browser and Keychain/AndroidKeyStore-backed session
  storage configured and contract-tested in source; physical-device storage
  behavior is not yet verified. The PWA worker/install lifecycle is disabled
  inside native runtimes. M365 connection is fail-closed and explicitly disabled
  on native until a reviewed system-browser callback flow exists.
  Store release blockers and platform setup are documented in
  [`docs/mobile/README.md`](docs/mobile/README.md).
- **Deploy configuration:** `vercel.json`, `public/_headers`, `public/_redirects`,
  `supabase/config.toml`, migrations and Edge Function sources live in this repo.

The detailed evidence, requirement traceability matrix and known release blockers
are maintained in [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md).

## Local development

Prerequisites:

- Node.js 22.9 or newer
- npm 11 (the pinned package-manager version is in `package.json`)
- Supabase CLI only for local/linked backend work

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Only public browser configuration belongs in `.env.local`. Never place a service
role key, OAuth client secret, webhook signing secret, provider token or private
API credential in a `VITE_*` variable.

## Verification

```sh
npm run typecheck
npm run mobile:check:source
npm run mobile:sync
npm run mobile:check
npm run test:e2e:mobile:built
npm run test:coverage
npm run build
npm run bundle:check
npm run lint:ratchet
npm run security:secrets
npm run schema:provenance:test
npm run schema:provenance
npm run db:payroll:test
npm run db:hr-workflow:test
npm run edge:check
npm run edge:log-safety
npm run edge:ratchet:test
npm run edge:ratchet
npm run edge:test
npm run test:e2e
npm run release:sbom
npm run release:sbom:edge:test
npm run release:manifest
```

## Android and iOS development

The native clients do not have a separate database or privileged mobile API.
`npm run mobile:sync` builds one CSP-hardened mobile artifact from the shared
React source and copies that exact artifact plus the selected public Supabase
configuration into both platform projects. The public web artifact remains
separate so its SEO/PWA contract is not weakened by native-only policy.

```sh
npm run mobile:check:source
npm run mobile:sync
npm run mobile:check
npm run mobile:open:android
# macOS only:
npm run mobile:open:ios
```

Android requires Android Studio, SDK Platform 36/Build Tools 35 and accepted SDK
licenses. On this Windows host the full `testDebugUnitTest lintDebug
assembleDebug` chain passed with the installed Android Studio SDK: 276 tasks,
no new lint issue and a generated debug APK. The Java unit-test tasks are
`NO-SOURCE`, so physical-device and WebView acceptance remain mandatory. Local
iOS compilation cannot run on Windows; the first hosted Xcode 26 bootstrap
resolved the reviewed Swift graph and intentionally stopped before compile. The
next hosted run used Xcode 26.5 and the committed lock to complete an unsigned
simulator build with zero source/lock drift. The proposed application ID is
`app.effectime`; it must be confirmed and reserved in both
stores before production signing. Generated template icon/splash assets are not
approved Effectime release assets. See the [mobile handoff](docs/mobile/README.md)
for auth redirects, signing, secure-storage device validation, verified-link and
device-test gates.

`npm run mobile:check:release` is the strict candidate-attestation gate. It
also requires a fully committed clean worktree, committed native/CI source and
a macOS/Xcode-generated, reviewed, committed Swift `Package.resolved`. The
reviewed lock is now committed and exact-pinned to Capacitor 8.3.1 and
KeychainSwift 21.0.0; the local release contract is green at 363/363. The first
pull-request run uploaded that lock and deliberately failed as designed. A
subsequent hosted run compiled exclusively from the committed graph and passed.

The repository currently has historical lint debt; see `PROJECT_AUDIT.md` for the
measured baseline: 1,218 errors and 108 warnings across 179 files. `npm run lint`
still reports the complete debt, while `npm run lint:ratchet` rejects new or
moved diagnostic fingerprints and requires the baseline to be reduced when debt
is removed. Do not weaken lint rules, coverage floors or bundle ceilings to hide
failures. The Edge gate covers all 30 functions with Deno 2.9.3. Both
`npm run edge:check` and `npm run edge:ratchet` pass with zero diagnostics. All
64 remote imports use exact versions and the allowed-unpinned baseline is empty;
any new module, diagnostic or unpinned import fails the mandatory job. The
focused PII logging contract is also mandatory. `npm run edge:test`
automatically discovers every `supabase/functions/**/*.test.ts` file and fails
if none exist. Edge checks and provenance generation use an isolated Deno
dependency mode (`--node-modules-dir=none`) so they cannot relink the npm-
installed frontend dependency tree.

The workspace AuditLog requests only `id`, `action`, `actor_id`,
`affected_user_id`, `created_at` and `metadata`. Protected `prev_state` /
`new_state` snapshots, IP addresses and user agents are not sent to the browser.
Rendered `metadata` is not assumed to be PII-free; its producer-side schema and
data-minimization policy remain a server responsibility.

Operational release, rollback, incident and isolated-restore procedures are in
[`docs/runbooks/`](docs/runbooks/README.md). `npm run release:sbom` and
`npm run release:manifest` create a shared web/mobile package-lock SBOM and a
separate Edge/Deno CycloneDX SBOM plus an ignored local schema-2 evidence
manifest. The manifest hashes both SBOMs, the package lock, tested `dist` and
`dist-mobile`, migration and Edge source trees, and records exact Capacitor
dependency provenance plus iOS lock availability. CI uploads that evidence
against an immutable commit SHA. Release evidence is admissible only when
`source.dirty=false` and the recorded SHA equals the frozen candidate SHA.

Every web build also emits `dist/.well-known/effectime-release.json`; the SHA is
compiled into the client and must be a full 40-character Git commit. CI rejects
missing, malformed or conflicting identities. Edge releases use the same
`EFFECTIME_RELEASE_SHA` value and expose it through the public API health and
superadmin platform-version contracts. After rollout, verify the live artifact
and optionally the authenticated Edge runtime with:

```powershell
$releaseSha='<full-git-sha>'
$webArtifactSha256='<approved-web-artifact-sha256>'
$webDeploymentId='<published-provider-deployment-id>'
npm run release:verify:deployment -- --web-url=https://effectime.app --expected-sha=$releaseSha --expected-web-sha256=$webArtifactSha256 --expected-provider-deployment-id=$webDeploymentId
$env:EFFECTIME_PUBLIC_API_KEY='<read-only-effectime-api-key>'
$env:EFFECTIME_EDGE_ORIGIN='https://<project-ref>.supabase.co'
$edgeSourceSha256='<approved-edge-source-tree-sha256>'
npm run release:verify:deployment -- --web-url=https://effectime.app --edge-url="$env:EFFECTIME_EDGE_ORIGIN/functions/v1/public-api/v1/health" --expected-sha=$releaseSha --expected-web-sha256=$webArtifactSha256 --expected-provider-deployment-id=$webDeploymentId --expected-edge-source-sha256=$edgeSourceSha256
```

Never pass the API key on the command line or commit it. A missing manifest,
unknown Edge identity, body/header/source-tree mismatch, changed file byte/hash,
or provider deployment-ID mismatch is a failed release. The selected web provider
must first prove a stable deployment-ID header on the manifest and every public
asset. A provider API mapping can become an alternative only after a reviewed
verifier adapter is implemented; the current verifier does not contain one.
Without the header contract, the production rollout remains NO-GO.

## Supabase and releases

Do not apply migrations to the linked production project from an unreviewed
checkout. The audit found a material difference between the remote migration
history and the migration files in this repository. Before the next backend
release:

1. take a verified database backup;
2. reconcile remote and local migration contents/hashes;
3. rebuild a clean shadow database and review the schema diff;
4. apply reviewed migrations in a staging environment;
5. deploy Edge Functions from the same commit;
6. run authenticated workspace, RBAC, leave, attendance, payroll, API/webhook and
   integration smoke tests;
7. record the deployed commit SHA in the release artifact.

The generated public schema currently contains 30 tables, one view, 46
functions and two enums whose defining migrations cannot be proven locally.
`npm run schema:provenance` prevents this reviewed debt from changing silently;
it does not make a clean install reproducible. A read-only live schema export,
transitively complete recovery migration, 126/126 clean replay, regenerated-type
comparison, schema fingerprint and RLS/adversarial tests are required before a
backend release.

The current v3.51.3 audit hardening source through PR #174 is merged to `main`
as `0a33e8cd0309d35e820fb1df9e8194dfbcce7242`; all seven hosted Quality Gate
jobs passed in run `29678100165`, with schema-2 artifact `8439647584`. It remains
**unreleased**: the live web manifest still returns 404, the linked database has
not been migrated, and no matching Edge Function artifact has been deployed to
production.

The v3.51.4 I-26 candidate adds a backward-compatible admin-override v2 RPC,
private hash-only idempotency ledger and a common web/Android/iOS retry adapter/
outbox. Its pinned PostgreSQL 18.4 contract is local-only evidence. Rollout must
be DB-first and client-second; do not deploy the v2 client until restored staging
and the target PostgREST schema cache prove the exact v1/v2 signatures and ACLs.
The outbox's seven-day value is a retry/reconciliation horizon, not an automatic
deletion TTL. Uncertain, expired or corrupt evidence is retained: one unresolved
operation is allowed per actor/workspace scope, an unchanged payload reuses its
key, and a different payload is blocked. Exact-key cleanup occurs only after a
valid server receipt; every error response retains the evidence. Known 4xx
failures remain exact-key retryable, while HTTP 408/499, 5xx, transport
ambiguity, status `0` and malformed responses surface the localized
`outcome_uncertain` state. Origin-wide Web Locks are mandatory for this critical
operation; unsupported/disabled runtimes fail closed before RPC dispatch. The
iOS deployment target is therefore 15.4 and the mobile quality gate rejects an
older target. Lockdown Mode intentionally leaves this privileged operation
unavailable rather than weakening cross-context idempotency.
Production/backend remains **NO-GO**
while the linked migration-history/schema drift is unresolved.

The linked production history currently has 59 migration IDs in common with the
repository, 65 local-only IDs and 84 remote-only IDs. Three local-only HR/office/
analytics migrations are proven duplicate-content variants of remote migrations
under different IDs; bulk `migration repair --status reverted` would therefore
be unsafe. A forward-only HR workflow candidate now adds fail-closed tenant
reference guards, cross-tenant parent-cascade protection, workspace/active-member
RLS correlation, locked RPC validation and explicit execution ACLs without
rewriting legacy rows. The inbox now selects explicit admin/member data paths
and renders retryable query failures instead of false empty states. Run
`npm run db:hr-workflow:test` for the pinned PostgreSQL 18.4 two-tenant, inactive-
assignee, PII-leak, parent-delete, idempotence and four deterministic concurrency
contracts. Do not
edit/replay the historical migration or apply this candidate to production until
the aggregate legacy inventory, restored-staging validation and migration-history
reconciliation are approved.

### Tenant user creation compatibility note

Direct password-based user creation by a workspace administrator is currently
fail-closed (`DIRECT_CREATE_DISABLED`). The previous flow confirmed an email
without mailbox proof and could pre-claim a global Supabase identity before the
real owner accepted an invitation. Workspace invitations remain supported and
mailbox-verified. Restoring the documented `instant_member_create` capability
requires an explicit product/security choice between managed-domain/SCIM
provisioning and a user-completed activation flow; see `PROJECT_AUDIT.md`.

### Payroll compatibility note

Payroll calculate, lock and CSV export now use the typed Edge Function contract
exclusively and fail closed on tenant, role and feature entitlement checks. Reads
are deterministically paginated with explicit safety caps. Open periods calculate
from current source data; locked/exported periods calculate and export only their
stored versioned snapshot. The canonical recursively key-sorted JSON is SHA-256
verified by both Edge and PostgreSQL, and lock/export state plus the primary audit
row commit atomically through restricted RPCs. CSV export is accepted only for
locked or already exported periods; all 11 UI providers are allowlisted and
spreadsheet-formula cells are neutralized. Legacy locked/exported periods without
a snapshot fail explicitly with HTTP 409 / `PAYROLL_SNAPSHOT_MISSING`. Direct
provider API export is intentionally unavailable and returns HTTP 501 with
`PAYROLL_PROVIDER_API_NOT_IMPLEMENTED` instead of reporting a false success.

Direct `service_role` period reset and reserved transition-audit mutation are
forbidden. The only supported per-period operational reopen is the service-role-
only `reopen_payroll_period_break_glass` RPC. It locks the active owner/resource-
assistant authorization and period rows, normalizes POSIX whitespace, requires
an 8–1000 character incident reason, preserves the exact previous protected
state and commits reopen plus audit atomically. Runtime `TRUNCATE` is revoked
from PUBLIC, anon, authenticated and service_role on both payroll periods and
the audit trail.

`npm run db:payroll:test` executes the real snapshot migration in a pinned,
network-isolated PostgreSQL 18.4 container. It proves trusted extensions-schema
ownership/CREATE ACL, pgcrypto location and extension membership, SHA-256 digest,
fixed search path, runtime TRUNCATE denial, exact audit state, reason boundaries,
atomic rollback, concurrent exactly-one-winner lock/reopen, and fail-closed actor-
demotion/reopen serialization. It is a targeted fixture, not a complete migration
replay. Before rollout, inventory legacy periods and pause payroll writes, then
deploy database → new Edge Function immediately → web. Rolling back
only to the old Edge implementation after applying the snapshot migration is not
safe. Arbitrary partial-period attendance aggregation, effective-date rate
selection, mixed-currency totals, a single-transaction source-data read, and
default-provider uniqueness still require explicit product/data-model decisions
before financial acceptance.

Edge Function gateway policies are explicit in `supabase/config.toml`. Functions
with `verify_jwt = false` implement a documented custom signature or opaque-token
contract and must retain their own fail-closed authentication.

The M365 cron is installed only when Vault contains both
`supabase_function_base_url` (the current environment's `https://<ref>.supabase.co`
origin) and `email_queue_service_role_key`. Never reuse a service-role key with a
different environment URL.

## Repository governance

- `CHANGELOG.md` contains user-visible changes.
- `versioning/` contains implementation/release records.
- `docs/tiering/` describes the feature and subscription model.
- `db-audit/` is historical audit evidence; later migrations and runtime code
  override stale snapshots, so findings must always be revalidated.
- Ambiguous database objects listed in the existing re-evaluation reports must
  not be deleted without an explicit product/data-retention decision.
