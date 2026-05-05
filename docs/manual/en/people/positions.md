# Positions and skill expectations

Two paths exist for assigning a position:

1. **Custom label** (preserved): type any text in the position field.
2. **Predefined catalog**: open the picker → choose a category → choose a position → review recommended skill expectations → choose seniority → apply.

The catalog is workspace-scoped (`enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_role_skills`) and seeded from the global catalog (`enterprise_catalog_*`).

## Skill inheritance

Selecting a catalog position attaches a recommended set of skills. By default, **required** skills are pre-checked; you can opt-in or opt-out per skill before saving. Skills are stored on the membership with traceability (manual vs catalog-inherited).

## Seniority

Seniority is a property of the membership-position assignment, not of the catalog entry. Available levels: junior, medior, senior, lead, principal.
