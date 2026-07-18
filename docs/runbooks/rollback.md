# Rollback runbook v1

## Decision boundary

The incident commander and release authority decide rollback. Production rollback
is an external, potentially data-affecting action and requires explicit approval.

## Trigger examples

- Tenant isolation, authentication or authorization regression.
- Data corruption, duplicate ledger effects or failed migration contract.
- Sustained error/latency breach after rollout.
- Critical user flow unavailable with no lower-risk mitigation.

## Procedure

1. Stop further rollout and preserve logs, request IDs, release SHA and timestamps.
2. Disable the affected feature through an already-approved flag only if that path is tested.
3. Web: redeploy the previous immutable artifact; do not rebuild the old source.
4. Edge: redeploy the previous known-good function artifact/version.
5. Database: prefer a reviewed forward repair that restores the prior contract.
6. Use backup restore only when the incident commander confirms forward repair is unsafe.
7. Re-run tenant/RBAC, integrity and critical-path smoke checks.
8. Keep the incident open until metrics stabilize and all write paths are reconciled.

## Database prohibitions

- Do not delete or rewrite request, decision, quota, payroll or audit ledgers ad hoc.
- Do not mark migrations applied without content/hash reconciliation.
- Do not run destructive down-migrations without verified backup and explicit approval.
- Do not restore production over the current database before preserving forensic evidence.

## Completion evidence

Record the failed and restored SHAs, affected tenants/time window, data reconciliation,
smoke results, monitoring recovery and follow-up owner.
