# Coverage Rules — Technical Reference

This document is the authoritative reference for the coverage rules system in Effectime Enterprise. It covers the database schema, every field in detail, backward-compatibility notes for the legacy single-value format, the slot-based assignment model, and the exact algorithms used to determine whether a rule applies on a given day and whether a shift assignment matches a rule.

---

## What is a Coverage Rule?

A coverage rule is a declarative statement of minimum staffing requirements for a specific office on specific days. In plain language:

> "This office needs at least N people with [role X and/or skill Y] working on [days M]."

Coverage rules are stored in the `enterprise_office_coverage_rules` table, one row per rule. Each rule is scoped to a single workspace and a single office. When the Capacity Planner renders the coverage matrix, it evaluates every active rule against every day in the current view period, counts how many existing shift assignments match each rule for each day, and computes the coverage status (understaffed / met / overstaffed / not-applicable).

Coverage rules are not schedules. They define demand, not supply. Supply comes from `enterprise_shift_assignments`. The Capacity Planner is the bridge between them.

---

## Rule Fields Reference

### `id` — uuid, primary key

Auto-generated UUID. Used as the identifier in API calls, in the assignment drawer state, and in the Smart Batch Scheduling wizard's rule selection list. Not user-facing.

---

### `workspace_id` — uuid, NOT NULL, foreign key

References the workspace this rule belongs to. All queries on this table include `.eq('workspace_id', workspaceId)` to ensure workspace isolation. Row-Level Security policies on this table enforce that only workspace members can read and write their workspace's rules.

---

### `office_id` — uuid, NOT NULL, foreign key

References `enterprise_offices.id`. The rule applies only to shift assignments at this office. When the Capacity Planner evaluates a rule against a shift, the first check is always `shift.office_id === rule.office_id`.

A rule can belong to only one office. To define the same requirement across two offices, create two separate rules.

---

### `name` — text, nullable

A human-readable label for the rule. Examples:
- `"Budapest HQ — minimum operations"`
- `"Night shift minimum"`
- `"Weekend on-call requirement"`

If `null` or empty string, the Capacity Planner generates a display label from the rule's roles and skills (e.g., "BA, HR" or "SQL"). The `OfficeCoverageRuleManager` shows the name in a primary-styled badge when set; if absent, the rule appears without a name badge.

Maximum 100 characters (enforced by the frontend `maxLength={100}` attribute on the name input).

---

### `business_role` — text, nullable — LEGACY FIELD

The original single-role field from early versions of the coverage rule system. Stores one role name (e.g., `"BA"`, `"HR"`, `"Operator"`).

**This field is maintained for backward compatibility only.** New code reads `business_roles[]` first and falls back to `[business_role]` if the array is null or empty. When a rule is saved through the current `OfficeCoverageRuleManager`, this field is set to `expandedRoles[0]` (the first role in the expanded array) to keep old readers working.

Do not write to this field directly in new code. Use `business_roles[]` instead.

---

### `business_roles` — text[], nullable — PRIMARY FIELD (from v3.40.0+)

The multi-slot role definition array. Each element is a role name. The length of this array defines how many typed headcount slots the rule has. Roles can repeat (e.g., `['BA','BA','HR']` = two BA slots and one HR slot).

The canonical getter in both the Capacity Planner and the Rule Manager is:

```typescript
function ruleRoles(r: CoverageRule): string[] {
  if (r.business_roles && r.business_roles.length > 0) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}
```

When saving a rule through the UI, the save function expands the role selections:

```typescript
const expandedRoles = selectedRoles.flatMap(
  (role) => Array.from({ length: Math.max(1, roleHeadcounts[role] || 1) }, () => role)
);
```

So if the manager selected "BA × 2" and "HR × 1", `expandedRoles = ['BA','BA','HR']`.

**Effect on `min_headcount`**: When `business_roles` is non-empty, `min_headcount` is automatically set to `expandedRoles.length` (3 in the example above). The headcount input in the form becomes a computed/read-only display.

**Empty array**: A `null` or zero-length `business_roles` with a non-null `business_role` means the rule was created by old code. Treat exactly as `[business_role]`.

---

### `skill_id` — uuid, nullable — LEGACY FIELD

The original single-skill field. References `enterprise_skills.id`. Like `business_role`, this is maintained for backward compatibility only. The canonical getter:

```typescript
function ruleSkillIds(r: CoverageRule): string[] {
  if (r.skill_ids && r.skill_ids.length > 0) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}
```

---

### `skill_ids` — uuid[], nullable

The multi-skill requirement array. Each element is a `enterprise_skills.id`. The semantics are **OR** — a shift assignment satisfies the skill requirement if its `skill_id` matches any of the listed skill IDs. Similarly, a candidate member satisfies the skill check if they have any one of the listed skills in `enterprise_member_skills`.

When saving through the UI, `skill_id` (legacy) is set to `selectedSkillIds[0]` and `skill_ids` is set to the full array. This mirrors the behavior of `business_role` / `business_roles`.

If `skill_ids` is null or empty and `skill_id` is also null, the rule has no skill requirement — any shift counts regardless of skills.

---

### `min_skill_level` — integer, nullable

The minimum proficiency level required when a skill requirement is present. The scale is 1–5:

| Level | Label |
|-------|-------|
| 1 | Beginner |
| 2 | Elementary |
| 3 | Intermediate |
| 4 | Advanced |
| 5 | Expert |

Values are stored in `enterprise_member_skills.level`. During eligibility evaluation, a member passes the skill-level check if `member_skill.level >= rule.min_skill_level`. A member who has the skill but at a lower level receives a `SKILL_LEVEL_LOW` warning (−20 score) but is not blocked.

If `min_skill_level` is null and a skill requirement exists, the default of 1 is used (any skill level satisfies the requirement).

If `min_skill_level` is null and there is no skill requirement, this field has no effect.

---

### `min_headcount` — integer, NOT NULL

The minimum number of people required. This is the "N" in the "N / H" cell display. The coverage planner counts matching shift assignments (`supplyFor()`) and compares against this value to determine the coverage status.

Constraints:
- Must be ≥ 1.
- When `business_roles[]` is non-empty, `min_headcount` is automatically set to `len(business_roles)` by the save logic. Do not manually set a value lower than the number of role entries — the assignment drawer renders `max(business_roles.length, min_headcount)` slots, and untyped padding slots are added if `min_headcount > business_roles.length`.

Example consistency rules:
- `min_headcount = 3`, `business_roles = ['BA','BA','HR']` → 3 slots: slot 0 = BA, slot 1 = BA, slot 2 = HR (consistent)
- `min_headcount = 4`, `business_roles = ['BA','BA']` → 4 slots: slot 0 = BA, slot 1 = BA, slots 2–3 = untyped (padded)
- `min_headcount = 2`, `business_roles = ['BA','BA','HR']` → 3 slots despite min_headcount = 2 (roles array length wins)

---

### `days_of_week` — integer[], nullable

An array of weekday numbers specifying which days of the week the rule applies. Uses JavaScript's `Date.getDay()` convention:

| Number | Day |
|--------|-----|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

Examples:
- `[1,2,3,4,5]` — Monday through Friday (standard business week)
- `[1,3,5]` — Monday, Wednesday, Friday
- `[0,6]` — Weekends only
- `null` — every day of the week (no day filter)

When `days_of_week` is an empty array `[]`, the behavior is the same as `null` — the rule applies every day. The frontend always sends `null` when no days are selected; `[]` is treated as `null` by the `ruleAppliesOn` function.

The day-of-week filter is applied after `rule_date` (if `rule_date` is set, `days_of_week` is ignored entirely) and after the `valid_from`/`valid_until` window check.

---

### `rule_date` — date string (yyyy-MM-dd), nullable

A single specific date override. When set, this rule applies **only** on this exact date and not on any other day. `days_of_week`, `valid_from`, and `valid_until` are all ignored when `rule_date` is present.

Use cases:
- Defining a special minimum requirement for a public holiday or event day
- One-off override ("on 2026-06-20 we need 4 BA staff instead of 2")
- Seasonal spikes

When `rule_date` is set, the `ruleAppliesOn` function returns `true` only if `format(d, 'yyyy-MM-dd') === rule.rule_date`. It returns `false` for all other dates.

---

### `valid_from` — date string (yyyy-MM-dd), nullable

The earliest date on which this rule is active. If a date being evaluated is before `valid_from`, `ruleAppliesOn` returns `false`. If `valid_from` is null, the rule is active from the beginning of time.

Example: a summer staffing requirement active from June through August would have `valid_from = '2026-06-01'` and `valid_until = '2026-08-31'`.

---

### `valid_until` — date string (yyyy-MM-dd), nullable

The last date on which this rule is active. If a date being evaluated is after `valid_until`, `ruleAppliesOn` returns `false`. If `valid_until` is null, the rule never expires ("∞" is shown in the UI).

The UI shows a warning badge (amber, "⚠") for rules where `valid_until` is within 7 days of today, so managers can plan renewals in advance:

```typescript
const isExpiringSoon = r.valid_until
  && r.valid_until >= today
  && r.valid_until <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
```

---

### `status` — enum ('active' | 'archived' | 'expired')

The lifecycle status of the rule.

| Status | Shown in grid | Editable | Deletable |
|--------|---------------|----------|-----------|
| `active` | Yes | Yes | Yes |
| `archived` | No | No (restore first) | Yes |
| `expired` | No | No | Yes |

The Capacity Planner queries only `status = 'active'` rules:
```typescript
.from('enterprise_office_coverage_rules')
.select('*')
.eq('workspace_id', workspaceId)
.eq('status', 'active')
```

The `OfficeCoverageRuleManager` shows all statuses in the Aktív/Archivált tabs. The `expired` status is a system-managed state that could be set by an automated job (not currently implemented in production — the UI only sets `active` or `archived`).

---

### `archived_at` — timestamptz, nullable

Records when the rule was archived. Set by the archive action to `new Date().toISOString()`. Cleared to `null` when a rule is restored. Currently stored for audit/history purposes; not displayed in the UI.

---

### `notes` — text, nullable

Free-text notes for managers. Examples: "Seasonal rule — review in September", "Agreed with HR on 2026-04-01". Stored but currently not surfaced in the Capacity Planner grid or drawer — only visible in the rule edit dialog.

---

### `created_by` — uuid, nullable, foreign key

The `user_id` of the workspace member who created the rule. Set to `userId` prop at insert time. Not currently displayed in the UI but available for future audit views.

---

## Backward Compatibility

The coverage rule system evolved from single-role to multi-role in a backward-compatible way. Two parallel field pairs exist:

| Old (single-value) | New (multi-value) | Relationship |
|--------------------|-------------------|-------------|
| `business_role` (text) | `business_roles` (text[]) | New array preferred; old string is a mirror of `business_roles[0]` |
| `skill_id` (uuid) | `skill_ids` (uuid[]) | New array preferred; old single is a mirror of `skill_ids[0]` |

**Reading rules** (both the Capacity Planner and the Smart Batch Dialog): Always call the canonical getter functions. Never read `business_role` or `skill_id` directly.

```typescript
// Correct
const roles = ruleRoles(rule);   // returns string[]
const skills = ruleSkillIds(rule); // returns string[]

// Never do this
const role = rule.business_role; // may miss multi-slot data
```

**Writing rules** (in `OfficeCoverageRuleManager.save()`):

```typescript
const payload = {
  // Legacy mirrors (backward compat)
  business_role: expandedRoles.length > 0 ? expandedRoles[0] : null,
  skill_id: selectedSkillIds.length > 0 ? selectedSkillIds[0] : null,
  min_skill_level: selectedSkillIds.length > 0 ? parseInt(minSkillLevel) : null,
  // Multi-value (primary)
  business_roles: expandedRoles.length > 0 ? expandedRoles : null,
  skill_ids: selectedSkillIds.length > 0 ? selectedSkillIds : null,
  min_headcount: expandedRoles.length > 0 ? expandedRoles.length : parseInt(minHeadcount),
  // ...
};
```

This ensures that any reader — including legacy integrations and the embed SDK — can read the rule correctly whether it checks the old or new fields.

---

## Slot-Based Assignment

### The slot model

When `business_roles` contains typed role entries, each element of the array defines a **slot** with a required role. The assignment drawer renders one row per slot.

Example:

| Rule | `business_roles` | `min_headcount` | Slots |
|------|-----------------|-----------------|-------|
| Rule A | `['BA','BA','HR']` | 3 | Slot 0: BA, Slot 1: BA, Slot 2: HR |
| Rule B | `['Operator']` | 1 | Slot 0: Operator |
| Rule C | `null` (no roles) | 2 | Slot 0: untyped, Slot 1: untyped |

### Padding with untyped slots

If `min_headcount` is greater than the length of `business_roles`, the remaining slots are padded as "untyped" (null role). Untyped slots accept any member regardless of role. In the drawer, untyped slots display "Bármilyen pozíció" (Any position) as their label.

```typescript
// Slot construction in CoveragePlannerView drawer
const slots: { idx: number; role: string | null; skillId: string | null }[] = [];
if (ruleRolesForSlots.length > 0) {
  ruleRolesForSlots.forEach((role, i) =>
    slots.push({ idx: i, role, skillId: ruleSkillsForSlots[0] ?? null })
  );
  // pad if min_headcount > roles count
  for (let i = ruleRolesForSlots.length; i < drawerCell.rule.min_headcount; i++) {
    slots.push({ idx: i, role: null, skillId: ruleSkillsForSlots[0] ?? null });
  }
} else {
  // No typed roles: all slots are untyped
  for (let i = 0; i < Math.max(1, drawerCell.rule.min_headcount); i++) {
    slots.push({ idx: i, role: null, skillId: ruleSkillsForSlots[i] ?? ruleSkillsForSlots[0] ?? null });
  }
}
```

### Greedy slot fill algorithm

When the drawer renders, it assigns existing confirmed assignments and draft assignments to slots using a greedy algorithm that tries to place role-matching assignments in role-typed slots first:

```typescript
// 1. Collect all assignments (confirmed shifts + drafts) in order
const assignments = [
  ...activeAssignedForDrawer.map(s => ({ kind: 'shift', shift: s, member: members.find(m => m.user_id === s.user_id) })),
  ...draftAssignments.map(d => ({ kind: 'draft', draft: d })),
];

// 2. First pass: fill role-typed slots greedily by matching role
const slotFill = new Map<number, assignment>();
const remaining = [...assignments];
slots.forEach(slot => {
  if (slot.role) {
    const matchIdx = remaining.findIndex(a => {
      const r = a.kind === 'shift' ? a.member?.business_role : a.draft.member.business_role;
      return r === slot.role;
    });
    if (matchIdx >= 0) {
      slotFill.set(slot.idx, remaining[matchIdx]);
      remaining.splice(matchIdx, 1);
    }
  }
});

// 3. Second pass: fill unmatched/untyped slots in order with remaining assignments
slots.forEach(slot => {
  if (slotFill.has(slot.idx)) return;
  if (remaining.length > 0) slotFill.set(slot.idx, remaining.shift()!);
});

// 4. Any still-remaining assignments are "overflow" (more people than slots)
const overflow = remaining;
```

This means a person with the matching role always appears in the matching-role slot even if they were assigned after an unmatched person. Overflow assignments (beyond `min_headcount`) are shown in a separate amber-tinted section.

### Role match visual feedback

In the drawer's slot rows:

- **Emerald background** (`bg-emerald-100/80`) — the assigned member's `business_role` exactly equals the slot's required role (or the slot is untyped)
- **Rose background** (`bg-rose-100/80`) — the assigned member's `business_role` does not match the slot's required role. A small note shows their actual role: "Tényleges pozíció: {role}".

This visual feedback helps managers spot coverage gaps where someone was assigned as a fallback but is not the right role for the slot.

---

## Rule Application Logic

The `ruleAppliesOn` function determines whether a coverage rule is relevant for a given date. It is called for every rule × day combination when rendering the grid.

```typescript
function ruleAppliesOn(rule: CoverageRule, date: Date): boolean {
  const iso = format(date, 'yyyy-MM-dd');

  // 1. Specific date override — if set, only match this exact date
  if (rule.rule_date) {
    return rule.rule_date === iso;
  }

  // 2. Valid-from check — rule not active before this date
  if (rule.valid_from && iso < rule.valid_from) {
    return false;
  }

  // 3. Valid-until check — rule not active after this date
  if (rule.valid_until && iso > rule.valid_until) {
    return false;
  }

  // 4. Day-of-week filter — rule applies only on specified days
  if (rule.days_of_week && rule.days_of_week.length > 0) {
    const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (!rule.days_of_week.includes(dow)) {
      return false;
    }
  }

  // 5. All checks passed — rule applies on this date
  return true;
}
```

**Priority order**: `rule_date` takes absolute precedence. If `rule_date` is set, the function returns immediately after the date-equality check without evaluating `valid_from`, `valid_until`, or `days_of_week`.

**Date comparison**: ISO date strings are compared lexicographically (`iso < rule.valid_from`). Since ISO dates sort correctly as strings (YYYY-MM-DD), this is equivalent to a numeric date comparison and avoids timezone issues.

**`days_of_week` uses `Date.getDay()`** — not ISO week days. Sunday is 0, not 7. This matches the convention used by the `OfficeCoverageRuleManager` UI. When a manager checks "Monday" in the form, `days: [1]` is stored, which matches `date.getDay() === 1`.

Note: The Smart Batch Scheduling dialog (`SmartBatchScheduleDialog`) uses an identical copy of `ruleAppliesOn` (not imported from the same module — duplicated for component encapsulation). Any changes to the rule application logic must be applied in both files:
- `src/components/enterprise/calendar/CoveragePlannerView.tsx`
- `src/components/enterprise/calendar/SmartBatchScheduleDialog.tsx`

---

## Shift Matching Logic

The `supplyFor` function counts how many existing shift assignments match a given rule on a given date. This count is the "H" (have) number in the grid cell.

```typescript
function supplyFor(rule: CoverageRule, date: Date): Shift[] {
  const iso = format(date, 'yyyy-MM-dd');
  const roles = ruleRoles(rule);     // canonical multi-value getter
  const skillIds = ruleSkillIds(rule); // canonical multi-value getter

  return shifts.filter(shift => {
    // Filter 1: Must be at the same office
    if (shift.office_id !== rule.office_id) return false;

    // Filter 2: Must be on the same date
    if (shift.shift_date !== iso) return false;

    // Filter 3: Role and/or skill match
    const roleMatch =
      roles.length === 0 ||
      (shift.business_role != null && roles.includes(shift.business_role));

    const skillMatch =
      skillIds.length === 0 ||
      (shift.skill_id != null && skillIds.includes(shift.skill_id));

    // If BOTH role and skill requirements are defined:
    //   shift must satisfy at least one (OR logic across dimensions)
    if (roles.length > 0 && skillIds.length > 0) return roleMatch || skillMatch;

    // If only role requirement: shift must role-match
    if (roles.length > 0) return roleMatch;

    // If only skill requirement: shift must skill-match
    if (skillIds.length > 0) return skillMatch;

    // No requirements: any shift at this office on this date counts
    return true;
  });
}
```

### Matching semantics summary

| Rule has roles | Rule has skills | Match condition |
|----------------|-----------------|-----------------|
| Yes | No | Shift's `business_role` must be in the rule's `business_roles[]` |
| No | Yes | Shift's `skill_id` must be in the rule's `skill_ids[]` |
| Yes | Yes | Shift's `business_role` in roles **OR** shift's `skill_id` in skills |
| No | No | Any shift at this office on this date counts |

**Important**: The shift matching is a supply-counting mechanism. It does not validate whether the assignment is "correct" — it only counts whether the shift row matches the rule's filter criteria. A shift assigned to a person with a non-matching role will not count toward supply for a role-constrained rule.

**Multi-role rules**: When `business_roles = ['BA','BA','HR']`, the roles array passed to `supplyFor` is `['BA','HR']` (via `ruleRoles()`, which returns the full array including duplicates). The `shift.business_role IN roles` check uses `roles.includes(shift.business_role)`. A BA shift matches because 'BA' is in the array. The count returned by `supplyFor` is the total number of matching shifts — not the number of slots filled. If 3 BA shifts and 1 HR shift are assigned, `supplyFor` returns 4 shifts, meaning the cell shows `3 / 4` (overstaffed by 1).

---

## Eligibility Engine Reference

The `coverageEligibility.ts` module (`src/lib/coverageEligibility.ts`) contains the pure-function eligibility evaluation engine used by:
- The assignment drawer's candidate list
- The Intelligens javaslat algorithm
- The Smart Batch Scheduling wizard
- The `useShiftCandidates` hook (for Open Shift broadcast candidate scoring)

### Score starting point and adjustments

Base score: **100**

| Condition | Code | Severity | Score change |
|-----------|------|----------|-------------|
| Public holiday | `HOLIDAY` | warning | −5 |
| Blocked date | `BLOCKED` | **blocking** | (not eligible) |
| Approved leave | `ON_LEAVE` | **blocking** | (not eligible) |
| Pending leave | `PENDING_LEAVE` | warning | −30 |
| Role matches requirement | — | — | +50 |
| Role does not match | `WRONG_ROLE` | warning | −40 |
| Required skill present, level sufficient | — | — | +30 + (level−min)×5 |
| Required skill present, level insufficient | `SKILL_LEVEL_LOW` | warning | −20 |
| Required skill absent (no role match) | `MISSING_SKILL` | **blocking** | (not eligible) |
| Required skill absent (role match exists) | `MISSING_SKILL` | warning | (no score change) |
| Double-booked at another office | `DOUBLE_BOOKED` | **blocking** | (not eligible) |
| Self-marked available | — | — | +20 |
| Projected hours exceed weekly capacity | `OVER_CAPACITY` | warning | −10 |

A member is **eligible** if they have no blocking issues. Eligible members sort before ineligible ones in all candidate lists. Within the eligible group, members sort by `matchScore` descending.

### `rankCandidates` function

```typescript
export function rankCandidates(
  members: MemberInput[],
  req: RequirementInput,
  ctx: EligibilityContext
): EligibilityResult[] {
  return members
    .map(m => evaluateEligibility(m, req, ctx))
    .sort((a, b) => {
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      return b.matchScore - a.matchScore;
    });
}
```

The result is an array of `EligibilityResult` objects containing the member, their eligibility flag, match score, and a list of issues. The assignment drawer renders all results (eligible first, then ineligible) so managers can make informed override decisions.

---

## Database Table Summary

```sql
TABLE enterprise_office_coverage_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES enterprise_workspaces(id),
  office_id         uuid NOT NULL REFERENCES enterprise_offices(id),
  name              text,                          -- optional human label
  business_role     text,                          -- LEGACY: single role
  skill_id          uuid REFERENCES enterprise_skills(id),  -- LEGACY: single skill
  min_skill_level   integer,                       -- 1-5, null = any
  business_roles    text[],                        -- NEW: expanded role array
  skill_ids         uuid[],                        -- NEW: multi-skill array
  min_headcount     integer NOT NULL DEFAULT 1,    -- demand count
  days_of_week      integer[],                     -- null = every day
  rule_date         date,                          -- single-date override
  valid_from        date,                          -- activation start
  valid_until       date,                          -- activation end
  notes             text,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','archived','expired')),
  archived_at       timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON enterprise_office_coverage_rules (workspace_id, status);
CREATE INDEX ON enterprise_office_coverage_rules (office_id);
```

RLS policy: workspace members with appropriate role can SELECT all active rules for their workspace. Only admins/managers can INSERT, UPDATE, or DELETE.

---

## Common Patterns and Examples

### Pattern 1: Standard Mon–Fri business hours minimum

```json
{
  "name": "Weekday minimum",
  "office_id": "<uuid>",
  "business_roles": ["BA", "HR"],
  "min_headcount": 2,
  "days_of_week": [1, 2, 3, 4, 5],
  "valid_from": null,
  "valid_until": null,
  "status": "active"
}
```

This requires 1 BA and 1 HR every Monday through Friday, indefinitely.

### Pattern 2: Multi-slot with skill requirement

```json
{
  "name": "Tech support coverage",
  "office_id": "<uuid>",
  "business_roles": ["Senior Dev", "Senior Dev", "Junior Dev"],
  "skill_ids": ["<sql-skill-uuid>"],
  "min_skill_level": 3,
  "min_headcount": 3,
  "days_of_week": [1, 2, 3, 4, 5],
  "status": "active"
}
```

This creates 3 slots: 2 Senior Dev + 1 Junior Dev. All must have the SQL skill at level ≥ 3. A shift assignment counts toward supply if the person's role is "Senior Dev" or "Junior Dev" **OR** if their `skill_id` is the SQL skill UUID.

### Pattern 3: Single-date special requirement

```json
{
  "name": "Year-end inventory",
  "office_id": "<uuid>",
  "business_roles": ["Warehouse", "Warehouse", "Warehouse", "Warehouse"],
  "min_headcount": 4,
  "rule_date": "2026-12-31",
  "days_of_week": null,
  "status": "active"
}
```

This rule applies only on December 31, 2026, and requires 4 Warehouse staff that day. All other days the rule shows as not-applicable (gray).

### Pattern 4: Seasonal rule with expiry warning

```json
{
  "name": "Summer peak staffing",
  "office_id": "<uuid>",
  "business_roles": ["BA", "BA", "BA"],
  "min_headcount": 3,
  "days_of_week": [1, 2, 3, 4, 5],
  "valid_from": "2026-06-01",
  "valid_until": "2026-08-31",
  "status": "active"
}
```

From June 1 to August 31, 2026, this rule requires 3 BA staff on weekdays. On September 1 the rule automatically becomes not-applicable without needing to be archived. From August 25 onward, the expiring-soon "⚠" badge appears in the rule list to remind the manager to decide on renewal.

### Pattern 5: Legacy single-role rule (read-only example)

A rule created by an old version of the app may look like:

```json
{
  "business_role": "Operator",
  "business_roles": null,
  "skill_id": null,
  "skill_ids": null,
  "min_headcount": 2,
  "days_of_week": [1, 2, 3, 4, 5]
}
```

The canonical getter `ruleRoles()` returns `["Operator"]` because `business_roles` is null and `business_role` is non-null. The Capacity Planner renders this as 2 untyped slots (since `business_roles` is null and the system falls into the "no typed roles" branch), but the supply counter correctly checks for shifts with `business_role = "Operator"`. If you edit and re-save this rule through the current UI, it will be upgraded to `business_roles = ["Operator","Operator"]` with `min_headcount = 2`.
