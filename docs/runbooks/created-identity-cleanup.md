# Created enterprise identity cleanup runbook v1

## Purpose and boundary

This runbook operates the v3.51.7 durable provisioning saga and database-first
compensation path for enterprise instant identities. Its safety objective is to
commit recovery intent before the Auth request, prove successful provisioning
server-side, and prevent a failed or interrupted create from leaving unowned
tenant-visible data while cleanup remains uncertain.

This document does not authorize production access, secret creation, migration
apply or deployment. The named database, Edge, security/privacy and release
owners must approve those actions for the target environment.

## Implemented contract

- Migration `20260721234500_v3_51_7_created_identity_compensation.sql` creates
  the private `effectime_private.created_identity_cleanup_jobs` saga/outbox and
  six service-role-only RPCs:

  1. `register_created_enterprise_identity_provisioning_v1(uuid, uuid)`;
  2. `prepare_created_enterprise_identity_cleanup_v1(uuid, uuid, uuid)`;
  3. `complete_created_enterprise_identity_provisioning_v1(uuid, uuid, uuid)`;
  4. `claim_created_enterprise_identity_cleanup_jobs_v1(integer)`;
  5. `complete_created_enterprise_identity_cleanup_v1(uuid, uuid)`;
  6. `fail_created_enterprise_identity_cleanup_v1(uuid, uuid, text)`.
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
- `cleanup-temp-users` claims at most 25 due `provisioning` or `pending_auth`
  jobs and reconciles them before its existing temporary-profile cleanup. For a
  `provisioning` job it first retries database prepare, discovers/binds the Auth
  identity through exact `app_metadata`, and proceeds to Auth deletion only
  after prepare succeeds. The endpoint is gateway protected and also requires
  the exact environment's service-role bearer credential.
- The job table contains UUID references, state, bounded error codes and
  timestamps. It intentionally has no direct grant even for `service_role`; the
  reviewed SECURITY DEFINER RPCs are the only runtime interface.

The current source does **not** install a production scheduler for this worker.
A deployed worker without a monitored recurring invocation is not an operational
implementation and remains a release NO-GO.

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
- Claim uses `FOR UPDATE SKIP LOCKED`, increments `attempt_count` and grants a
  separate five-minute lease. A crashed invocation becomes claimable after lease
  expiry.
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
- A state-compatible preparation or Auth failure clears the lease and schedules
  exponential retry with `min(3600, 30 * 2^min(attempt_count, 7))` seconds.
  Because claim increments the count first, the first recorded failure is
  retried after 60 seconds; the delay is capped at one hour. The bounded codes
  are `identity_not_visible`/`database_cleanup_failed` for `provisioning`
  and `database_cleanup_failed`/`auth_lookup_failed`/`auth_delete_failed`
  for `pending_auth`.
- A completion/failure receipt error leaves the job pending. If the receipt did
  not commit, its existing lease expires and makes the job claimable again.
- There is no automatic terminal dead-letter or maximum-attempt deletion. This
  is deliberate: uncertain identity cleanup evidence must remain retryable and
  visible until an operator resolves the underlying fault.
- `provisioned` and `completed` are terminal and are not claimable. Repeated
  exact-ID Auth deletion and cleanup completion are idempotent. Operators must
  not create substitute users, bind an intent by hand, edit identity fields,
  mark rows terminal or delete saga evidence manually.

The `identity_cleanup.pending` field in one worker response counts claimed jobs
that were not completed in that invocation. It is not the total queue depth.
Use the private aggregate queries below for backlog monitoring.

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
   statuses and both terminal paths, exact metadata binding, six service-only
   RPC ACLs, cross-workspace denial, five-minute grace/lease, no-visible-Auth
   retry, late prepare rollback with saga preservation, provisioning postcondition
   receipt, claim/fail retry and Auth-before/after cleanup completion. It must
   additionally prove that every claimed `pending_auth` retry re-prepares the
   database before Auth access, non-service membership/profile writes cannot
   resurrect pending/completed identities, finalization re-deletes/rechecks rows
   under workspace and user gates, and a two-session writer/finalizer race
   serializes without residue. Targeted fixture success never replaces a clean
   migration replay and restored-staging schema comparison.
4. Confirm `supabase/config.toml` still has
   `[functions.cleanup-temp-users] verify_jwt = true` and that the function's
   application-level service-role credential comparison remains present.
5. Prepare aggregate monitoring, a tested alert route and a single-concurrency
   recurring scheduler in staging. Do not paste a service key into SQL, source,
   logs, tickets or scheduler command text. Bind the function origin and bearer
   from the target environment's approved secret manager.
6. Pause new enterprise instant-identity creation for the short database-to-Edge
   rollout interval. If that write pause is unavailable, release authority must
   explicitly reject the rollout until a tested equivalent containment exists.

## Rollout order

The order is mandatory: **database migration first, matching Edge artifacts
immediately after, scheduler last**.

1. Apply the approved migration to staging. Do not deploy a new writer before
   the RPCs exist.
2. After PostgREST schema-cache reload, verify all six exact RPC signatures,
   `postgres` ownership, fixed search paths and EXECUTE only for `service_role`.
   Verify RLS is enabled on the private table and that PUBLIC, `anon`,
   `authenticated` and `service_role` have no direct table privileges.
3. Deploy these three Edge Functions from the same frozen SHA:
   `create-instant-enterprise-member`, `join-event` and `cleanup-temp-users`.
   Record each immutable provider deployment/version ID and Edge source digest.
4. Run both successful-provisioning and failed-compensation staging smoke tests,
   including the strict terminal receipts and the manual checks below.
5. Install or enable the recurring scheduler only after the worker is verified.
   The initial operating target is one invocation every five minutes, with no
   overlapping invocations. The chosen interval must be lower than the accepted
   orphan-Auth recovery objective and must account for the legacy temporary-user
   scan that runs in the same function. Measure actual duration and reduce the
   interval only after proving that scan cannot overlap or overload the service.
6. Retain the scheduler provider/job ID, exact schedule, target project reference,
   last successful invocation, HTTP result and response summary in release
   evidence. For a database `pg_cron`/`pg_net` scheduler, add it through a
   separately reviewed forward-only migration using environment-matched Vault
   secrets; do not install it as untracked ad-hoc production SQL.
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
  -Uri "$env:EFFECTIME_CLEANUP_FUNCTION_ORIGIN/functions/v1/cleanup-temp-users" `
  -Headers $cleanupHeaders `
  -Body "{}"
```

Expected HTTP status is 200 and the JSON response must contain an
`identity_cleanup` object with integer `claimed`, `completed`, `pending` and
`receiptFailures` values. HTTP 403 means the credential boundary rejected the
call. HTTP 500 with `Identity cleanup queue unavailable`, a malformed summary or
any non-zero `receiptFailures` is an operational failure, not a successful drain.

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
`pending`, `receiptFailures`, aggregate depth and age for both active states,
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
8. Run the active-state checks with two concurrent worker invocations. Each job
   must be claimed by at most one active lease. Also race finalization against
   profile and membership insertion: the writer must wait/fail, `completed`
   must commit without tenant-visible or Auth rows, and no terminal ghost may
   appear.
9. Confirm the scheduler captures the first successful response and that alerts
   fire when the schedule is temporarily disabled in staging.

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
5. A queue-unavailable 500, provisioning postcondition failure or receipt failure
   requires database/PostgREST review. Do not return successful provisioning
   without its `provisioned` receipt. Do not interpret an Auth delete response as
   cleanup completion without the exact post-delete lookup and `completed`
   receipt.
6. After repair, invoke one bounded batch, verify aggregate invariants, then let
   the monitored scheduler drain naturally. Avoid concurrent manual drain loops.
7. Close only after backlog age and attempts return to normal, all affected jobs
   are reconciled, tenant/RBAC checks pass and the privacy owner has reviewed any
   exposure or retention impact.

## Rollback and forward repair

- If migration apply fails, do not deploy any of the three new Edge artifacts.
- After the additive migration is applied, prefer a forward Edge/database repair.
  Keep the private table and durable jobs; do not run a destructive down-migration.
- Rolling the writers back to an older Auth-first compensation path reintroduces
  the orphan-membership failure and is unsafe. Disable instant identity creation
  while deploying the last known-good **database-first-compatible** Edge artifact.
- Pausing the scheduler is a containment step only when the worker itself is
  harmful. It does not resolve pending Auth identities. Preserve the queue and
  resume with the same jobs after repair.
- Do not update `status`, identity UUIDs, attempts or timestamps directly; do not
  delete `provisioning`, `pending_auth`, `provisioned` or `completed` jobs; and do
  not recreate a missing Auth identity.
  Any exceptional data repair requires reviewed forward-only SQL, backup/restore
  evidence and release/privacy authority approval.
- Rotate a suspected exposed service-role key through the approved secret process,
  update the scheduler atomically for the same project, and prove old-key rejection
  plus new-key worker success before reopening writes.

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
- Any new writer is deployed before all six exact RPCs are present and the
  PostgREST schema cache is verified.
- The three Edge artifacts do not map to the same frozen SHA/source digest, or
  production is still running an Auth-first compensation writer.
- Scheduler is absent, disabled, unmonitored, overlapping without evidence, bound
  to a different project/key, or lacks a retained successful invocation.
- Queue claim returns 500, service authorization returns 403, a response is
  malformed, `receiptFailures` is non-zero in release smoke, or backlog/attempt
  alerts are firing.
- Saga registration is not committed before Auth, a writer can return success
  without the strict `provisioned` server receipt, or a late prepare rollback
  loses the original `provisioning` row.
- A no-visible-Auth intent is treated as successful/terminal instead of remaining
  retryable `provisioning`; a `pending_auth` identity still has membership/profile
  data; a `completed` identity still exists in Auth; direct table grants exist;
  or a non-service role can execute a saga/cleanup RPC.
- Required backup/restore, monitoring/alert test, rollback owner, provider IDs,
  privacy access/retention decision or staging failure/recovery smoke is absent.
- Instant identity creation cannot be paused for an unsafe DB/Edge interval or
  reopened only after verified health.

Release evidence must include the frozen SHA, migration head, exact contract test
results, Edge deployment IDs/source digest, scheduler configuration and job ID,
redacted smoke evidence, aggregate pre/post queue metrics, alert test and the named
GO authority. A Git push, green web build or one HTTP 200 is not deployment proof.
