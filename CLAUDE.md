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
8. `marketing/SYSTEM.md` — when the task has user-facing, positioning, or feature-announcement implications

Required behavior:
- **ALWAYS fetch + rebase on `origin/main` BEFORE writing code or editing CHANGELOG.md.** Other PRs may have merged into `main` since the feature branch was created — failing to rebase causes CHANGELOG conflicts and version-number collisions. Run `git fetch origin main && git rebase origin/main` (or `git pull --rebase origin main`) at the start of every session, and again before any CHANGELOG edit. Resolve conflicts manually; never force-push without verifying nothing was lost.
- When adding a CHANGELOG entry, first read the **current top of `CHANGELOG.md` on `origin/main`** to pick the next free version number (do not duplicate an existing version).
- Preserve existing working features
- Prefer minimal-risk fixes
- Update `CHANGELOG.md` + `codingLessonsLearnt.md` when naturally implied by the task
- Validate desktop/mobile UX when touching UI
- Create a `versioning/*.md` file for every PR or significant delivery
- **Create a `marketing/marketing_values/*.md` file for every PR or significant delivery** alongside the `versioning/*.md` file. See `marketing/marketing_values/README.md` for required format and naming convention. Document: the user-language problem solved, which personas benefit, what marketing claims it enables, what content angles it suggests, and which marketing library files to update.
- **LOCALIZATION (non-negotiable from v3.7.2):** Every new user-facing string MUST be added to ALL existing locale resources in the same commit (currently `src/i18n/resources/en.ts` and `src/i18n/resources/hu.ts`; Czech, Slovak, Polish will be added later). Never hardcode text in components — use `useI18n()` → `t('namespace.key')`. **Authoritative controller:** `AI_PROMPTING_FOLDERSTRUCTURE/localization_controller.md` — read it before any feature work involving user-facing copy. It defines the discovery → authoring → terminology → translation → self-review → QA workflow and the per-feature deliverable format. See also `.governance/ui_ux_rules.md` § "Core principle: Full localization".
- **BROWSER BACK BUTTON (non-negotiable from v3.7.2):** Tab/view navigation MUST use pushState (omit `{ replace: true }` from `setSearchParams` for tab changes). Back button must return to the previous tab, never drop the user to the landing page. URLs must not expose PII or internal IDs. See `.governance/ui_ux_rules.md` § "Core principle: Browser Back button".

## Marketing system

The `marketing/` folder contains a complete marketing prompt library for Effectime. It is governed by `marketing/SYSTEM.md`.

**When a feature is delivered:**
1. Create `versioning/DDMMYYNNN_vX.Y.Z_slug.md` (engineering record — always required)
2. Create `marketing/marketing_values/YYYYMMDD_vX.Y.Z_feature-slug_marketing_value.md` (marketing record — always required)
3. Commit both in the same release

**The marketing_values/ folder** is the bridge between product development and marketing. Marketing AI agents read it to understand what has been built and what claims can be made. See `marketing/marketing_values/README.md` for the required file format.

**When producing marketing assets** (copy, campaigns, content, visuals), route through `marketing/SYSTEM.md` first, then use the specialist file from the routing table there.

