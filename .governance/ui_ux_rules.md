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
- In React Router's `setSearchParams(next, options)` and `navigate(to, options)`, omit
  `{ replace: true }` for tab / view / page changes. Only use `replace: true` for:
  - one-time URL cleanup of consumed tokens (invite tokens, OAuth state, email
    activation tokens, reset-password tokens);
  - server-driven redirects where the source URL has no meaning to the user
    (e.g. auto-redirecting `/app` → `/w/<lastUsed>` for a returning user);
  - the legacy-URL migration shim that rewrites old query-param URLs to the
    new path shape.
  Anything that the user clicked must produce a real history entry.
- URL parameters must not expose user IDs, session tokens, email addresses, or
  any PII. Tab and view names (e.g. `?tab=calendar`) are safe and preferred.
- Test: clicking a tab, then pressing the browser Back button MUST return to the
  previous tab — not to the landing page or a blank state. Same for picking a
  workspace from the picker: back from a tab inside that workspace returns to
  the picker, never to `/`.

## Core principle: Workspace identifier in URL (non-negotiable, from v3.16.0)
The active workspace's UUID is part of the URL path for every workspace-scoped
route, using the shape `/w/<workspaceId>/<rest>`. This is an explicit exception
to the "no internal IDs in URLs" rule above — workspace UUIDs ARE permitted
because they are non-secret tenant identifiers and deep-linking into a specific
workspace is a primary product affordance (sharing links with teammates,
bookmarking).
- The workspace picker lives at `/app`. A returning user with a valid last-used
  workspace is automatically redirected (replace) to `/w/<id>`.
- The dashboard lives at `/w/:workspaceId`. Tab navigation inside the dashboard
  still uses `?tab=<name>` query params (NOT path segments) so the existing
  push-history tab behavior is preserved.
- Picking a workspace from the picker MUST use `navigate('/w/<id>')` (push),
  never `setSearchParams(..., { replace: true })`. The picker step must be a
  real history entry so the Back button works.
- "Change workspace" navigation from a dashboard goes to `/app?select=1` so
  the picker always shows (no auto-redirect).
- Bookmarks to the legacy `/app?ws=<uuid>` shape continue to work — the
  Enterprise route redirects (replace) them to `/w/<uuid>` on first mount.
- User IDs, session tokens, and emails STILL must not appear in URLs. Only
  workspace UUIDs are permitted as path identifiers.
