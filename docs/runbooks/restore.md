# Backup and restore runbook v1

## Required owner decisions

Production owner, backup provider/location, encryption/key owner, retention, RPO and
RTO are intentionally not guessed here. A release is not disaster-recovery ready
until these fields are approved and a timed restore proves them.

## Pre-restore checks

- Identify backup timestamp, database/project identity, schema migration head and checksum.
- Verify encryption, access authorization and retention status.
- Create an isolated target; never test by restoring over production.
- Preserve current production state and incident evidence.

## Isolated restore drill

1. Restore the selected backup into a new, access-restricted environment.
2. Record start/end times and all provider/database operation identifiers.
3. Compare schema inventory and migration head with the backup record.
4. Validate row counts and referential integrity for workspace, membership, leave,
   attendance, payroll, quota, decision and audit domains.
5. Run RLS/RPC negative tests with two tenants and representative roles.
6. Run critical read/write smoke tests without calling real email/webhook providers.
7. Confirm secrets and external endpoints are staging-safe before enabling Edge Functions.
8. Destroy the isolated copy through the approved retention process after evidence review.

## Acceptance criteria

- Restore completes within the approved RTO and loses no more than the approved RPO.
- Schema and migration fingerprints match the selected backup.
- Tenant isolation and critical data invariants pass.
- Evidence contains timestamps, operator, backup ID, target ID, results and cleanup record.

Production restoration requires explicit incident/release authority approval and a
post-restore reconciliation plan for writes made after the backup timestamp.
