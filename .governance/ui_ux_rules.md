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
Every user-facing string in every new feature MUST be added to ALL supported language
files simultaneously. Current supported locales: **en** and **hu**.
- Never hardcode UI text in components; always use `useI18n()` and `t('namespace.key')`.
- When a new locale is added later, every key already exists — just fill in the translation.
- Add the key to `src/i18n/resources/en.ts` AND `src/i18n/resources/hu.ts` in the same commit.
- If the feature has 3 strings, all 3 go into both files. No partial localization.

## Core principle: Browser Back button must always work (non-negotiable, from v3.7.2)
All intra-app navigation that the user can meaningfully go "back" from MUST push a new
history entry (pushState), not replace the current one (replaceState).
- In React Router's `setSearchParams(next, options)`, omit `{ replace: true }` for tab /
  view changes. Only use `replace: true` for one-time URL cleanup (invite tokens, redirects).
- URL parameters must not expose user IDs, workspace IDs, session tokens, or any PII.
  Tab and view names (e.g. `?tab=calendar`) are safe and preferred.
- Test: clicking a tab, then pressing the browser Back button MUST return to the
  previous tab — not to the landing page or a blank state.
