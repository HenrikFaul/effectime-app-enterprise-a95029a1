# CLAUDE.md

**Read `AI_EXECUTION_PROMPTS.md` first.** It contains the full session-start read order, anti-regression mandate, mistake-prevention rules, versioning/PR policy, and all non-negotiable governance rules.

## Quick reference (see AI_EXECUTION_PROMPTS.md for full detail)

Read order every session:
1. `AI_EXECUTION_PROMPTS.md` ← start here
2. `codingLessonsLearnt.md` — avoid documented mistakes
3. `CHANGELOG.md` — do not regress completed features
4. `.governance/controller.md`
5. `.governance/agent_execution_rules.md`
6. `.governance/ui_ux_rules.md` when UI is affected
7. Latest `versioning/*.md` relevant to the task

Required behavior:
- **ALWAYS fetch + rebase on `origin/main` BEFORE writing code or editing CHANGELOG.md.** Other PRs may have merged into `main` since the feature branch was created — failing to rebase causes CHANGELOG conflicts and version-number collisions. Run `git fetch origin main && git rebase origin/main` (or `git pull --rebase origin main`) at the start of every session, and again before any CHANGELOG edit. Resolve conflicts manually; never force-push without verifying nothing was lost.
- When adding a CHANGELOG entry, first read the **current top of `CHANGELOG.md` on `origin/main`** to pick the next free version number (do not duplicate an existing version).
- Preserve existing working features
- Prefer minimal-risk fixes
- Update `CHANGELOG.md` + `codingLessonsLearnt.md` when naturally implied by the task
- Validate desktop/mobile UX when touching UI
- Create a `versioning/*.md` file for every PR or significant delivery
- **LOCALIZATION (non-negotiable from v3.7.2):** Every new user-facing string MUST be added to BOTH `src/i18n/resources/en.ts` AND `src/i18n/resources/hu.ts` in the same commit. Never hardcode text in components — use `useI18n()` → `t('namespace.key')`. When more languages are added, add to all of them. See `.governance/ui_ux_rules.md` § "Core principle: Full localization".
- **BROWSER BACK BUTTON (non-negotiable from v3.7.2):** Tab/view navigation MUST use pushState (omit `{ replace: true }` from `setSearchParams` for tab changes). Back button must return to the previous tab, never drop the user to the landing page. URLs must not expose PII or internal IDs. See `.governance/ui_ux_rules.md` § "Core principle: Browser Back button".
