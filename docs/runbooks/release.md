# Release runbook v1

## Purpose

Release one immutable git SHA through database, Edge Functions and web artifacts
without weakening tenant isolation or losing the ability to recover. A green
frontend build alone is not release approval.

## Required evidence

- Approved change scope, migration order and rollback owner.
- Clean `npm ci`, full dependency audit, current-tree secret scan, lint ratchet,
  typecheck, coverage floor, build and bundle ceiling.
- Public browser smoke against the exact production `dist`, including asset MIME,
  manifest/favicon, service-worker and responsive-viewport evidence, with retained
  failure trace/screenshots.
- Mandatory Edge diagnostic-ratchet evidence for all 30 entrypoints, plus the raw
  compile result and an explicit record of any known baseline debt. A new module,
  diagnostic or unpinned import is not advisory and fails the release gate.
- For v3.51.3 and v3.51.4, both Edge checks must report zero diagnostics, all 64 remote
  imports exact and zero unpinned imports. `npm run edge:ratchet:test` must prove
  the discovery runner, and `npm run edge:test` must execute every recursively
  discovered `supabase/functions/**/*.test.ts` file; zero discovered tests fails.
- `npm run schema:provenance:test && npm run schema:provenance`. This exact
  generated-schema ratchet prevents silent debt changes; it never substitutes
  for complete DDL, a clean replay or schema-diff evidence.
- Clean shadow migration replay and database lint for any schema release.
- `node --test scripts/ci/payroll-snapshot-db-contract.test.mjs` and
  `npm run db:payroll:test` for the payroll snapshot migration. The latter runs
  the actual migration in pinned PostgreSQL 18.4 with no network or host port and
  proves trusted extensions-schema ownership/CREATE ACL, pgcrypto location and
  extension membership, digest, fixed search path, trigger/rollback, runtime
  TRUNCATE denial, normalized reason boundaries, exact audit state, deterministic
  lock/reopen races and actor-demotion serialization. It is a targeted fixture
  and never substitutes for the clean 126-migration replay.
- `node --test scripts/ci/hr-workflow-tenant-db-contract.test.mjs` and
  `npm run db:hr-workflow:test` for the HR workflow tenant-boundary migration.
  The pinned PostgreSQL 18.4 fixture must pass cross-workspace template,
  membership, instance, task and assignee denials; active-membership RLS; list
  PII isolation; exact RPC ACL/signatures; repeat apply; legacy-row preservation;
  cross-tenant parent-cascade denial; and four deterministic reassignment,
  suspension, direct-assignment and template-deactivation races. This targeted
  contract never substitutes for restored-staging inventory and a clean replay.
- `node --test scripts/ci/admin-leave-override-db-contract.test.mjs` and
  `npm run db:admin-override:test` for v3.51.4. The PostgreSQL 18.4 fixture must
  prove the exact legacy v1 OID/owner/ACL/body, trusted v2 owner/ACL, private
  ledger/RLS, same-key replay, payload mismatch, malformed response rejection,
  two-tenant authz/entitlement/input denial, audit/quota rollback and duplicate/
  demotion serialization. It is not restored-staging or live-schema evidence.
- Verified backup plus an isolated restore drill within the agreed RPO/RTO.
- Critical-path staging smoke for at least two tenants and affected roles.
- Payroll staging smoke must cover open calculation → lock → repeat calculation →
  CSV export, and prove that both post-lock operations return the exact stored
  snapshot/hash/version. It must also cover canonical-payload tamper rejection,
  entitlement-denied role/tenant, unlocked-export HTTP 409, a legacy
  locked/exported period without snapshot returning `PAYROLL_SNAPSHOT_MISSING`,
  direct-provider HTTP 501, concurrent lock with exactly one winner, and datasets
  crossing the 1,000-row Supabase default page boundary plus configured overflow
  caps. Financial acceptance records the approved partial-period, effective-rate,
  currency and default-provider rules.
- Payroll staging must also cover locked, exported and legacy-snapshotless
  break-glass reopen by active owner/resourceAssistant; normalized 8–1000
  character reason; exact response audit ID and exact prev/new protected state;
  a concurrent second reopen; actor demotion during authorization; direct reset,
  reserved-audit forge/update/delete and runtime TRUNCATE denial. The workspace
  AuditLog browser response must exclude `prev_state`, `new_state`, IP and user-
  agent fields; displayed `metadata` still requires producer-side PII review.
- Separate web/package-lock and Edge/Deno CycloneDX SBOMs, plus the schema-2
  release manifest containing the exact git SHA and hashes for both SBOMs, the
  package lock, tested `dist`, migration tree and Edge source tree. The manifest
  must have `source.dirty=false` and its SHA must equal the frozen candidate SHA.
- `npm run release:identity:test` and a deterministic
  `dist/.well-known/effectime-release.json` whose full SHA equals both the frozen
  candidate and the embedded client identity. Its artifact SHA-256 is computed
  from the sorted `relative path + NUL + file SHA-256 + NUL` inventory, excluding
  only the identity file itself. The schema-2 evidence manifest must recompute
  and exactly match that fingerprint for both tested web and mobile outputs.
- A captured live verification result from `npm run release:verify:deployment`.
  Pass the approved `artifact.sha256` as the mandatory
  `--expected-web-sha256=<64-hex>` value; matching Git SHA alone is insufficient
  because build-time configuration can produce a different artifact from the
  same commit. The verifier downloads every HTTP-verifiable inventory file with
  cache bypass and checks its byte length and SHA-256. Provider-consumed
  `_headers` and `_redirects` cannot be verified as public bytes; they remain in
  the approved fingerprint and are covered by the mandatory deployment-ID map.
  When Edge is in scope, set `EFFECTIME_PUBLIC_API_KEY` and the allowlisted
  `EFFECTIME_EDGE_ORIGIN` only in the invoking environment. Require the Edge JSON
  identity, `X-Effectime-Release-SHA` and `X-Effectime-Edge-Source-SHA256`
  headers to equal the frozen candidate and the canonical Edge digest stored in
  the schema-2 evidence manifest.
- Provider deployment/version IDs for the web and Edge artifacts, tied to the
  approved SHA and web fingerprint in retained audit evidence. Provider preview
  must first prove that a readable Git checkout and exact `HEAD` metadata are
  available to the build; a source upload without `.git` is not attestable by
  this release pipeline and must fail before production publish.

## Procedure

1. Freeze the full 40-hex candidate SHA. Build with
   `EFFECTIME_RELEASE_SHA=<candidate>`; do not rebuild it after approval.
2. Record current web and Edge artifact identifiers and the database migration head.
3. Confirm the latest verified backup and restore evidence.
4. Inventory legacy payroll periods and define remediation for every locked or
   exported row without a snapshot. Pause payroll calculation/lock/export writes
   before applying the snapshot migration.
5. Deploy additive database migrations to staging and validate schema/RLS/RPC
   contracts, trusted pgcrypto/schema ACLs, runtime TRUNCATE denial and the
   audited break-glass smoke before accepting payroll writes. For v3.51.4,
   verify both admin-override RPC signatures/ACLs, force a PostgREST schema-cache
   reload, run legacy v1 and same-key v2 smoke, and only then admit a v2 client.
6. Deploy Edge Functions from the same SHA immediately after the database change;
   set the Edge `EFFECTIME_RELEASE_SHA` runtime value under the same release
   authority and verify auth, timeout, retry and redaction paths. Do not leave
   the new payroll schema serving the old payroll Edge implementation. Record
   the provider deployment/version ID because the runtime value alone is not a
   cryptographic binding between source and the provider artifact.
7. Deploy the exact tested web artifact from the same SHA, then run critical-path
   browser smoke and `npm run release:verify:deployment -- --web-url=<live-url>
   --expected-sha=<candidate> --expected-web-sha256=<approved-artifact-sha256>
   --expected-provider-deployment-id=<published-provider-id>
   --edge-url=<allowed-edge-origin>/functions/v1/public-api/v1/health
   --expected-edge-source-sha256=<approved-edge-source-sha256>`
   against live web and Edge endpoints. Do not infer deployment success from a
   Git push or webhook. Record the provider deployment ID returned by the publish.
   Before invoking the Edge check, set `EFFECTIME_EDGE_ORIGIN` to the exact HTTPS
   origin and `EFFECTIME_PUBLIC_API_KEY` to the scoped read-only key. If the web
   provider cannot expose the retained immutable deployment ID consistently on
   the manifest and every public asset, rollout is NO-GO. A provider API mapping
   is not implemented by the current verifier; it becomes an alternative only
   after a separately reviewed adapter and contract test are merged.
8. Review monitoring, error rate, latency and queue/dead-letter health.
9. Obtain the named release authority's GO decision before production rollout.
10. Roll out production in the same DB → new Edge immediately → web order with a
    monitored hold point and a payroll write pause through the DB/Edge interval.
11. Attach the manifest, test evidence and observed metrics to the release record.

## Immediate NO-GO conditions

- Migration history or schema differs from the approved staging result.
- Clean migration replay is not 126/126, or the 30-table / 1-view / 46-function /
  2-enum provenance debt has not been replaced by transitively complete reviewed
  DDL with regenerated-types and schema-fingerprint comparison.
- Backup/restore evidence is absent or stale.
- Tenant/RBAC negative tests fail.
- The HR workflow forward repair is absent or cross-workspace membership,
  assignee, instance/task join, inactive-assignee and race tests are not green;
  or restored-staging aggregate inventory is non-zero without a reviewed,
  data-preserving remediation decision.
- The admin-override PG18 contract is not green, restored staging does not expose
  both exact v1/v2 contracts, PostgREST has not reloaded the v2 signature, or a
  v2 web/mobile client would be deployed before the verified DB boundary.
- A new critical/high dependency vulnerability or unreviewed Edge compile failure exists.
- The Edge diagnostic ratchet reports a new entrypoint, diagnostic or unpinned import.
- The release manifest is dirty, names a different SHA, or its distribution,
  migration, Edge-source or SBOM hash differs from the approved artifact.
- The public release-identity file is missing/malformed, web and Edge identities
  are unknown/different, its application/version/clean state or web artifact
  fingerprint differs, the Edge body/header differ, or the live verifier fails.
- The provider preview cannot read and cross-check Git `HEAD`, the immutable web
  deployment ID is not observable on every verified response, or any provider
  deployment/version ID is absent from retained release evidence. The current
  verifier has no provider-API adapter.
- The extensions schema/pgcrypto trust contract fails, or PUBLIC/anon/
  authenticated/service_role has TRUNCATE on payroll periods or transition audit.
- Payroll financial semantics are unapproved while partial periods or mixed
  currencies are in the candidate release scope.
- Legacy locked/exported payroll periods have not been inventoried/remediated, the
  PostgreSQL 18.4 contract is red, or staging has not proved snapshot immutability,
  exact stored-calculate/export parity, exact atomic break-glass audit and
  lock/reopen/demotion serialization.
- The AuditLog client payload overfetches protected state, IP or user-agent data.
- The deployed artifact cannot be mapped to one git SHA.
- Error rate, queue backlog or latency breaches the agreed release threshold.

## Post-release

Monitor through the agreed observation window. Record follow-up debt separately;
never relabel a failed mandatory gate as advisory during the release.

For a payroll rollback after the database migration, prefer a reviewed forward
repair or redeploy the compatible new Edge implementation. Redeploying only the
pre-snapshot Edge implementation is unsafe because it does not honor the new
immutable stored-calculation contract. A destructive database rollback requires
the verified backup and explicit release-authority approval.

A direct `service_role` reset is not a rollback mechanism. Reopen one period only
through `reopen_payroll_period_break_glass`, tied to an approved incident reason
and its returned audit event. Any bulk recovery needs a separately reviewed,
forward-only repair and release-authority approval.

For an admin-override v2 rollback, stop/revert the new client first so no active
artifact depends on v2. Keep the additive function and idempotency ledger in the
database while any supported web/mobile build can still send v2 keys. Do not
fall back from an uncertain v2 response to v1 within the same operation: that
would bypass the ledger and may create a duplicate request.

The outbox's seven-day value is a retry/reconciliation horizon, not an automatic
deletion TTL. Never prune uncertain, expired or corrupt client evidence. Permit
only one unresolved operation per actor/workspace scope: retrying the unchanged
payload must reuse its key, while a different payload remains blocked until the
earlier operation is reconciled. Exact-key cleanup is allowed only after a valid
server receipt; every error response retains the evidence. A known 4xx remains
exact-key retryable. HTTP 408/499, 5xx, timeout, abort, status `0`, transport
failure or malformed response must show the localized `outcome_uncertain` state.
The operation requires origin-wide Web Locks and must fail before RPC dispatch
when that API is missing or disabled. The iOS deployment target and mobile
source/release gate must remain at least 15.4. Lockdown Mode is an explicit
fail-closed limitation for admin override and must be covered by device
acceptance messaging; do not replace it with realm-only coordination.

The admin-override rollout remains DB-first and client-second. The documented
migration-history/schema drift is an immediate production/backend **NO-GO**;
do not apply the v2 migration or publish a v2 client until restored staging and
the target PostgREST schema cache prove the exact approved contracts.
