# Created enterprise identity cleanup runbook v2

## Purpose and boundary

This runbook operates the v3.51.7 durable provisioning saga plus the v3.51.8
fenced worker and dormant scheduler foundation for enterprise instant
identities. Its safety objective is to commit recovery intent before the Auth
request, prove successful provisioning server-side, and prevent a failed or
interrupted create from leaving unowned tenant-visible data while cleanup
remains uncertain.

This document does not authorize production access, secret creation, migration
apply or deployment. The named database, Edge, security/privacy and release
owners must approve those actions for the target environment.

## Implemented contract

- Migration `20260721234500_v3_51_7_created_identity_compensation.sql` creates
  the private `effectime_private.created_identity_cleanup_jobs` saga/outbox and
  the writer-side v1 contracts:

  1. `register_created_enterprise_identity_provisioning_v1(uuid, uuid)`;
  2. `prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)`;
  3. `complete_created_enterprise_identity_provisioning_v1(uuid, uuid, uuid)`;
  4. `complete_created_enterprise_identity_cleanup_v1(uuid, uuid)`;
  5. `fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)`.
- Migration `20260722003000_v3_51_8_created_identity_cleanup_scheduler.sql`
  adds a per-job fencing token, preserves the v1 direct-writer signatures, and
  retires the unfenced v1 claim. Its service-role-only worker interface is:

  1. `acquire_created_identity_cleanup_worker_v1(uuid, integer)`;
  2. `claim_created_enterprise_identity_cleanup_jobs_v2(integer)`;
  3. `prepare_created_enterprise_identity_cleanup_v2(uuid, uuid, uuid, uuid)`;
  4. `complete_created_enterprise_identity_cleanup_v2(uuid, uuid, uuid)`;
  5. `fail_created_enterprise_identity_cleanup_v2(uuid, uuid, text, uuid)`;
  6. `finish_created_identity_cleanup_worker_v1(uuid, text, integer, integer,
     integer, integer, text)`.
- `create-instant-enterprise-member` and `join-event` register a `provisioning`
  saga in a separate committed RPC **before** calling Auth. A writer crash or an
  ambiguous Auth-create response therefore cannot erase the cleanup intent.
- The Auth create request puts the exact identity kind, workspace and cleanup
  intent in server-controlled Auth `app_metadata`. User metadata is not accepted
  as cleanup authority.
- Successful creation follows `provisioning -> provisioned`. The writer may
  return success only after the provisioning-completion RPC verifies the exact
  Auth proof, active same-workspace membership, profile and role-allocation
  invariants, then returns a strict `provisioned` receipt.
- Failed or abandoned creation follows `provisioning -> pending_auth ->
  completed`. Prepare binds the saga to one exact Auth user by `app_metadata`,
  removes membership plus profile in one database transaction and only then
  records `pending_auth`. If that transaction fails late, all of its changes
  roll back, but the earlier committed saga remains in `provisioning` for retry.
- Auth deletion starts only from the validated `pending_auth` state. A delete
  response is not accepted as proof: a subsequent exact-ID Auth lookup and the
  database postcondition must prove absence before the job becomes `completed`.
  Every retry re-runs idempotent database prepare first. Finalization then holds
  the workspace and per-user mutation gates, re-deletes/rechecks tenant-visible
  rows and commits `completed` in that same transaction.
- Membership/profile write guards join the per-user gate and reject new or
  changed tenant-visible rows for `pending_auth` and `completed` identities.
  A delayed writer therefore cannot resurrect data after database-first cleanup.
- `cleanup-created-identities` is the only recurring-worker candidate. It is a
  POST-only, saga-only endpoint: it never scans or deletes legacy temporary
  profiles. It accepts either the exact service-role bearer for a reviewed
  manual invocation, or the exact environment's legacy anon JWT in both
  `Authorization` and `apikey` plus a dedicated 43–128 character
  `x-effectime-cleanup-secret`. Credential source and the exact versioned body
  source must agree. `verify_jwt = true` remains enabled.
  Supabase documents that this built-in check accepts the legacy JWT key format,
  not `sb_publishable_...` bearer values; see
  [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
  and
  [API-key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
- The worker claims at most ten jobs, has a 110-second total runtime ceiling,
  15-second network-operation ceilings and a 150-second singleton lease. A
  second invocation returns an explicit `worker_overlap` skip without claiming
  work. Every job mutation must present the exact still-valid fencing token;
  a late or timed-out invocation cannot complete/fail a newer worker's lease.
- `cleanup-temp-users` is now only the backward-compatible, service-role-only
  legacy temporary-profile cleanup. It claims only currently eligible rows
  through a service-only RPC (default ten, hard maximum 100), so retained head
  rows cannot starve later eligible profiles. A separate 120-second per-user
  lease token and profile/event triggers freeze temporary status, event binding
  and expiry eligibility across the Auth side effect. Prepare first validates
  the claim, then renews the exact lease again after the exact Auth lookup and
  immediately before every delete attempt. Completion requires both an
  unexpired token and authoritative Auth absence before it atomically deletes
  votes, participants, the lease and profile. Expired orphan tokens cannot
  complete: a new claim must rotate the token first. If the temporary identity
  owns its sole linked event, the Auth cascade is admitted only when no other
  profile, claimant, participant or voter can be deleted with it.
  The Edge handler accepts only an exact 20-character Supabase HTTPS origin,
  uses abortable ten-second network calls and a 90-second total deadline, and
  returns HTTP 503 for every uncertain/partial outcome. Its response explicitly
  delegates created-identity work to `cleanup-created-identities`; it must never
  be the target of this scheduler.
- The job table contains UUID references, state, bounded error codes and
  timestamps. It intentionally has no direct grant even for `service_role`; the
  reviewed SECURITY DEFINER RPCs are the only runtime interface.
- The private singleton state stores only the active operational run token,
  bounded aggregate outcome, last completion and scheduler metadata. It stores
  no email, name, Auth metadata or credential and has no direct runtime grant.
- The private owner-only installer resolves exactly one URL, legacy anon JWT and
  dedicated trigger secret from Vault, validates the exact 20-character project
  reference, and persists a static five-minute pg_cron command that resolves the
  values again at execution. The migration itself deliberately creates no job.
  The companion owner-only pause function removes the exact stable job name
  while preserving queue and worker evidence.

The current source provides a **dormant** installer but does not install a
production scheduler. A deployed worker without a monitored recurring
invocation is not an operational implementation and remains a release NO-GO.

| Status | Meaning | Allowed next status | Worker-claimable |
| --- | --- | --- | --- |
| `provisioning` | Pre-Auth saga registered; user may still be unbound | `provisioned` or `pending_auth` | after five-minute grace/backoff |
| `pending_auth` | Initial database cleanup committed and exact user bound; every retry/finalizer reasserts tenant-row absence | `completed` | when due and lease-free |
| `provisioned` | Server verified the successful identity, membership, profile and allocations | terminal | no |
| `completed` | Database and exact Auth cleanup postconditions are proven | terminal | no |

## Retry, lease and idempotency semantics

- Registration gives a `provisioning` saga a five-minute grace period before it
  can be claimed. A healthy writer must finish and obtain the `provisioned`
  receipt inside that window; the worker must not race a normal in-flight create.
- Claim uses `FOR UPDATE SKIP LOCKED`, increments `attempt_count`, generates a
  new opaque fencing token and grants a separate five-minute job lease. Prepare
  preserves that lease across the Auth lookup/delete window. A crashed
  invocation becomes claimable only after lease expiry, and replacement creates
  a different token.
- A claimed `provisioning` job with no exact Auth `app_metadata` match records
  `identity_not_visible`, remains `provisioning` and retries with backoff. A null
  or not-yet-visible Auth identity is **not** successful cleanup and the durable
  intent is not silently completed or removed.
- A claimed job always runs prepare before any Auth operation. A
  `provisioning` prepare failure records `identity_not_visible` or
  `database_cleanup_failed`; a `pending_auth` re-prepare failure records
  `database_cleanup_failed`. The state remains retryable. A successful first
  prepare binds `user_id`, removes tenant-visible rows and transitions
  atomically to `pending_auth`; later prepares repeat the cleanup idempotently.
- Each claimed job makes at most two exact-ID Auth delete/verification attempts.
  Once a saga is bound in `pending_auth`, authoritative absence of that exact
  user proves the Auth side effect; an unknown lookup never proves absence.
- A state-compatible preparation or Auth failure schedules exponential retry
  with `min(3600, 30 * 2^min(attempt_count, 7))` seconds. The fencing lease is
  retained until its original expiry, so a retry requires both the backoff and
  lease to be due. Because claim increments the count first, the first recorded
  failure has a 60-second backoff; the job remains fenced for at most five
  minutes. The bounded codes are
  `identity_not_visible`/`database_cleanup_failed` for `provisioning` and
  `database_cleanup_failed`/`auth_lookup_failed`/`auth_delete_failed` for
  `pending_auth`.
- A completion/failure receipt error leaves the job pending. If the receipt did
  not commit, its existing lease expires and makes the job claimable again.
- There is no automatic terminal dead-letter or maximum-attempt deletion. This
  is deliberate: uncertain identity cleanup evidence must remain retryable and
  visible until an operator resolves the underlying fault.
- `provisioned` and `completed` are terminal and are not claimable. Repeated
  exact-ID Auth deletion and cleanup completion are idempotent. Operators must
  not create substitute users, bind an intent by hand, edit identity fields,
  mark rows terminal or delete saga evidence manually.

The worker response `summary.pending` field counts claimed jobs that were not
completed in that invocation. It is not the total queue depth. Non-zero pending
or `receipt_failures` produces a fail-visible 5xx run. Use the private aggregate
queries below for backlog monitoring.

## Pre-deployment gate

1. Freeze the exact candidate SHA and record database, Edge and scheduler owners.
2. Prove a current backup and isolated restore within the approved RPO/RTO.
3. On the candidate source, require:

   ```text
   node --test scripts/ci/member-profile-save-db-contract.test.mjs
   npm run db:member-profile-save:test
   npm run edge:test
   npm run edge:check
   ```

   The PostgreSQL contract must cover pre-Auth saga registration, all four saga
   statuses and both terminal paths, exact metadata binding, every v1/v2
   service-only RPC ACL, cross-workspace denial, five-minute grace/lease,
   no-visible-Auth
   retry, late prepare rollback with saga preservation, provisioning postcondition
   receipt, claim/fail retry and Auth-before/after cleanup completion. It must
   additionally prove that every claimed `pending_auth` retry re-prepares the
   database before Auth access, non-service membership/profile writes cannot
   resurrect pending/completed identities, finalization re-deletes/rechecks rows
   under workspace and user gates, a two-session writer/finalizer race
   serializes without residue, a late fencing token is rejected, the singleton
   lease redacts the active owner from an overlapping invocation, an expired
   owner is reclaimable, and the dormant scheduler installer is fail-closed and
   persists no credential. The same fixture must prove the separate legacy
   temporary-profile lease: retained rows cannot starve eligible rows; event
   extension and temporary-to-permanent profile mutation lose against an active
   claim in deterministic two-session races; direct eligibility mutations fail
   while unrelated columns remain writable; same-owner Auth-to-event cascade is
   safe; expired/foreign tokens fail and an orphan requires token rotation;
   completion requires exact Auth absence; and database cleanup is atomic. Edge
   tests must prove exact-origin rejection, preparation after Auth lookup and
   immediately before deletion, abortable per-call timeout and total-deadline
   failure visibility. Targeted fixture success never replaces a clean
   migration replay and restored-staging schema comparison.
4. Confirm `supabase/config.toml` still has
   `[functions.cleanup-created-identities] verify_jwt = true` and
   `[functions.cleanup-temp-users] verify_jwt = true`. Prove the new worker's
   scheduler/manual auth matrix and the legacy function's exact service-role
   comparison before either client is constructed.
5. Prepare aggregate monitoring, a tested alert route and a single-concurrency
   recurring scheduler in staging. Vault must contain exactly one
   `supabase_function_base_url`, `created_identity_cleanup_anon_key` and
   `created_identity_cleanup_scheduler_secret`. The anon value must be the
   target project's legacy `role=anon` JWT because gateway JWT verification is
   enabled; it is not a service-role/secret key. Never paste any credential into
   SQL, source, logs, tickets or scheduler command text.
6. Pause new enterprise instant-identity creation for the short database-to-Edge
   rollout interval. If that write pause is unavailable, release authority must
   explicitly reject the rollout until a tested equivalent containment exists.

## Rollout order

The order is mandatory: **database migration first, matching Edge artifacts
immediately after, scheduler last**.

1. Apply the approved migration to staging. Do not deploy a new writer before
   the RPCs exist.
2. After PostgREST schema-cache reload, verify all exact v1/v2 RPC signatures,
   `postgres` ownership, fixed search paths and EXECUTE only for `service_role`.
   Verify RLS is enabled on the private table and that PUBLIC, `anon`,
   `authenticated` and `service_role` have no direct table privileges. Include
   the three legacy temporary-profile claim/prepare/complete RPCs, both narrowed
   guard triggers, both cleanup indexes and the private lease table in this
   catalog check.
3. Deploy these four Edge Functions from the same frozen SHA:
   `create-instant-enterprise-member`, `join-event`,
   `cleanup-created-identities` and `cleanup-temp-users`.
   Record each immutable provider deployment/version ID and Edge source digest.
4. Run both successful-provisioning and failed-compensation staging smoke tests,
   including the strict terminal receipts and the manual checks below.
5. Install the recurring scheduler only after the dedicated worker is verified.
   Through the approved owner connection invoke
   `effectime_private.install_created_identity_cleanup_scheduler_v1('<ref>')`
   once, then prove exactly one `effectime-created-identity-cleanup-v1` job with
   `*/5 * * * *`. The legacy temporary-user scan is deliberately not part of
   this invocation. Do not grant the installer to a runtime role.
6. Retain the scheduler provider/job ID, exact schedule, target project reference,
   last successful invocation, HTTP result and response summary in release
   evidence. The persisted pg_cron command must contain the three Vault names,
   the fixed function path, a 120-second HTTP timeout and no resolved URL or
   credential. Retain the reviewed installer invocation as change evidence; do
   not install an alternative ad-hoc job. pg_net starts the asynchronous HTTP
   request only after the scheduling transaction commits; its request ID is not
   proof of the worker response. See the official
   [pg_net contract](https://supabase.com/docs/guides/database/extensions/pg_net).
7. Repeat the same DB -> Edge -> scheduler sequence in production during the
   approved window. Reopen instant-identity creation only after one successful
   scheduled invocation and all invariant checks are green.

## Manual worker invocation

Use only an approved operator environment. The variables below must come from a
secret manager and must refer to the same Supabase project; never paste their
values into a terminal transcript or retained ticket.

```powershell
$cleanupHeaders = @{
  Authorization = "Bearer $env:EFFECTIME_CLEANUP_SERVICE_ROLE_KEY"
  "Content-Type" = "application/json"
}
Invoke-RestMethod `
  -Method Post `
  -Uri "$env:EFFECTIME_CLEANUP_FUNCTION_ORIGIN/functions/v1/cleanup-created-identities" `
  -Headers $cleanupHeaders `
  -Body '{"schema_version":1,"source":"manual"}'
```

Expected HTTP status is 200 and the JSON response must contain an
exact `status=completed` or explicit `status=skipped` contract plus integer
`summary.claimed`, `completed`, `pending` and `receipt_failures` values. HTTP 403
means the credential/body-source boundary rejected the call. HTTP 503, a
malformed receipt, any non-zero pending/receipt failure or a missing singleton
finish receipt is an operational failure, not a successful drain.

## Monitoring and alerts

Run aggregate queries through the restricted operations/database role. Do not
export row-level UUIDs into general dashboards.

```sql
SELECT
  count(*) FILTER (WHERE status = 'provisioning') AS provisioning,
  count(*) FILTER (WHERE status = 'pending_auth') AS pending_auth,
  count(*) FILTER (WHERE status = 'provisioned') AS provisioned,
  count(*) FILTER (WHERE status = 'completed') AS completed,
  count(*) FILTER (
    WHERE status IN ('provisioning', 'pending_auth')
      AND next_attempt_at <= pg_catalog.now()
      AND (lease_expires_at IS NULL OR lease_expires_at <= pg_catalog.now())
  ) AS claimable,
  min(created_at) FILTER (
    WHERE status IN ('provisioning', 'pending_auth')
  ) AS oldest_active_at,
  max(attempt_count) FILTER (
    WHERE status IN ('provisioning', 'pending_auth')
  ) AS max_attempt_count
FROM effectime_private.created_identity_cleanup_jobs;

SELECT
  status,
  last_error_code,
  count(*) AS active_count,
  min(updated_at) AS oldest_error_at,
  max(attempt_count) AS max_attempt_count
FROM effectime_private.created_identity_cleanup_jobs
WHERE status IN ('provisioning', 'pending_auth')
GROUP BY status, last_error_code
ORDER BY status, last_error_code NULLS FIRST;

SELECT
  active_run_id IS NOT NULL AS worker_active,
  lease_expires_at,
  last_status,
  last_claimed,
  last_completed,
  last_pending,
  last_receipt_failures,
  last_error_code,
  last_finished_at,
  overlap_count,
  scheduler_job_id IS NOT NULL AS scheduler_installed,
  scheduler_project_ref,
  scheduler_installed_at
FROM effectime_private.created_identity_cleanup_worker_state
WHERE singleton;

SELECT
  count(*) FILTER (WHERE lease_expires_at > pg_catalog.now()) AS active_claims,
  count(*) FILTER (WHERE lease_expires_at <= pg_catalog.now()) AS expired_claims,
  min(claimed_at) AS oldest_claimed_at
FROM effectime_private.temporary_profile_cleanup_leases;
```

Initial alert defaults, to be replaced by approved SLO-derived thresholds:

- **Warning:** no scheduler success for 10 minutes; any `provisioning` job remains
  non-terminal after its five-minute grace; any claimable job is older than 10
  minutes; `attempt_count >= 3`; or one invocation reports pending/receipt
  failures.
- **Critical:** two consecutive scheduler/worker failures; no scheduler success
  for 20 minutes; any active saga older than 30 minutes; `attempt_count >= 6`;
  queue claim HTTP 500; or an invariant query finds tenant-visible data for a
  `pending_auth` cleanup identity.

Track at minimum invocation success/rate/duration, `claimed`, `completed`, batch
`pending`, `receipt_failures`, overlap count, aggregate depth and age for both active states,
terminal transition counts, maximum attempt count and counts by bounded error
code. Alert payloads must contain release SHA, deployment ID, environment,
timestamps and a correlation/request ID, but no service key, email, display name,
raw Auth metadata or general-access user UUID.

## Controlled staging acceptance

1. Through a supported staging flow, prove that the saga is registered and its
   strict `provisioning` receipt is validated before the Auth create request.
   The row must have no bound user and must not be claimable until the five-minute
   grace expires.
2. Complete a normal instant-identity creation. The Edge writer must not return
   success until `complete_created_enterprise_identity_provisioning_v1` returns
   the exact job/user/membership `provisioned` receipt. Verify Auth metadata,
   active membership, profile and role-allocation postconditions, and verify the
   terminal row is not claimed by the worker.
3. Induce a reviewed post-Auth provisioning failure. Record its cleanup intent
   in restricted evidence; do not fabricate production rows. After grace, prove
   the worker claims `provisioning`, resolves exactly one Auth identity by the
   three `app_metadata` values, atomically prepares database cleanup, transitions
   to `pending_auth`, deletes/verifies the bound Auth user and receives the exact
   `completed` receipt.
4. Force a late database-prepare error in an isolated test. Verify the prepare
   transaction rolls back while the independently committed saga remains
   `provisioning`, receives `database_cleanup_failed` plus backoff, and later
   retries the same intent to completion after the fault is removed.
5. Register an isolated intent for which no matching Auth identity is visible.
   After grace, verify it remains `provisioning`, records
   `identity_not_visible`, respects lease/backoff and is claimed again later. It
   must not become `completed` or disappear merely because `user_id` is null or
   Auth currently has no visible match.
6. From a prepared `pending_auth` state, first inject reviewed tenant-row drift
   and verify the next prepare removes it before Auth is touched. Then make Auth
   lookup unavailable. Verify the state remains `pending_auth`, the bounded
   error/backoff is retained and later authoritative deletion/absence plus the
   gated final database cleanup completes the same job.
7. Invoke the worker again after terminal completion. Neither `provisioned` nor
   `completed` rows may be claimed and no additional tenant data may change.
8. Run two concurrent worker invocations. Exactly one may acquire the singleton;
   the other must return an explicit overlap skip without exposing the active
   run token. Let an isolated lease expire, then prove one new run can reclaim
   it and the old token cannot prepare, complete, fail or finish the new run.
9. Race finalization against profile and membership insertion: the writer must
   wait/fail, `completed` must commit without tenant-visible or Auth rows, and no
   terminal ghost may appear.
10. Prove missing/wrong trigger secret, wrong anon key, a user JWT and a body/
    credential source mismatch fail before any client/RPC/Auth work. Confirm the
    service-role manual path still requires `source=manual`.
11. Invoke the reviewed installer twice in staging. Each invocation must leave
    exactly one five-minute job and the same static command; rotate the Vault
    trigger value and prove the command text does not change while the next HTTP
    request uses the new value. A wrong URL/key pair must fail and alert.
12. Retain the first pg_net response row and require HTTP 200 with the exact
    response schema; also prove alerts fire when the schedule is temporarily
    paused. `cron.job_run_details` enqueue success alone is not worker success;
    correlate the retained pg_net response with the matching aggregate worker
    state before activation is accepted.
13. Exercise the separate legacy worker with one retained and one eligible
    profile. Prove the eligible row is claimed first, then race event extension
    and temporary-to-permanent upgrade against separate active claims. Verify
    both writers lose without data drift, the exact same-owner Auth cascade
    succeeds only for a sole linked profile, and an expired orphan token is
    rejected until a new claim rotates it. Do not point the recurring
    created-identity scheduler at this endpoint.

For an approved test identity, the database invariant check is:

```sql
SELECT
  cleanup_job.status,
  cleanup_job.attempt_count,
  cleanup_job.last_error_code,
  (
    SELECT pg_catalog.count(*)
    FROM auth.users AS intent_user
    WHERE intent_user.raw_app_meta_data ->> 'effectime_identity_kind'
            = 'enterprise_instant_member'
      AND intent_user.raw_app_meta_data ->> 'effectime_workspace_id'
            = cleanup_job.workspace_id::text
      AND intent_user.raw_app_meta_data ->> 'effectime_cleanup_intent_id'
            = cleanup_job.cleanup_intent_id::text
  ) AS auth_intent_matches,
  EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.user_id = cleanup_job.user_id
  ) AS has_membership,
  EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id = cleanup_job.user_id
  ) AS has_profile,
  EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = cleanup_job.user_id
  ) AS has_auth_user
FROM effectime_private.created_identity_cleanup_jobs AS cleanup_job
WHERE cleanup_job.cleanup_intent_id = '<approved-test-cleanup-intent>'::uuid;
```

For an initial `provisioning` intent, no user is bound and zero Auth matches are
expected; after Auth is created but before recovery, exactly one metadata match
may exist. `provisioned` requires exactly one Auth match plus the bound active
membership/profile and the server-verified allocation postcondition.
`pending_auth` requires bound `user_id` with `has_membership = false` and
`has_profile = false`; Auth may remain only until exact deletion is proven.
`completed` requires zero Auth matches and all three booleans false. Restrict and
delete test evidence according to the approved test-data policy; do not place raw
query output in a general release ticket.

## Incident response

1. Declare the incident severity using `incident.md`; record UTC time, release
   SHA, schema head, function deployment IDs and scheduler job ID.
2. If tenant-visible membership/profile data is present for a `pending_auth`
   identity, stop instant-identity creation immediately and treat it as a
   data-integrity and possible authorization incident. For `provisioning`, such
   rows can remain after a deliberately rolled-back prepare attempt, but they
   must stay tied to the durable saga and retry; treat any state past the grace/
   retry SLO as degraded cleanup and do not delete rows ad hoc.
3. For a stuck `provisioning` saga, diagnose scheduler delivery, worker HTTP/auth,
   exact Auth `app_metadata` visibility, database prepare/locking and failure
   receipt in that order. `identity_not_visible` is retryable uncertainty, not
   proof that no Auth side effect occurred. For `pending_auth`, then diagnose
   Auth Admin lookup/delete and the cleanup-completion receipt.
4. A 403 normally indicates wrong credential, wrong project or gateway drift.
   Correct the environment binding; never weaken `verify_jwt` or the exact bearer
   comparison.
5. A worker 503, provisioning postcondition failure or receipt failure
   requires database/PostgREST review. Do not return successful provisioning
   without its `provisioned` receipt. Do not interpret an Auth delete response as
   cleanup completion without the exact post-delete lookup and `completed`
   receipt. For the legacy worker, also inspect aggregate active/expired lease
   counts and the event/profile guard path; never delete or extend a lease by
   hand to force progress.
6. After repair, invoke one bounded batch, verify aggregate invariants, then let
   the monitored scheduler drain naturally. Avoid concurrent manual drain loops.
7. Close only after backlog age and attempts return to normal, all affected jobs
   are reconciled, tenant/RBAC checks pass and the privacy owner has reviewed any
   exposure or retention impact.

## Rollback and forward repair

- If migration apply fails, do not deploy any of the four matching Edge artifacts.
- After the forward-only migration is applied, prefer a forward Edge/database repair.
  Keep the private table and durable jobs; do not run a destructive down-migration.
- Rolling the writers back to an older Auth-first compensation path reintroduces
  the orphan-membership failure and is unsafe. Disable instant identity creation
  while deploying the last known-good **database-first-compatible** Edge artifact.
- Pause only through
  `effectime_private.pause_created_identity_cleanup_scheduler_v1()`. This is a
  containment step when the worker itself is harmful; it does not resolve
  pending Auth identities. Preserve the queue and resume with the same jobs
  after repair.
- Do not update `status`, identity UUIDs, attempts or timestamps directly; do not
  delete `provisioning`, `pending_auth`, `provisioned` or `completed` jobs; and do
  not recreate a missing Auth identity.
  Any exceptional data repair requires reviewed forward-only SQL, backup/restore
  evidence and release/privacy authority approval.
- Rotate a suspected scheduler trigger secret or legacy anon JWT through the
  approved secret process, prove the static job resolves the new Vault value,
  reject the old value and then prove worker success before reopening writes.
  A service-role compromise additionally requires normal project-wide privileged
  key rotation; the scheduler itself must never store or transmit that key.

## Privacy and retention

The design persists a minimal workspace/intent saga before Auth, and on the
compensation path removes tenant-visible membership/profile data before Auth
deletion. It stores no email, name, password, token or arbitrary provider error
text in the outbox. Workspace, cleanup intent, and any later-bound user/membership
UUIDs remain pseudonymous personal identifiers. Successful `provisioned` rows are
also retained as server postcondition evidence. Access is therefore restricted
to the minimum operations/security group, monitoring is aggregate, and incident
exports require the normal PII evidence controls.

The migration does not define automatic pruning. `provisioned` and `completed`
rows must not be deleted until the privacy/security owners approve a purpose,
retention period, legal basis, deletion mechanism and audit evidence.
`provisioning`/`pending_auth` rows, including a no-visible-Auth intent, are
operational recovery evidence and must never be removed by a generic retention
task.

## Immediate release NO-GO conditions

- Database migration/history or restored-staging schema differs from the approved
  candidate, clean replay is red, or the PostgreSQL/Edge contracts above fail.
- Any new writer/worker is deployed before all exact v1/v2 RPCs are present and the
  PostgREST schema cache is verified.
- The four Edge artifacts do not map to the same frozen SHA/source digest, or
  production is still running an Auth-first compensation writer.
- Scheduler is absent, disabled, unmonitored, overlapping without evidence, bound
  to a different project/key, or lacks a retained successful invocation.
- Queue claim/finish returns 503, authorization returns 403, a response is
  malformed, `pending`/`receipt_failures` is non-zero in release smoke, or backlog/attempt
  alerts are firing.
- Saga registration is not committed before Auth, a writer can return success
  without the strict `provisioned` server receipt, or a late prepare rollback
  loses the original `provisioning` row.
- A no-visible-Auth intent is treated as successful/terminal instead of remaining
  retryable `provisioning`; a `pending_auth` identity still has membership/profile
  data; a `completed` identity still exists in Auth; direct table grants exist;
  or a non-service role can execute a saga/cleanup RPC.
- A legacy temporary-profile delete can cross an event-extension or permanent-
  upgrade race, accepts an expired token, cannot complete a safe same-owner Auth
  cascade, or returns success after any uncertain Auth/database result.
- Required backup/restore, monitoring/alert test, rollback owner, provider IDs,
  privacy access/retention decision or staging failure/recovery smoke is absent.
- Instant identity creation cannot be paused for an unsafe DB/Edge interval or
  reopened only after verified health.

Release evidence must include the frozen SHA, migration head, exact contract test
results, Edge deployment IDs/source digest, scheduler configuration and job ID,
redacted smoke evidence, aggregate pre/post queue metrics, alert test and the named
GO authority. A Git push, green web build or one HTTP 200 is not deployment proof.
