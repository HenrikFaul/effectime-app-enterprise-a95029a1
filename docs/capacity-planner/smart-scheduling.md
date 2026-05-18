# Effectime Smart Scheduling — Complete Reference

**Engine:** `coverageEligibility.ts`  
**Consumers:** CoveragePlannerView, OpenShiftManager, SmartBatchScheduleDialog  
**Base path:** `docs/capacity-planner/smart-scheduling.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Eligibility Engine Architecture](#eligibility-engine-architecture)
3. [Input Types](#input-types)
4. [Eligibility Scoring Algorithm](#eligibility-scoring-algorithm)
5. [Output Types](#output-types)
6. ["Suggest Optimal" Algorithm (CoveragePlannerView)](#suggest-optimal-algorithm-coverageplannerviewtsx)
7. [Smart Batch Scheduling (SmartBatchScheduleDialog)](#smart-batch-scheduling-smartbatchscheduledialog)
8. [Office Priority System (enterprise_member_site_priorities)](#office-priority-system-enterprise_member_site_priorities)
9. [Open Shift Smart Suggestion (OpenShiftManager)](#open-shift-smart-suggestion-openshiftmanager)
10. [Testing & Purity Guarantees](#testing--purity-guarantees)

---

## Overview

Effectime's smart scheduling functionality is powered by a single shared engine: `coverageEligibility.ts`. This file implements a deterministic, pure-function eligibility and ranking system that drives all three scheduling intelligence features:

| Feature | UI component | Engine call |
|---------|-------------|-------------|
| "Suggest Optimal" button | `CoveragePlannerView.tsx` | `rankCandidates()` + `suggestOptimal()` |
| Smart suggestion (wand icon) | `OpenShiftManager.tsx` | `rankCandidates()` via `useShiftCandidates` hook |
| Batch schedule generation | `SmartBatchScheduleDialog.tsx` | `rankCandidates()` iterated per (rule, date) slot |

**Design principles:**

- **Pure function** — `coverageEligibility.ts` has no side effects. It imports no Supabase client, fires no events, and maintains no state. It takes data in, returns results out.
- **Fully testable** — Because it is pure, the entire eligibility and ranking logic can be unit-tested without mocking any database or network calls.
- **Single source of truth** — There is exactly one implementation of "who is eligible for this slot". All scheduling features use it; there are no parallel scoring implementations.
- **Additive scoring** — The scoring model is designed so that additional criteria (new skill types, new leave types, new priority signals) can be added without breaking existing behavior.

---

## Eligibility Engine Architecture

```
coverageEligibility.ts
├── evaluateEligibility(member, requirement, context) → EligibilityResult
│   ├── isOnLeave()
│   ├── isDoubleBooked()
│   ├── isOverCapacity()
│   ├── hasRequiredRole()
│   ├── hasRequiredSkill()
│   └── isAvailable()          ← checks staff_availability table data
│
├── rankCandidates(members[], requirement, context) → EligibilityResult[]
│   ├── evaluateEligibility() for each member
│   ├── Filter: isEligible = true
│   └── Sort by matchScore DESC
│
└── [Internal helpers]
    ├── computeCapacityHoursUsed()
    ├── overlapsDateRange()
    └── normalizeRole()
```

`rankCandidates()` is the primary public API. It returns a sorted list of eligible candidates from highest to lowest `matchScore`. Consumers then apply their own secondary sort criteria on top (e.g., site priority, shift count for load balancing).

---

## Input Types

### MemberInput

```typescript
interface MemberInput {
  membership_id: string;
  user_id: string;
  display_name: string;
  business_role: string | null;           // The member's primary role in the workspace
  weekly_capacity_hours: number;          // Max hours per week; default 40
  base_working_hours: number;             // Hours per standard shift; default 8
  skills: {
    skill_id: string;
    level: number;                        // Skill level, e.g. 1–5
  }[];
}
```

**Notes:**
- `business_role` is the member's single primary role (e.g., `"cashier"`, `"manager"`). Coverage rules may require multiple roles (`business_roles[]`); a match is found if the member's role appears in that array.
- `weekly_capacity_hours` is used for over-capacity detection. The engine sums the member's assigned shifts in the current week (each = `base_working_hours` hours) and compares to this threshold.
- `skills` is populated from `enterprise_member_skills` joined with `enterprise_skills`. The `level` field is workspace-defined.

### RequirementInput

```typescript
interface RequirementInput {
  business_roles?: string[] | null;   // Multi-role requirement (v3.40.0+)
  skill_ids?: string[] | null;        // Required skill IDs
  min_skill_level?: number | null;    // Minimum acceptable skill level (inclusive)
  shift_date: string;                 // Target date, format: "yyyy-MM-dd"
  office_id: string;                  // Target office UUID
}
```

**Notes:**
- `business_roles` is the canonical multi-value field as of v3.40.0. The engine falls back to checking a legacy `business_role: string` field if `business_roles` is absent or empty (handled by `ruleRoles()` getter in `CoveragePlannerView`).
- If both `business_roles` and `skill_ids` are null/empty, the slot is role/skill-agnostic — any active member is considered role-eligible.
- `min_skill_level` is inclusive: a member with `level >= min_skill_level` is skill-eligible.

### EligibilityContext

```typescript
interface EligibilityContext {
  holidaysISO: Set<string>;         // Set of "yyyy-MM-dd" ISO date strings
  blockedDatesISO: Set<string>;     // Set of "yyyy-MM-dd" ISO date strings
  leaves: {
    user_id: string;
    start_date: string;             // "yyyy-MM-dd"
    end_date: string;               // "yyyy-MM-dd" (inclusive)
    status: string;                 // "approved" | "pending" | ...
  }[];
  shifts: {
    id: string;
    user_id: string;
    office_id: string;
    shift_date: string;             // "yyyy-MM-dd"
  }[];
  availabilityByDate?: Map<string, Set<string>>;
  // Key: "yyyy-MM-dd", Value: Set<user_id> of members who marked themselves available
}
```

**Notes:**
- `holidaysISO` and `blockedDatesISO` are pre-computed sets for O(1) lookup. The `CoveragePlannerView` builds them once from `enterprise_holidays` and `enterprise_blocked_dates` before running any eligibility checks.
- `leaves` includes all leave requests overlapping the displayed date range, regardless of status. The engine distinguishes `approved` (blocking) vs. `pending` (warning) internally.
- `shifts` contains all shift assignments in the date range, used for double-booking detection and capacity calculation.
- `availabilityByDate` is optional. When present (loaded from `enterprise_staff_availability`), members who proactively marked a date as available receive a +20 score bonus.

---

## Eligibility Scoring Algorithm

### Base Score

Every member starts with a base score of **100**.

```
initial matchScore = 100
```

### Blocking Issues (isEligible = false)

If any blocking issue is detected, `isEligible` is set to `false` and the member is excluded from the candidate list returned by `rankCandidates()`. Blocking checks are evaluated in order:

| Issue code | Condition | Effect |
|------------|-----------|--------|
| `ON_LEAVE` | Member has an **approved** leave request overlapping `shift_date` | `isEligible = false` |
| `DOUBLE_BOOKED` | Member already has a shift on `shift_date` at a **different** `office_id` | `isEligible = false` |
| `MISSING_SKILL` | `business_roles` is set AND member's role does NOT match ANY required role, AND (`skill_ids` is set AND member has NONE of the required skills) | `isEligible = false` |

**Double-booking clarification:** A member assigned to the same office on the same date is NOT double-booked — that means they are already assigned to this slot. The blocking condition is: same date, different office. Assigning the same member to two offices on the same day is considered a scheduling conflict.

**MISSING_SKILL blocking logic:** The blocking form of MISSING_SKILL requires both role mismatch AND skill absence. If the rule has no role requirement but has a skill requirement, a member with zero matching skills is blocked. If the rule has a role requirement and the member matches the role, missing skills are a warning (not blocking) — see score deductions below.

### Warning Issues (Score Deductions)

Warning issues reduce `matchScore` but do not set `isEligible = false`. Multiple warnings stack (scores are additive):

| Issue code | Condition | Score deduction |
|------------|-----------|----------------|
| `PENDING_LEAVE` | Member has a **pending** leave request overlapping `shift_date` | −30 |
| `WRONG_ROLE` | Rule has `business_roles` set AND member's role does NOT match any required role | −40 |
| `MISSING_SKILL` | Rule has `skill_ids` set AND member has none of the required skills AND member DOES match the role (warning-only form) | 0 (issue recorded, no score deduction; presence in list is itself a warning signal) |
| `SKILL_LEVEL_LOW` | Member has a matching skill but `member.level < min_skill_level` | −20 |
| `OVER_CAPACITY` | `(existing shifts in week × base_working_hours) > weekly_capacity_hours` | −10 |
| `HOLIDAY` | `shift_date` is in `holidaysISO` or `blockedDatesISO` | −5 |

**Score floor:** `matchScore` is never set below 0 by deductions. The minimum score for an eligible member is 0.

### Bonuses

Bonuses are added after all deductions:

| Bonus | Condition | Score addition |
|-------|-----------|----------------|
| Role match | Member's `business_role` appears in requirement's `business_roles[]` | +50 |
| Skill match | Member has at least one skill from requirement's `skill_ids[]` at any level | +30 |
| Skill level above minimum | For each matching skill: `member_level − min_skill_level` extra points (min 0) | +(member_level − min_skill_level) × 5 |
| Self-marked available | Member's `user_id` is in `availabilityByDate.get(shift_date)` | +20 |

**Skill level bonus example:** If `min_skill_level = 2` and member has a matching skill at `level = 4`, the bonus is `(4 − 2) × 5 = +10` on top of the base +30 skill match bonus, for a total of +40 from the skill dimension.

### Complete Score Formula

```
matchScore =
  100                              (base)
  − 30  (if PENDING_LEAVE)
  − 40  (if WRONG_ROLE)
  − 20  (if SKILL_LEVEL_LOW)
  − 10  (if OVER_CAPACITY)
  − 5   (if HOLIDAY or BLOCKED_DATE)
  + 50  (if role match)
  + 30  (if any skill match)
  + (member_level − min_skill_level) × 5  (per matching skill, clamped ≥ 0)
  + 20  (if self-marked available)
```

**Theoretical maximum:** 100 + 50 + 30 + (5 × N skill bonus) + 20 = 200+ for a perfectly matched, available, highly skilled member with no warnings.

**Practical typical range:**
- Perfect role + skill match, no warnings: ~200
- Role match, no skills required: ~170
- Role match, over capacity: ~160
- Wrong role but high skill: ~110
- On holiday: ~95 (or lower with other deductions)

---

## Output Types

### EligibilityResult

```typescript
interface EligibilityResult {
  member: MemberInput;
  isEligible: boolean;
  matchScore: number;
  issues: {
    severity: 'blocking' | 'warning' | 'info';
    code: string;       // e.g. 'ON_LEAVE', 'WRONG_ROLE', 'OVER_CAPACITY'
    message: string;    // Human-readable description (not i18n translated — for dev/debug use)
  }[];
}
```

`rankCandidates()` returns `EligibilityResult[]` sorted by `matchScore` descending. Only members with `isEligible = true` are included.

`evaluateEligibility()` returns a single `EligibilityResult` for any member (including ineligible ones, with `isEligible = false` and blocking issues listed). This is used for displaying detailed eligibility explanations in the drawer.

---

## "Suggest Optimal" Algorithm (CoveragePlannerView)

The "Suggest Optimal" button (`Wand2` icon) in the Coverage Planner's assignment drawer auto-fills the remaining unfilled slots in the selected (office, rule, date) cell.

### Trigger

User clicks the "Suggest Optimal" button in the assignment drawer. This calls `suggestOptimal()` in `CoveragePlannerView.tsx`.

### Inputs to suggestOptimal()

```typescript
{
  drawerCell: {
    office_id: string;
    rule: CoverageRule;
    date: string;                    // yyyy-MM-dd
  };
  availableCandidates: EligibilityResult[];  // Output of rankCandidates()
  memberSitePriorityMap: Map<string, Map<string, number>>;
  // Key: membership_id → Map<office_id → priority number>
  monthlyShiftCountByUser: Map<string, number>;
  // Key: user_id → count of shifts assigned this month
  alreadyAssignedUserIds: Set<string>;
  // Users already in the drawerCell's assigned list
  slotsNeeded: number;               // rule.min_headcount - currentlyAssigned
}
```

### Algorithm (Greedy Iterative)

```
For each unfilled slot (index 0 to slotsNeeded − 1):

  1. FILTER:
     - candidates with isEligible = true
     - candidates NOT in alreadyAssignedUserIds
     - candidates NOT already picked in this suggestOptimal() call (tracks picked set)

  2. SORT (stable multi-key):
     Key 1: Role match priority
       - 0 if member.business_role === slot.role (exact role match for this rule's primary role)
       - 1 otherwise
     Key 2: Office priority (enterprise_member_site_priorities)
       - memberSitePriorityMap.get(membership_id)?.get(office_id) ?? Infinity
       - Lower number = higher priority (Infinity = no priority entry = lowest preference)
     Key 3: Monthly shift count (load balancing)
       - monthlyShiftCountByUser.get(user_id) ?? 0
       - Lower count = higher preference (distribute work evenly)
     Key 4: matchScore (descending)
       - Higher score = higher preference (tie-break on eligibility quality)

  3. PICK: Take first element from sorted list (index 0)

  4. MARK: Add picked member's user_id to "used this call" Set

  5. EMIT: Add to draftAssignments list

  6. If no eligible unassigned candidate found: slot remains unfilled, continue
```

### Draft Assignments

The result is a list of `draftAssignments` — temporary records not yet persisted to the database. The assignment drawer displays them with:
- **✓ Confirm** button: calls `supabase.from('enterprise_shift_assignments').insert(draftAssignments)` to persist all
- **✗ Discard** button: clears draft state, no database write

This draft/confirm flow ensures managers review suggestions before they become real assignments.

### Why Greedy (Not Optimal)?

For typical workplace scheduling (5–25 candidates, 2–5 slots), a greedy approach produces excellent results in sub-millisecond time. Global optimum (e.g., via Hungarian algorithm) would produce marginally better results in edge cases but at significant complexity cost. The greedy approach with the multi-key sort order reliably produces near-optimal assignments for real-world headcount numbers.

---

## Smart Batch Scheduling (SmartBatchScheduleDialog)

`SmartBatchScheduleDialog.tsx` provides bulk schedule generation for an office across a date range. It uses the same `rankCandidates()` engine iterated across every (rule, date) combination.

### Opening the Dialog

Accessible via the **Wand2** icon button in the office header row of the Coverage Planner. Opens as a portal (rendered outside the normal React tree to avoid z-index conflicts).

### Inputs

The dialog collects:

| Field | Description |
|-------|-------------|
| Office | Pre-populated from the office header that was clicked |
| Coverage rules | Multi-select from rules defined for the office |
| Date range | Start date + end date (calendar pickers) |
| Strategy | Strategy dropdown (see below) |

### Scheduling Strategies

| Strategy ID | Name | Sort order logic |
|-------------|------|-----------------|
| `role_match_first` | Role Match First | Primary: role match (0 or 1) → Secondary: matchScore descending → Tertiary: shift count ascending |
| `load_balanced` | Load Balanced | Primary: shift count ascending → Secondary: matchScore descending → Tertiary: role match |
| `priority_first` | Priority First | Primary: office priority ascending (enterprise_member_site_priorities) → Secondary: role match → Tertiary: matchScore |

### Generation Algorithm

```
For each date in [start_date .. end_date]:
  For each selected coverage rule:
    If rule applies on this date (days_of_week match, valid_from/valid_until respected):
      slots_needed = rule.min_headcount - alreadyAssigned(rule, date)
      candidates = rankCandidates(members, {
        business_roles: ruleRoles(rule),
        skill_ids: ruleSkillIds(rule),
        min_skill_level: rule.min_skill_level,
        shift_date: date,
        office_id: rule.office_id
      }, context)

      For each unfilled slot:
        Apply strategy sort on top of rankCandidates() output
        Pick top candidate (excluding already-picked this generation)
        Add to generatedAssignments

generatedAssignments = all picks across all (date, rule, slot) combinations
```

**Context building:** Before the generation loop, the dialog builds a single `EligibilityContext` that includes all existing shifts and leaves for the entire date range. As assignments are generated within the loop, the in-memory `shifts` list is updated so that double-booking detection within the batch is accurate (a member picked for day 1 appears as "already has shift" for day 2).

### Preview Table

After generation, the dialog shows a table with columns:

| Date | Rule | Member | Quality |
|------|------|--------|---------|
| 2026-06-02 | Morning Shift | Kovács Anna | Role match ✓ |
| 2026-06-02 | Morning Shift | Nagy Péter | Role match ✓ |
| 2026-06-03 | Morning Shift | (unfilled) | — No eligible candidate |

**Quality indicators:**
- **Role match ✓** — member's role exactly matches the rule's required role
- **Role match (any)** — member matches one of multiple required roles
- **Skill only** — role doesn't match but has required skills
- **No restrictions** — rule has no role/skill requirement; any member was eligible
- **⚠ Low score** — eligible but score < 50 (possible warnings)
- **(unfilled)** — no eligible candidate found for this slot

### Confirmation

Clicking **Confirm & Schedule**:
```typescript
await supabase
  .from('enterprise_shift_assignments')
  .insert(generatedAssignments.map(a => ({
    workspace_id: workspaceId,
    membership_id: a.membership_id,
    user_id: a.user_id,
    office_id: officeId,
    shift_date: a.date,
    business_role: a.business_role,
    created_by: currentUser.id,
  })))
```

If any insert fails (e.g., unique constraint violation from a concurrent assignment), the failed rows are reported in a post-confirmation error list. Successfully inserted rows are not rolled back.

### Cancellation

Clicking **Cancel** or closing the dialog discards all generated assignments without any database writes.

---

## Office Priority System (enterprise_member_site_priorities)

The office priority system is an optional enterprise feature that allows administrators to express member-to-office affinity preferences. When configured, it directly influences candidate ranking in all three scheduling features.

### Table Structure

```sql
TABLE enterprise_member_site_priorities (
  membership_id  uuid   FK enterprise_memberships,
  office_id      uuid   FK enterprise_offices,
  priority       integer,   -- Lower = higher priority (1 = first choice, 2 = second, etc.)
  PRIMARY KEY (membership_id, office_id)
)
```

### Behavior Without Priority Table

If `enterprise_member_site_priorities` has no rows for a given office:
- **Fallback:** The system treats all members equally from a priority standpoint
- **Effective behavior:** Office priority sort key = `Infinity` for all members → all members collapse to the same priority bucket → sort falls through to shift count and matchScore

### Behavior With Priority Table

If a workspace has populated priority entries:
- **Strict filtering (optional):** The `Suggest Optimal` algorithm can be configured to show only members with a priority entry for the target office. Members without an entry are excluded.
- **Soft priority (default):** Members with priority entries are ranked above those without (their `Infinity` fallback means they rank last)
- **Tie-breaking:** Within the same priority number, shift count and matchScore break ties

### Example Priority Configuration

```
Member: Kovács Anna
  - Budapest HQ → priority 1
  - Debrecen Branch → priority 2

Member: Nagy Péter
  - Budapest HQ → priority 1
  - (no Debrecen entry)

Member: Szabó László
  - (no entries)
```

Filling a slot in Budapest HQ:
1. Kovács Anna (priority 1, tied with Nagy Péter → further sort by shift count)
2. Nagy Péter (priority 1, tied with Kovács Anna)
3. Szabó László (priority Infinity → last)

Filling a slot in Debrecen Branch:
1. Kovács Anna (priority 2)
2. Szabó László (priority Infinity, no Debrecen entry)
3. Nagy Péter (priority Infinity, no Debrecen entry)

### Configuring Office Priorities

Office priorities are managed via the Workspace Settings → Members → Priority tab (if enabled for the workspace tier). Administrators can:
- Set priority 1–N for each member-office combination
- Remove a priority entry (removes from table; member falls back to Infinity)
- Bulk-import priorities via CSV

---

## Open Shift Smart Suggestion (OpenShiftManager)

The `OpenShiftManager` component uses the `coverageEligibility.ts` engine via the `useShiftCandidates` custom hook to provide instant smart candidate suggestions when creating an open shift broadcast.

### Entry Point

The **✨ wand icon** (`Wand2` Lucide icon) button appears in the compact OpenShiftManager form. It is available in both:
- The assignment drawer (coverage rule cell)
- The open-shift-only drawer (no-rule cell)

### useShiftCandidates Hook

```typescript
const { rankedCandidates, isLoading } = useShiftCandidates({
  officeId: string;
  shiftDate: string;
  businessRoles?: string[];
  skillIds?: string[];
  minSkillLevel?: number;
});
```

The hook:
1. Reads existing context data (leaves, shifts, availability) from the parent component's state (already loaded — no additional database queries)
2. Calls `rankCandidates()` synchronously (pure function — no async work)
3. Returns sorted `EligibilityResult[]`

Because the hook's inputs are derived from already-loaded data, candidate ranking is **instantaneous** — there is no loading spinner for the ranking computation itself.

### Auto-Selection Behavior

When the ✨ button is clicked:
1. `rankCandidates()` is called with the current form's role/skill settings
2. The **top-ranked candidate** (highest `matchScore`) has their checkbox **pre-checked**
3. The candidate list scrolls to show the pre-selected candidate

The manager can:
- Accept the suggestion (leave the top candidate checked)
- Override: uncheck the top candidate, check a different one
- Multi-select: check multiple candidates for targeted multi-person notification

### Display in OpenShiftManager

The candidate list shows top 3 ranked candidates (configurable). Each row shows:
- Member name + role badge
- Score bar or percentage indicator
- Issue chips (e.g., `⚠ Pending leave`, `⚠ Over capacity`)
- Checkbox for selection

Only eligible candidates (`isEligible = true`) appear in the list. Ineligible candidates are excluded from the notification candidate list entirely — a manager cannot notify an on-leave member via this UI.

### Relationship to Post-Broadcast Notification

After the manager clicks "Notify selected N" or "Broadcast to all matching":
- `create_open_shift_request()` RPC is called with `target_user_ids` (for targeted) or empty array (for broadcast)
- The RPC performs its own server-side eligibility check using the same logic
- The smart suggestion is a UX convenience — it does not bypass server-side validation

---

## Testing & Purity Guarantees

### Unit Test Approach

Because `coverageEligibility.ts` is a pure function module:

```typescript
// Example unit test structure (Jest)
describe('rankCandidates', () => {
  it('should exclude members on approved leave', () => {
    const members = [memberOnLeave, memberAvailable];
    const req = { shift_date: '2026-06-10', office_id: 'office-1' };
    const ctx = {
      holidaysISO: new Set(),
      blockedDatesISO: new Set(),
      leaves: [{ user_id: memberOnLeave.user_id, start_date: '2026-06-10', end_date: '2026-06-10', status: 'approved' }],
      shifts: [],
    };
    const results = rankCandidates(members, req, ctx);
    expect(results).toHaveLength(1);
    expect(results[0].member.user_id).toBe(memberAvailable.user_id);
  });

  it('should rank role-matching members above non-matching', () => {
    const req = { business_roles: ['cashier'], shift_date: '2026-06-10', office_id: 'office-1' };
    const results = rankCandidates([managerMember, cashierMember], req, emptyCtx);
    expect(results[0].member.business_role).toBe('cashier');
  });
});
```

No mocking of Supabase, network, or React is required. Tests run in Node environment with zero setup beyond importing the module.

### Regression Safety

The scoring constants (base score, deduction amounts, bonus amounts) are documented in this file and in inline comments in `coverageEligibility.ts`. Any change to scoring constants must:
1. Update this documentation
2. Update the inline comments
3. Pass all existing unit tests (which encode expected score values)
4. Include a CHANGELOG entry noting the scoring change and its rationale

### Known Edge Cases

| Scenario | Behavior |
|----------|----------|
| Member is on approved leave AND has pending leave on the same day | `ON_LEAVE` blocking applies; `PENDING_LEAVE` warning is not additionally recorded |
| Rule has no `business_roles` and no `skill_ids` | All members are role-eligible; score = 100 + available bonus only |
| Member has skill but at level 0 and `min_skill_level = 1` | `SKILL_LEVEL_LOW` warning (−20); `matchScore` reduced |
| Same member assigned twice to same office on same day | Not double-booked; the second assignment just adds hours to capacity check |
| `weekly_capacity_hours = 0` | Member is immediately `OVER_CAPACITY` for any shift; receives −10 but is not blocked |
| `availabilityByDate` is undefined | Availability bonus (+20) is never applied; no error |
