# Effectime operational runbooks v1

These runbooks define the minimum evidence and decision boundaries for a safe
Effectime release. They do not authorize production access or deployment.

- [Release](release.md) — immutable-artifact release gate and rollout order.
- [Rollback](rollback.md) — recovery decision tree without ad-hoc data deletion.
- [Incident response](incident.md) — severity, containment and evidence handling.
- [Backup and restore](restore.md) — isolated restore drill and acceptance checks.

System owners must fill in the production owner, hosting provider, escalation
contacts, RPO, RTO and retention values before these documents can be treated as
production-complete.
