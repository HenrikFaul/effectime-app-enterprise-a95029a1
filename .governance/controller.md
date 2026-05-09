# Shared Dev Governance Controller

This repository follows the central governance pack from HenrikFaul/governance.

## Core rules
1. Never break already working functionality.
2. Read `AI_EXECUTION_PROMPTS.md`, `codingLessonsLearnt.md` (root), and `CHANGELOG.md` (root) before implementation.
3. Prefer the smallest regression-risk solution.
4. Run the available validation steps after implementation.
5. Update changelog and versioning artifacts when the workflow requires it.
6. Treat clear user requests as execution instructions for related non-destructive Jira, GitHub, changelog, governance, and documentation steps.

## Required checklist
- Read `AI_EXECUTION_PROMPTS.md` → `codingLessonsLearnt.md` → `CHANGELOG.md` → relevant `versioning/*.md`
- Identify root cause
- Compare at least two solution options when risk is non-trivial
- Re-check that previously working features still work
- Update required governance and delivery artifacts

## Key files
- `AI_EXECUTION_PROMPTS.md` (root) — session-start master document
- `codingLessonsLearnt.md` (root) — documented failure patterns
- `CHANGELOG.md` (root) — completed feature registry
- `.governance/agent_execution_rules.md` — execution authority rules
- `.governance/business_process_automation_prompts.md`
