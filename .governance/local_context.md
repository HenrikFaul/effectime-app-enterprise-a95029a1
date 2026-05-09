# Local Context Guide

Use these files as the primary context for AI-assisted development work.

## Session-start read order
1. `AI_EXECUTION_PROMPTS.md` (root) — master session bootstrap; contains full read order, anti-regression rules, versioning policy, and governance rules
2. `codingLessonsLearnt.md` (root) — documented failure patterns
3. `CHANGELOG.md` (root) — completed feature registry
4. `.governance/controller.md`
5. `.governance/agent_execution_rules.md`
6. `.governance/ui_ux_rules.md` when UI is affected
7. Latest `versioning/*.md` files relevant to the task

> Note: `.governance/codingLessonsLearnt.md` does NOT exist.
> The canonical file is `codingLessonsLearnt.md` at the repository root.

## Behavior expectation
Treat user requests as execution instructions when the next step is clear.
Do not ask repeated permission for GitHub, Jira, changelog, governance, or documentation updates when those are already implied by the request.
