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
- For v3.51.3, both Edge checks must report zero diagnostics, all 64 remote
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
  and never substitutes for the clean 124-migration replay.
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

## Procedure

1. Freeze the candidate SHA. Do not rebuild it after approval.
2. Record current web and Edge artifact identifiers and the database migration head.
3. Confirm the latest verified backup and restore evidence.
4. Inventory legacy payroll periods and define remediation for every locked or
   exported row without a snapshot. Pause payroll calculation/lock/export writes
   before applying the snapshot migration.
5. Deploy additive database migrations to staging and validate schema/RLS/RPC
   contracts, trusted pgcrypto/schema ACLs, runtime TRUNCATE denial and the
   audited break-glass smoke before accepting payroll writes.
6. Deploy Edge Functions from the same SHA immediately after the database change;
   verify auth, timeout, retry and redaction paths. Do not leave the new payroll
   schema serving the old payroll Edge implementation.
7. Deploy the web artifact from the same SHA and run critical-path browser smoke tests.
8. Review monitoring, error rate, latency and queue/dead-letter health.
9. Obtain the named release authority's GO decision before production rollout.
10. Roll out production in the same DB → new Edge immediately → web order with a
    monitored hold point and a payroll write pause through the DB/Edge interval.
11. Attach the manifest, test evidence and observed metrics to the release record.

## Immediate NO-GO conditions

- Migration history or schema differs from the approved staging result.
- Clean migration replay is not 124/124, or the 30-table / 1-view / 46-function /
  2-enum provenance debt has not been replaced by transitively complete reviewed
  DDL with regenerated-types and schema-fingerprint comparison.
- Backup/restore evidence is absent or stale.
- Tenant/RBAC negative tests fail.
- A new critical/high dependency vulnerability or unreviewed Edge compile failure exists.
- The Edge diagnostic ratchet reports a new entrypoint, diagnostic or unpinned import.
- The release manifest is dirty, names a different SHA, or its distribution,
  migration, Edge-source or SBOM hash differs from the approved artifact.
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
