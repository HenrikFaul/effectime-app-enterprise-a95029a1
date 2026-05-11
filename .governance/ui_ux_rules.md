# UI UX Rules

This file contains shared UI and UX rules for this repository.

## Primary rule
- Never damage already working user flows while improving design.

## Required checks
- preserve existing feature entry points
- validate mobile and desktop layouts
- avoid overflow and broken focus states
- keep dropdown options readable
- keep menus, CTAs, filters, dialogs, and navigation usable

## Design expectations
- hierarchy first
- grouping and consistency
- mobile-first thinking
- accessibility and readability
- minimal-regression redesigns

## Core principle: Full localization (non-negotiable, from v3.7.2)
Every user-facing string in every new feature MUST be added to ALL existing locale
resources in the same change. Current supported locales: **en** and **hu**. Czech,
Slovak, and Polish are planned and will become mandatory the moment their resource
files appear in `src/i18n/resources/`.
- Never hardcode UI text in components; always use `useI18n()` and `t('namespace.key')`.
- When a new locale is added later, every key already exists — just fill in the translation.
- If the feature has 3 strings, all 3 go into every active locale file. No partial localization.
- **Authoritative controller:** `AI_PROMPTING_FOLDERSTRUCTURE/localization_controller.md`
  defines the full methodology — locale discovery, source authoring, terminology governance,
  translation memory, self-review checklist, pseudolocalization QA, string-authoring rules,
  fail conditions, and per-feature deliverable format. It is mandatory reading for any
  task involving user-facing copy.

## Core principle: Browser Back button must always work (non-negotiable, from v3.7.2)
All intra-app navigation that the user can meaningfully go "back" from MUST push a new
history entry (pushState), not replace the current one (replaceState).
- In React Router's `setSearchParams(next, options)`, omit `{ replace: true }` for tab /
  view changes. Only use `replace: true` for one-time URL cleanup (invite tokens, redirects).
- URL parameters must not expose user IDs, workspace IDs, session tokens, or any PII.
  Tab and view names (e.g. `?tab=calendar`) are safe and preferred.
- Test: clicking a tab, then pressing the browser Back button MUST return to the
  previous tab — not to the landing page or a blank state.
