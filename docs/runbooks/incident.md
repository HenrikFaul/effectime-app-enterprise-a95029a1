# Incident-response runbook v1

## Severity guide

- **SEV-1:** confirmed tenant isolation/auth bypass, active data loss, broad outage.
- **SEV-2:** critical workflow unavailable or material integrity risk with limited scope.
- **SEV-3:** degraded non-critical function with a safe workaround.

## First 15 minutes

1. Name an incident commander, operations lead and note taker.
2. Record UTC start time, discovery source, affected tenant/workflow and current release SHA.
3. Preserve request/correlation IDs, logs and deployment/database identifiers.
4. Contain with the smallest tested action; do not weaken auth, RLS, CORS or validation.
5. For suspected cross-tenant or credential exposure, rotate/revoke through the approved
   secret-management process and restrict access to evidence containing PII.
6. Start a timestamped decision log and choose monitor, mitigate or rollback.

## Investigation checklist

- Reproduce in an isolated environment with the same SHA and schema head.
- Separate frontend, Edge, database, external provider and queue symptoms.
- Check recent migration, entitlement, RLS/RPC and deployment changes.
- Quantify affected tenants, records and time range; do not paste raw PII into tickets.
- Verify retries/idempotency before replaying jobs or webhooks.

## Recovery and closure

- Validate tenant/RBAC negative cases and data invariants before reopening writes.
- Reconcile queued, duplicated or partially completed side effects.
- Confirm monitoring stability through the agreed observation window.
- Document root cause, contributing controls, detection gap and owned corrective actions.
- Treat legal/customer notification as an authorized external process, not an engineering
  chat action.
