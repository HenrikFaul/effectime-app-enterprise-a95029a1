# AI_EXECUTION_PROMPTS.md — Effectime Enterprise Dev Governance

> **Ez a fájl az első olvasandó minden fejlesztési session elején.**
> Read this file first, then follow the Session-start read order before writing any code.

---

## Session-start read order

Read ALL of the following before implementing anything:

| # | File | When |
|---|------|------|
| 1 | `AI_EXECUTION_PROMPTS.md` | ← you are here, always |
| 2 | `codingLessonsLearnt.md` | always — avoid previously documented mistakes |
| 3 | `CHANGELOG.md` | always — know what is already built; never regress it |
| 4 | `.governance/controller.md` | always — core governance rules |
| 5 | `.governance/agent_execution_rules.md` | always — execution authority |
| 6 | `.governance/ui_ux_rules.md` | only when UI is touched |
| 7 | Latest `versioning/*.md` file(s) relevant to the task | when the task relates to a known module |

Do not skip steps 2 and 3. They are the primary defense against regressions and repeated mistakes.

---

## Anti-regression mandate

`CHANGELOG.md` is the authoritative registry of completed features.

Before any implementation:
- Identify every CHANGELOG entry the change could affect
- After implementation, verify those features still work
- Never ship code that breaks a feature listed as complete in CHANGELOG

If a user requests something already marked done in CHANGELOG, clarify before re-implementing.

---

## Mistake-prevention mandate

`codingLessonsLearnt.md` contains documented failure patterns with `[LESSON-*-NNN]` identifiers.

Before any implementation:
- Search for lessons relevant to the current task domain (auth, seeder, jira, routing, RLS, UI, etc.)
- Apply each applicable lesson proactively — do not rediscover known traps
- **Never repeat a mistake that already has a `[LESSON-*]` entry**

---

## Continuous knowledge capture

**New failure pattern, unexpected behavior, or non-obvious insight discovered during a session →**
Append a new `[LESSON-CATEGORY-NNN]` block to `codingLessonsLearnt.md` (root).
Use the `## ➕ APPEND — YYYY-MM-DD` section format already present in that file.

**Feature delivered, bug fixed, or infrastructure changed →**
Append to `CHANGELOG.md` (root) under the correct date/version header.
Include: what changed, which files, what was fixed or added, acceptance criteria.

Both updates must be committed together with the implementation changes in the same or the very next commit.

---

## Versioning and PR policy

For every PR or significant delivery:

1. Create `versioning/DDMMYYNNN_vX.Y.Z_short-slug.md` before or alongside the PR
2. Write into it: goals, files added/changed/removed, implementation details, acceptance criteria
3. Add the corresponding entry to `CHANGELOG.md`
4. **PR title and description must summarize the versioning file**: goals, key technical decisions, files changed, acceptance criteria checklist

Naming convention:
```
versioning/DDMMYYNNN_vX.Y.Z_slug.md
```
- `DDMMYY` = date (e.g. `090526` = 2026-05-09)
- `NN` = two-digit sequence for same-day files (`01`, `02` …)
- `vX.Y.Z` = semantic version matching CHANGELOG
- `slug` = 2–5 word kebab-case delivery summary

If a PR was merged without a versioning file, create it retrospectively from the PR description and commit history, then reference it in a follow-up commit on the same branch.

---

## Execution authority

Treat user requests as execution instructions:
- GitHub, Jira, changelog, governance, documentation action → **execute without asking** if it is the natural next step
- Ask only when: genuine ambiguity exists, or action is destructive, external, production-affecting, or security-sensitive

**Default flow per session:**
1. Read all session-start files (see table above)
2. Identify root cause / scope
3. Compare ≥ 2 solution options when risk is non-trivial
4. Implement
5. Regression-check against CHANGELOG — verify affected features still work
6. Update `CHANGELOG.md` + `codingLessonsLearnt.md` + versioning file
7. Commit + push to the designated development branch

---

## Governance artifact update order

When governance updates are needed, prefer this sequence:
1. `codingLessonsLearnt.md` (root) — new lessons first
2. `CHANGELOG.md` (root) — feature/fix record
3. `versioning/*.md` — delivery artifact for the PR
4. `.governance/*.md` — structural rule changes only when needed
5. Summary back to the user

---

## Non-negotiable rules

- Never break already working functionality
- Prefer the smallest regression-risk solution
- Re-check affected flows after every change
- Always update `CHANGELOG.md` + `codingLessonsLearnt.md` when the task implies it
- Validate desktop + mobile UX when touching UI components
- One canonical source per rule — do not scatter the same constraint across multiple files

---

## Session-end housekeeping checklist

Before ending any session that involved code changes:
- [ ] `codingLessonsLearnt.md` captures every new lesson from this session
- [ ] `CHANGELOG.md` reflects all deliverables from this session
- [ ] A `versioning/*.md` file exists for any significant delivery
- [ ] All changes are committed and pushed to the correct branch

---

## [LESSON-*] format discipline

New lessons appended to `codingLessonsLearnt.md` must use this exact format:

```markdown
## ➕ APPEND — YYYY-MM-DD Short section title

### [LESSON-CATEGORY-NNN]: Short descriptive title
**Context**: When / where this applies
**Problem**: What went wrong or what is the trap
**Fix**: What to do instead
**Pattern** (optional):
\`\`\`ts
// reusable code or config snippet
\`\`\`
```

Active lesson category prefixes (extend as needed):
`AUTH-OAUTH` · `ADF` · `AI` · `CATALOG` · `EMAIL` · `GOVERNANCE` · `JIRA` · `ORGCHART` · `POSITION` · `ROUTING-SPA` · `SEED` · `SELECTITEM` · `SUPABASE-SDK` · `THEME-CSS` · `WEBHOOK-HMAC`

---

## Additional governance rules (added 2026-05-09)

### Schema migration discipline
- Before creating a new migration, run `list_migrations` / check `supabase/migrations/` to avoid duplicate columns or conflicting names
- Always include `IF NOT EXISTS` / `IF EXISTS` guards
- Migration filenames: `YYYYMMDD_HHMMSS_short_description.sql`

### RLS policy check
- Every new table must have explicit RLS policies before use; a table with RLS enabled but zero policies returns 0 rows silently
- After creating a table, verify policies cover the required roles (anon, authenticated, service_role)

### Edge function checklist
After creating or updating a Supabase Edge Function:
1. Register it in `supabase/config.toml` (`verify_jwt` flag must be explicit)
2. Deploy with `supabase functions deploy <name>`
3. Update `CHANGELOG.md` + versioning file

### Seeder / demo-data safety
- Never hard-code workspace IDs or user UUIDs in seeders — always derive dynamically
- Use Auth Admin REST API (`fetch('/auth/v1/admin/users', { method: 'POST' })`) with service role key rather than `supabase.auth.admin.createUser()` which has silent failures in some SDK versions
- Tag demo auth users with `app_metadata.is_demo_persona: true` so they can be identified without schema changes
- Always scope all inserts to `workspace_id`; existing CASCADE on `enterprise_workspaces` handles cleanup

### TypeScript type sync
After any schema migration that adds/removes columns or tables, regenerate types:
```bash
supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
```

### Jira integration rules
- Use `/project/{key}` (string key) to look up project metadata; `/issuetype/project?projectId=` expects a numeric ID and these are different
- Jira search: cascade three endpoints — `POST /search/jql` → `GET /search/jql` → `GET /search` (legacy); first 2xx wins
- Request `fields: ['*all']` to avoid missing custom fields
- Parse description with `adfToText()` (recursive ADF walker) — never assume it is a plain string

### Breaking change protocol
If a change removes, renames, or fundamentally alters an existing feature:
1. Document under `## Breaking changes` in the CHANGELOG entry
2. Add a `[LESSON-*]` entry if a non-obvious insight was gained
3. Verify all callers / consumers of the changed interface before shipping

### Branch and commit discipline
- Development branch: always use the branch specified in session context (see system prompt / CLAUDE.md)
- Never push to `main` directly
- Commit message format: `type(scope): short description` where type ∈ {feat, fix, refactor, docs, chore}
- Governance-only commits use type `docs`
