# Effectime Capacity Planner — Technical Architecture Reference

**Audience:** Application developers, backend engineers, database architects  
**Versions covered:** v3.40.0 – v3.46.0  
**Base path:** `docs/capacity-planner/technical-architecture.md`

---

## Table of Contents

1. [Component Tree](#component-tree)
2. [Data Loading Strategy (CoveragePlannerView)](#data-loading-strategy-coverageplannerviewtsx)
3. [State Architecture](#state-architecture)
4. [Key Utility Functions](#key-utility-functions)
5. [Database Schema](#database-schema)
6. [API Functions (Supabase RPCs)](#api-functions-supabase-rpcs)
7. [i18n Architecture](#i18n-architecture)
8. [Rendering Architecture](#rendering-architecture)
9. [Performance Considerations](#performance-considerations)
10. [Error Handling Patterns](#error-handling-patterns)

---

## Component Tree

The following annotated tree shows the complete component hierarchy for the Capacity Planner and related Embed features. Indentation represents parent–child containment in the React tree.

```
WorkspaceDashboard (WorkspaceDashboard.tsx)
└── CalendarView (tab-based navigation via useSearchParams)
    └── CoveragePlannerView (CoveragePlannerView.tsx) — "Kapacitástervező" tab
        │
        ├── [Collapsible header]
        │   └── OfficeCoverageRuleManager (OfficeCoverageRuleManager.tsx)
        │       ├── Rule list (reads enterprise_office_coverage_rules)
        │       ├── Create/Edit rule form (multi-role, multi-skill, days_of_week)
        │       ├── Archive rule confirmation dialog
        │       └── Rule status badge (active / archived / expired)
        │
        ├── [Toolbar row]
        │   ├── ViewModeToggle: weekly | monthly buttons
        │   ├── DateNavigator: ← Prev / Today / Next → buttons
        │   └── DateRangeDisplay: "2026-05-18 – 2026-05-24" (weekly) or "May 2026" (monthly)
        │
        ├── [Legend row]
        │   └── LegendChip[] — color swatch + label for each coverage status
        │       ├── Rose chip: "Understaffed"
        │       ├── Amber chip: "Partially staffed" (or "Broadcast posted")
        │       └── Emerald chip: "Fully staffed"
        │
        ├── [Coverage matrix grid] — CSS grid, inline-style columns
        │   ├── [Header row]
        │   │   ├── [Corner cell] — blank
        │   │   └── DayHeaderCell[] — day name + date, holiday marker
        │   │
        │   └── [Office section] — one per office in offices[]
        │       ├── [Office header row]
        │       │   ├── OfficeName cell — office name
        │       │   └── SmartBatchTriggerCell[] — one per day column
        │       │       └── Wand2 icon button → opens SmartBatchScheduleDialog
        │       │
        │       └── [Rule rows] — one per rule in rulesByOffice[office_id]
        │           ├── [Rule label cell] — rule name + min_headcount
        │           └── CoverageCell[] — one per day in date range
        │               ├── CoverageRuleCell (when rule applies on this day)
        │               │   ├── Count display: "{assigned}/{needed}"
        │               │   ├── Color class: rose | amber | emerald
        │               │   ├── "Meghirdett" label (when open shift posted)
        │               │   └── onClick → setDrawerCell({ office_id, rule, date })
        │               └── NoRuleCell (when rule does not apply OR no rules for office)
        │                   ├── Assigned member names (freeform)
        │                   └── onClick → setOpenShiftCell({ office_id, date })
        │
        ├── Sheet [Assignment Drawer] — visible when drawerCell ≠ null
        │   ├── SheetHeader
        │   │   ├── Office name + rule name
        │   │   ├── Date display
        │   │   └── OpenShiftManager (compact mode)
        │   │       ├── "Post open shift" button → create_open_shift_request RPC
        │   │       ├── Smart candidate list (top 3 from rankCandidates)
        │   │       └── Wand2 (✨) button → auto-check top candidate
        │   │
        │   ├── SheetContent
        │   │   ├── [Slot rows] — one per min_headcount slot
        │   │   │   ├── SlotDropZone (unfilled slot)
        │   │   │   │   └── [Drag-and-drop target for assignment]
        │   │   │   └── FilledSlot (assigned member)
        │   │   │       ├── Member name + role badge
        │   │   │       └── × button → cancel_shift_assignment RPC
        │   │   │
        │   │   ├── [Overflow section] — assignments beyond min_headcount
        │   │   │   └── OverflowAssignment[] — same as FilledSlot
        │   │   │
        │   │   ├── "Suggest Optimal" button → suggestOptimal()
        │   │   │   └── [Draft assignments list] — if draftAssignments.length > 0
        │   │   │       ├── DraftAssignmentRow[] — member name + ✓/✗ buttons
        │   │   │       ├── "Confirm all" button → batch INSERT
        │   │   │       └── "Discard all" button → clear draftAssignments
        │   │   │
        │   │   └── [Available candidates list]
        │   │       └── CandidateRow[] — from rankCandidates()
        │   │           ├── Member name + role badge
        │   │           ├── Score indicator
        │   │           ├── Issue chips (⚠ badges)
        │   │           └── "Assign" button → insert shift_assignment
        │   │
        │   └── SheetFooter — close button
        │
        ├── Sheet [Open Shift Only Drawer] — visible when openShiftCell ≠ null
        │   ├── SheetHeader
        │   │   ├── Office name + date
        │   │   └── [No coverage rule — freeform context]
        │   │
        │   ├── SheetContent
        │   │   ├── [Assigned members list] — current freeform assignments
        │   │   │   └── AssignedMemberRow[] with × remove button
        │   │   └── OpenShiftManager (full mode)
        │   │       ├── PositionPickerDialog trigger
        │   │       ├── Skill multi-select
        │   │       ├── Timeout hours input
        │   │       ├── Candidate list (with checkboxes)
        │   │       └── "Notify selected" / "Broadcast" action buttons
        │   │
        │   └── SheetFooter — close button
        │
        └── SmartBatchScheduleDialog (Portal — rendered outside sheet z-index stack)
            ├── Office display (from clicked header)
            ├── Rule multi-select
            ├── Date range pickers (from / to)
            ├── Strategy dropdown (role_match_first | load_balanced | priority_first)
            ├── [Preview table] — generated assignment preview
            │   └── PreviewRow[] — date | rule | member | quality indicator
            ├── [Error list] — slots with no eligible candidate
            ├── "Generate" button → runs batch generation algorithm
            ├── "Confirm & Schedule" button → batch INSERT to enterprise_shift_assignments
            └── "Cancel" button → discard, close dialog

─────────────────────────────────────────────────────────────────

DeveloperPortal (DeveloperPortal.tsx) — accessible via Admin → Developer Portal
└── [Tab: Embed]
    └── EmbedManager (EmbedManager.tsx)
        │
        ├── [Token list table]
        │   └── EmbedTokenRow[] — one per enterprise_embed_tokens row
        │       ├── Label cell
        │       ├── Views cell (allowed_views[])
        │       ├── Mode badge: amber "Write" | grey "Read-only"
        │       ├── Status indicator (active / revoked)
        │       ├── Last used timestamp
        │       ├── Expires timestamp
        │       ├── ⚙ Snippet Builder button → opens SnippetBuilderDialog
        │       └── ❌ Revoke button → opens RevokeConfirmDialog
        │
        ├── "New Token" button
        │   └── CreateTokenDialog
        │       ├── Label input
        │       ├── Allowed views checkboxes (capacity_planner, shift_roster)
        │       ├── Write-enabled checkbox (can_write)
        │       ├── Expiry date picker (optional)
        │       └── Create button → create_embed_token RPC
        │
        ├── NewTokenRevealDialog — shown once after creation
        │   ├── Token UUID display (for URL)
        │   ├── Hex token display (secret — copy NOW warning)
        │   └── "I've copied the token" close button
        │
        ├── SnippetBuilderDialog
        │   ├── [Left panel — config]
        │   │   ├── View selector dropdown
        │   │   ├── Office filter dropdown (workspace offices)
        │   │   ├── Mode selector (weekly/monthly — capacity_planner only)
        │   │   └── Height slider/input (200–900px)
        │   └── [Right panel — live preview]
        │       ├── <iframe> HTML snippet (live-updated)
        │       └── Copy button
        │
        └── RevokeConfirmAlertDialog
            ├── Warning message
            ├── "Revoke" confirm button → revoke_embed_token RPC
            └── "Cancel" button

─────────────────────────────────────────────────────────────────

EmbedPage (EmbedPage.tsx) — public route: /#/embed/:view
├── [Token validation + data loading via get_embed_view_data RPC]
├── [Error states: Invalid token | Expired token | View not allowed]
│
├── EmbedCapacityView (EmbedCapacityView.tsx) — when :view = 'capacity_planner'
│   ├── [Embed header]
│   │   ├── Effectime wordmark (small)
│   │   ├── Week/Month navigation (← Prev / Next →)
│   │   ├── Mode toggle (weekly | monthly)
│   │   └── Amber "✏ szerkesztés" badge (write mode only, when can_write = true)
│   │
│   ├── [Weekly view] — when mode = 'weekly'
│   │   └── CoverageTable — same cell structure as CoveragePlannerView
│   │       ├── Office grouping
│   │       ├── Rule rows with day columns
│   │       └── Cells: need/have count + color
│   │
│   ├── [Monthly view] — when mode = 'monthly'
│   │   └── CalendarHeatmap — 5–6 week rows × 7 day columns
│   │       └── DayCell[] — color = worst-case coverage ratio
│   │
│   └── [WritePanel] — visible when can_write=true AND a cell is selected (below grid)
│       ├── [BEOSZTOTT (Assigned) column]
│       │   └── AssignedMemberRow[] with × button → embed_remove_shift RPC
│       └── [ELÉRHETŐ (Available) column]
│           └── AvailableMemberRow[] with + button → embed_assign_shift RPC
│
└── EmbedShiftRosterView (EmbedShiftRosterView.tsx) — when :view = 'shift_roster'
    └── [Weekly roster table]
        ├── [Header row] — day name + date columns
        └── [Member rows] — grouped by office
            └── MemberRow
                └── DayCell[] — one per day
                    ├── RoleBadge (4-char abbreviation) — if shift assigned
                    ├── "—" — if no shift
                    ├── × button (write mode only, on RoleBadge) → embed_remove_shift
                    └── + button (write mode only, on "—" cell) → opens mini role picker
                        └── embed_assign_shift on confirm
```

---

## Data Loading Strategy (CoveragePlannerView)

### Parallel Query Batch

On every date range change (week/month navigation, initial load), `CoveragePlannerView` fires **11 parallel Supabase queries** using `Promise.all()`:

```typescript
const [
  officesResult,
  rulesResult,
  shiftsResult,
  membershipsResult,
  memberSkillsResult,
  sitePrioritiesResult,
  skillsResult,
  holidaysResult,
  blockedDatesResult,
  leavesResult,
  availabilityResult,
] = await Promise.all([
  supabase.from('enterprise_offices').select('*').eq('workspace_id', workspaceId),
  supabase.from('enterprise_office_coverage_rules').select('*').eq('workspace_id', workspaceId).eq('status', 'active'),
  supabase.from('enterprise_shift_assignments').select('*').eq('workspace_id', workspaceId).gte('shift_date', fromISO).lte('shift_date', toISO),
  supabase.from('enterprise_memberships').select('*').eq('workspace_id', workspaceId).eq('status', 'active'),
  supabase.from('enterprise_member_skills').select('*').eq('workspace_id', workspaceId),
  supabase.from('enterprise_member_site_priorities').select('*').eq('workspace_id', workspaceId),
  supabase.from('enterprise_skills').select('*').eq('workspace_id', workspaceId),
  supabase.from('enterprise_holidays').select('*').eq('workspace_id', workspaceId).gte('holiday_date', fromISO).lte('holiday_date', toISO),
  supabase.from('enterprise_blocked_dates').select('*').eq('workspace_id', workspaceId).gte('blocked_date', fromISO).lte('blocked_date', toISO),
  supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).lte('start_date', toISO).gte('end_date', fromISO),
  supabase.from('enterprise_staff_availability').select('*').eq('workspace_id', workspaceId).gte('available_date', fromISO).lte('available_date', toISO),
]);
```

### Sequential Query (After Parallel Batch)

After the parallel batch, a sequential query fetches display names for all member user IDs:

```typescript
const userIds = memberships.map(m => m.user_id);
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, display_name, avatar_url')
  .in('id', userIds);
```

This is done sequentially because its input depends on the parallel batch results.

### Total: 12 Queries Per Load

| # | Table | Filter |
|---|-------|--------|
| 1 | enterprise_offices | workspace_id |
| 2 | enterprise_office_coverage_rules | workspace_id + status='active' |
| 3 | enterprise_shift_assignments | workspace_id + date range |
| 4 | enterprise_memberships | workspace_id + status='active' |
| 5 | enterprise_member_skills | workspace_id |
| 6 | enterprise_member_site_priorities | workspace_id |
| 7 | enterprise_skills | workspace_id |
| 8 | enterprise_holidays | workspace_id + date range |
| 9 | enterprise_blocked_dates | workspace_id + date range |
| 10 | leave_requests | workspace_id + date range overlap |
| 11 | enterprise_staff_availability | workspace_id + date range |
| 12 | profiles | IN (user_ids from #4) |

### Why Not a Single Join Query?

The 11+1 pattern is intentional:
- Individual table queries benefit from Supabase's auto-generated indexes on `workspace_id`
- The data volumes are small (typically < 500 rows per table for a weekly load)
- Results are cached in component state and reused across cell renders
- A single mega-join would be harder to maintain and optimize
- RLS policies are simpler to reason about on individual tables

---

## State Architecture

### All State in CoveragePlannerView

`CoveragePlannerView` uses no global store (no Redux, no Zustand, no Context for data). All data fetched from Supabase lives in local component state:

```typescript
const [offices, setOffices] = useState<Office[]>([]);
const [rules, setRules] = useState<CoverageRule[]>([]);
const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
const [memberships, setMemberships] = useState<Membership[]>([]);
const [memberSkills, setMemberSkills] = useState<MemberSkill[]>([]);
const [sitePriorities, setSitePriorities] = useState<SitePriority[]>([]);
const [skills, setSkills] = useState<Skill[]>([]);
const [holidays, setHolidays] = useState<Holiday[]>([]);
const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
const [availability, setAvailability] = useState<StaffAvailability[]>([]);
const [profiles, setProfiles] = useState<Profile[]>([]);

// UI state
const [drawerCell, setDrawerCell] = useState<DrawerCell | null>(null);
const [openShiftCell, setOpenShiftCell] = useState<OpenShiftCell | null>(null);
const [draftAssignments, setDraftAssignments] = useState<DraftAssignment[]>([]);
const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
const [fromDate, setFromDate] = useState<Date>(startOfCurrentWeek());
```

### Race Condition Prevention: loadIdRef

The component uses a monotonic `loadIdRef` pattern to prevent stale async loads from overwriting fresh data:

```typescript
const loadIdRef = useRef(0);

async function loadData(fromISO: string, toISO: string) {
  const thisLoadId = ++loadIdRef.current;
  
  const [officesResult, ...] = await Promise.all([...]);
  
  // If a newer load has started, discard these results
  if (thisLoadId !== loadIdRef.current) return;
  
  setOffices(officesResult.data ?? []);
  // ... set other state
}
```

This prevents a scenario where: user navigates to week 2 (load A starts), then to week 3 (load B starts), load A finishes last and overwrites week 3 data with week 2 data.

### Derived Maps (useMemo)

Heavy derived data structures are computed once with `useMemo` and invalidated only when their inputs change:

```typescript
const rulesByOffice = useMemo(() =>
  rules.reduce((acc, rule) => {
    if (!acc[rule.office_id]) acc[rule.office_id] = [];
    acc[rule.office_id].push(rule);
    return acc;
  }, {} as Record<string, CoverageRule[]>),
  [rules]
);

const memberOfficeMap = useMemo(() =>
  shifts.reduce((acc, shift) => {
    if (!acc[shift.user_id]) acc[shift.user_id] = new Set();
    acc[shift.user_id].add(shift.office_id);
    return acc;
  }, {} as Record<string, Set<string>>),
  [shifts]
);

const memberSitePriorityMap = useMemo(() =>
  sitePriorities.reduce((acc, sp) => {
    if (!acc.has(sp.membership_id)) acc.set(sp.membership_id, new Map());
    acc.get(sp.membership_id)!.set(sp.office_id, sp.priority);
    return acc;
  }, new Map<string, Map<string, number>>()),
  [sitePriorities]
);

const profileByUserId = useMemo(() =>
  profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Profile>),
  [profiles]
);

const holidaysISO = useMemo(() =>
  new Set(holidays.map(h => h.holiday_date)),
  [holidays]
);

const blockedDatesISO = useMemo(() =>
  new Set(blockedDates.map(b => b.blocked_date)),
  [blockedDates]
);
```

### Drawer State

Only one drawer can be open at a time:

```typescript
// drawerCell and openShiftCell are mutually exclusive
// Opening one always clears the other:
function openDrawerCell(cell: DrawerCell) {
  setOpenShiftCell(null);
  setDrawerCell(cell);
}

function openOpenShiftCell(cell: OpenShiftCell) {
  setDrawerCell(null);
  setOpenShiftCell(cell);
}
```

### Draft Assignments

`draftAssignments` is a temporary staging area for `suggestOptimal()` results:

```typescript
interface DraftAssignment {
  membership_id: string;
  user_id: string;
  display_name: string;
  office_id: string;
  shift_date: string;
  business_role: string | null;
}
```

Drafts are cleared when:
- User confirms them (triggers batch INSERT, then `loadData()` refresh)
- User discards them (explicit discard button)
- User navigates away from the drawer (drawer close sets `drawerCell = null` + clears drafts)

---

## Key Utility Functions

### coverageEligibility.ts

The complete eligibility engine. See `docs/capacity-planner/smart-scheduling.md` for full algorithm documentation.

```typescript
// Primary public API
export function rankCandidates(
  members: MemberInput[],
  req: RequirementInput,
  ctx: EligibilityContext
): EligibilityResult[]

// Secondary API (for detailed single-member evaluation)
export function evaluateEligibility(
  member: MemberInput,
  req: RequirementInput,
  ctx: EligibilityContext
): EligibilityResult

// Internal helpers (exported for unit testing)
export function isOnLeave(
  member: MemberInput,
  date: string,
  leaves: EligibilityContext['leaves']
): boolean

export function isDoubleBooked(
  member: MemberInput,
  date: string,
  officeId: string,
  shifts: EligibilityContext['shifts']
): boolean

export function isOverCapacity(
  member: MemberInput,
  shifts: EligibilityContext['shifts']
): boolean
```

### Canonical Rule Getters (CoveragePlannerView.tsx)

Two utility functions handle the multi-generation field evolution in `enterprise_office_coverage_rules`:

```typescript
/**
 * Returns the canonical list of required business roles for a rule.
 * Prefers the multi-value business_roles[] field (v3.40.0+).
 * Falls back to the legacy business_role string field.
 * Returns [] if neither is set (role-agnostic rule).
 */
function ruleRoles(r: CoverageRule): string[] {
  if (r.business_roles && r.business_roles.length > 0) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}

/**
 * Returns the canonical list of required skill IDs for a rule.
 * Prefers the multi-value skill_ids[] field (v3.40.0+).
 * Falls back to the legacy skill_id uuid field.
 * Returns [] if neither is set (skill-agnostic rule).
 */
function ruleSkillIds(r: CoverageRule): string[] {
  if (r.skill_ids && r.skill_ids.length > 0) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}
```

**These two functions are the ONLY correct way to read role/skill requirements from a rule.** Never access `r.business_role`, `r.business_roles`, `r.skill_id`, or `r.skill_ids` directly in rendering or eligibility code — always go through these getters.

---

## Database Schema

### enterprise_office_coverage_rules

Defines staffing requirements per office. The schema has evolved across versions to support multi-role and multi-skill requirements.

```sql
CREATE TABLE public.enterprise_office_coverage_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.enterprise_workspace(id) ON DELETE CASCADE,
  office_id        uuid NOT NULL REFERENCES public.enterprise_offices(id) ON DELETE CASCADE,
  name             text NULL,                    -- Display name, e.g. "Morning Shift"

  -- Legacy single-value fields (pre-v3.40.0, preserved for backwards compatibility):
  business_role    text NULL,                    -- single role string
  skill_id         uuid NULL,                    -- single skill UUID
  min_skill_level  integer NULL,                 -- minimum skill level (1–5)

  -- Multi-value fields (v3.40.0+, preferred):
  business_roles   text[] NULL,                  -- e.g. {'cashier','supervisor'}
  skill_ids        uuid[] NULL,                  -- e.g. {uuid1, uuid2}

  -- Headcount:
  min_headcount    integer NOT NULL DEFAULT 1,   -- required number of staff

  -- Schedule applicability:
  days_of_week     integer[] NULL,
  -- NULL = applies every day
  -- [1,2,3,4,5] = weekdays (0=Sun, 1=Mon, ..., 6=Sat)
  rule_date        date NULL,
  -- Set for a one-off rule on a specific date
  valid_from       date NULL,
  -- Rule applies starting this date
  valid_until      date NULL,
  -- Rule expires after this date (inclusive)

  -- Content:
  notes            text NULL,                    -- Manager notes on the rule

  -- Lifecycle:
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'expired')),
  archived_at      timestamptz NULL,

  -- Audit:
  created_by       uuid NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes:
CREATE INDEX ON enterprise_office_coverage_rules (workspace_id, office_id, status);
CREATE INDEX ON enterprise_office_coverage_rules (workspace_id, status) WHERE status = 'active';
```

**Rule applicability logic:** A rule applies to a given date if:
1. `status = 'active'`
2. If `rule_date` is set: `rule_date = target_date`  
   Else if `days_of_week` is set: `EXTRACT(DOW FROM target_date) = ANY(days_of_week)`  
   Else: rule applies every day
3. `valid_from IS NULL OR valid_from <= target_date`
4. `valid_until IS NULL OR valid_until >= target_date`

---

### enterprise_shift_assignments

Records of individual employee shift assignments.

```sql
CREATE TABLE public.enterprise_shift_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspace(id) ON DELETE CASCADE,
  membership_id   uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),   -- denormalized for query perf
  office_id       uuid NOT NULL REFERENCES public.enterprise_offices(id),
  shift_date      date NOT NULL,
  business_role   text NULL,                     -- role at time of assignment
  skill_id        uuid NULL,                     -- primary skill at time of assignment
  is_tentative    boolean NOT NULL DEFAULT false, -- future: draft/tentative assignments
  notes           text NULL,

  -- Audit:
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes:
CREATE INDEX ON enterprise_shift_assignments (workspace_id, shift_date);
CREATE INDEX ON enterprise_shift_assignments (workspace_id, user_id, shift_date);
CREATE INDEX ON enterprise_shift_assignments (office_id, shift_date);

-- Constraint: one assignment per user per date per office
-- (user can have at most one shift per office per day)
CREATE UNIQUE INDEX ON enterprise_shift_assignments (user_id, office_id, shift_date);
```

---

### enterprise_open_shift_requests

Open shift broadcasts and their state.

```sql
CREATE TABLE public.enterprise_open_shift_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.enterprise_workspace(id),
  office_id             uuid NOT NULL REFERENCES public.enterprise_offices(id),
  shift_date            date NOT NULL,

  -- Position (multi-generation):
  business_role         text NULL,           -- legacy
  skill_id              uuid NULL,           -- legacy
  role_id               uuid NULL REFERENCES public.enterprise_workspace_roles(id),  -- v3.40.0
  skill_ids             uuid[] NOT NULL DEFAULT '{}',                               -- v3.40.0

  -- Fulfillment status:
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  filled_by_user_id     uuid NULL REFERENCES auth.users(id),
  filled_at             timestamptz NULL,
  replacement_found     boolean NOT NULL DEFAULT false,

  -- Notification state:
  notified_user_ids     uuid[] NOT NULL DEFAULT '{}',
  target_user_ids       uuid[] NOT NULL DEFAULT '{}',
  declined_user_ids     uuid[] NOT NULL DEFAULT '{}',  -- v3.43.0

  -- Escalation:
  respond_by_at         timestamptz NULL,
  escalation_level      integer NOT NULL DEFAULT 0,
  timeout_hours         numeric NOT NULL DEFAULT 3,

  -- Content:
  notes                 text NULL,

  -- Audit:
  created_by            uuid NOT NULL REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes:
CREATE INDEX ON enterprise_open_shift_requests (workspace_id, office_id, shift_date, status);
CREATE INDEX ON enterprise_open_shift_requests (status, respond_by_at) WHERE status = 'open';
```

---

### enterprise_embed_tokens (v3.44.0+)

Embed SDK authentication tokens.

```sql
CREATE TABLE public.enterprise_embed_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.enterprise_workspace(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  label         text NOT NULL,
  token         text NOT NULL UNIQUE,    -- 256-bit hex (64 chars); generated via:
                                         -- encode(extensions.gen_random_bytes(32), 'hex')
  allowed_views text[] NOT NULL DEFAULT '{capacity_planner}',
  can_write     boolean NOT NULL DEFAULT false,  -- v3.46.0
  is_active     boolean NOT NULL DEFAULT true,
  last_used_at  timestamptz NULL,
  expires_at    timestamptz NULL,        -- NULL = perpetual
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes:
CREATE UNIQUE INDEX ON enterprise_embed_tokens (token);    -- O(1) token lookup
CREATE INDEX ON enterprise_embed_tokens (workspace_id, is_active);

-- RLS: workspace owners/admins can INSERT/SELECT/UPDATE/DELETE their workspace's tokens
-- anon role: no direct access (all access via SECURITY DEFINER RPCs only)
```

---

## API Functions (Supabase RPCs)

### claim_open_shift

```sql
CREATE OR REPLACE FUNCTION public.claim_open_shift(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request  enterprise_open_shift_requests;
  _member   enterprise_memberships;
BEGIN
  -- Fetch and lock request
  SELECT * INTO _request
  FROM enterprise_open_shift_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open shift request not found';
  END IF;
  IF _request.status <> 'open' THEN
    RAISE EXCEPTION 'Shift already filled';
  END IF;

  -- Validate caller membership
  SELECT * INTO _member
  FROM enterprise_memberships
  WHERE workspace_id = _request.workspace_id
    AND user_id = auth.uid()
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  -- Create assignment
  INSERT INTO enterprise_shift_assignments (
    workspace_id, membership_id, user_id, office_id,
    shift_date, business_role, created_by
  ) VALUES (
    _request.workspace_id, _member.id, auth.uid(), _request.office_id,
    _request.shift_date, _request.business_role, auth.uid()
  );

  -- Mark request filled
  UPDATE enterprise_open_shift_requests SET
    status = 'filled',
    filled_by_user_id = auth.uid(),
    filled_at = now()
  WHERE id = _request_id;

  -- Record claim
  INSERT INTO enterprise_open_shift_claims (request_id, user_id, action)
  VALUES (_request_id, auth.uid(), 'claimed')
  ON CONFLICT (request_id, user_id) DO UPDATE SET action = 'claimed', actioned_at = now();

  -- Notify others (implementation via pg_notify or notification table)
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_open_shift(uuid) TO authenticated;
```

---

### create_open_shift_request

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_open_shift_request(
  _workspace_id     uuid,
  _office_id        uuid,
  _shift_date       date,
  _role_id          uuid          DEFAULT NULL,
  _skill_ids        uuid[]        DEFAULT '{}',
  _target_user_ids  uuid[]        DEFAULT '{}',
  _timeout_hours    numeric       DEFAULT 3,
  _notes            text          DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
```

**Authorization:** Caller must have `owner` or `admin` role in `_workspace_id`. The function validates via `enterprise_memberships.role IN ('owner', 'admin')`.

**Broadcast vs. targeted logic:**
```sql
IF array_length(_target_user_ids, 1) IS NULL OR array_length(_target_user_ids, 1) = 0 THEN
  -- Broadcast: find all matching members
  SELECT array_agg(em.user_id) INTO _notified
  FROM enterprise_memberships em
  WHERE em.workspace_id = _workspace_id
    AND em.status = 'active'
    AND (
      _role_id IS NULL
      OR EXISTS (
        SELECT 1 FROM enterprise_workspace_roles wr
        WHERE wr.id = _role_id
          AND em.business_role = wr.role_name
      )
    );
ELSE
  _notified := _target_user_ids;
END IF;
```

---

### join_open_shift_waitlist

```sql
CREATE OR REPLACE FUNCTION public.join_open_shift_waitlist(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

Inserts with `queue_position = COALESCE(MAX(queue_position), 0) + 1` to maintain queue order without gaps.

---

### cancel_shift_assignment

```sql
CREATE OR REPLACE FUNCTION public.cancel_shift_assignment(
  _assignment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Authorization:** Caller must be the assignment owner (`user_id = auth.uid()`) OR a workspace owner/admin.

**Replacement logic (pseudocode):**
```
1. INSERT INTO enterprise_shift_cancellations (audit row)
2. DELETE FROM enterprise_shift_assignments WHERE id = _assignment_id

3. Find open_shift_request for this (office_id, shift_date, business_role):
   IF found:
     Find first waitlisted member (ORDER BY queue_position ASC):
       IF found:
         INSERT new shift_assignment for waitlisted member
         UPDATE request: status='filled', filled_by_user_id=waitlisted.user_id
         UPDATE waitlist row: promoted_at=now()
         Notify promoted member
         Notify managers: "Auto-replacement found"
       ELSE:
         INSERT new open_shift_request (replacement broadcast)
         Notify managers: "No replacement, re-broadcast initiated"
   ELSE:
     Notify managers: "Shift cancelled, no open request — manual replacement needed"
```

---

### decline_open_shift_invitation (v3.43.0)

```sql
CREATE OR REPLACE FUNCTION public.decline_open_shift_invitation(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Key behavior:** If after recording the decline, `target_user_ids - declined_user_ids = {}` (all targeted candidates have declined), the function immediately triggers the escalation logic rather than waiting for `respond_by_at`.

---

### get_embed_view_data

See `docs/capacity-planner/embed-sdk.md` for full RPC documentation. Key implementation note: the function updates `last_used_at` as a side effect of every call, enabling usage analytics in the EmbedManager token list.

---

### embed_assign_shift / embed_remove_shift

See `docs/capacity-planner/embed-sdk.md` for full RPC documentation. Key implementation note: both functions verify `can_write = true` via a `SELECT can_write FROM enterprise_embed_tokens WHERE token = _token AND is_active = true` check before any mutation.

---

## i18n Architecture

### Framework

The application uses a custom `useI18n()` hook wrapping a locale resource dictionary. All user-facing strings in Capacity Planner components use this hook:

```typescript
const { t } = useI18n();
// Usage:
<span>{t('coverage_planner.suggest_optimal')}</span>
```

### Non-Negotiable Rule (v3.7.2+)

Every new user-facing string MUST appear in ALL locale files in the same commit. Currently supported locales:
- `src/i18n/resources/en.ts` — English
- `src/i18n/resources/hu.ts` — Hungarian

Future locales (Czech, Slovak, Polish) will be added later and must be kept in sync with en.ts as the reference.

### Namespace Organization

Coverage Planner strings are organized under these top-level namespaces in both locale files:

| Namespace | Approximate line range (en.ts) | Contents |
|-----------|-------------------------------|---------|
| `coverage_planner` | ~4000–4100 | Core planner UI strings |
| `open_shifts` | ~4100–4200 | Open shift broadcast strings |
| `smart_batch` | ~4200–4250 | Batch scheduling dialog strings |
| `embed` | ~4250–4320 | Embed SDK and EmbedManager strings |

### Key String Examples

```typescript
// en.ts
coverage_planner: {
  tab_label: 'Capacity Planner',
  suggest_optimal: 'Suggest Optimal',
  draft_confirm: 'Confirm',
  draft_discard: 'Discard',
  understaffed: 'Understaffed',
  fully_staffed: 'Fully staffed',
  broadcast_label: 'Broadcast posted',
},
open_shifts: {
  post_button: 'Post open shift',
  notify_selected: 'Notify selected {{count}}',
  broadcast_all: 'Broadcast to all matching',
  claim_button: 'Claim',
  waitlist_button: 'Join waitlist',
  decline_button: 'Decline',
},
embed: {
  write_badge: '✏ szerkesztés',
  invalid_token: 'Invalid token',
  token_expired: 'Token expired',
  assigned_column: 'BEOSZTOTT',
  available_column: 'ELÉRHETŐ',
},
```

### String Hardcoding Prohibition

**Never hardcode UI strings in component JSX.** This is a hard architectural rule (v3.7.2+). The following is forbidden:

```tsx
// WRONG — hardcoded English string in component
<Button>Suggest Optimal</Button>

// CORRECT
<Button>{t('coverage_planner.suggest_optimal')}</Button>
```

The linting/review process checks for hardcoded strings in `.tsx` files touching any user-visible element.

---

## Rendering Architecture

### CSS Grid for Coverage Matrix

The coverage matrix uses a CSS grid with dynamically computed column counts:

```typescript
const gridTemplateColumns = `200px repeat(${dateColumns.length}, 1fr)`;
// Example for 7-day week: "200px repeat(7, 1fr)"
```

This is set as an inline style on the grid container. No CSS class encodes the column count — it is always computed from the current date range.

### Cell Coloring Logic

```typescript
function getCellColorClass(assigned: number, needed: number, hasOpenRequest: boolean): string {
  if (hasOpenRequest && assigned < needed) return 'bg-amber-100 border-amber-300 text-amber-800';
  if (assigned === 0 && needed > 0) return 'bg-rose-100 border-rose-300 text-rose-800';
  if (assigned < needed) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-emerald-50 border-emerald-200 text-emerald-700';
}
```

The `hasOpenRequest` flag takes priority over the standard understaffing amber — an open request shows a distinct amber tone with the "Meghirdett" label.

### Monthly Heatmap Rendering

For monthly view, a `CalendarHeatmap` component renders a 5–6 week grid:

```typescript
// Worst-case ratio for a given date
function getWorstCaseRatio(date: string, rules: CoverageRule[], shifts: ShiftAssignment[]): number {
  const applicableRules = rules.filter(r => ruleAppliesOnDate(r, date));
  if (applicableRules.length === 0) return 1; // no rules → grey (neutral)
  
  const ratios = applicableRules.map(rule => {
    const assigned = shifts.filter(s => s.shift_date === date && /* rule match */ ...).length;
    return assigned / rule.min_headcount;
  });
  
  return Math.min(...ratios); // worst case = minimum ratio
}
```

Color scale:
- `ratio >= 1.0` → emerald (fully covered)
- `0 < ratio < 1.0` → amber (partial, gradient intensity based on ratio)
- `ratio === 0` → rose (no coverage)
- No rules → grey

---

## Performance Considerations

### Load Time Budget

Target: < 800ms from navigation trigger to rendered coverage grid on a workspace with:
- Up to 10 offices
- Up to 50 coverage rules
- Up to 200 shift assignments per week
- Up to 100 active members

The 11 parallel queries typically complete in 200–400ms on a Supabase project with appropriate indexes.

### Eligibility Computation Timing

`rankCandidates()` for 100 members against one slot typically completes in < 5ms in a browser JS environment. For `SmartBatchScheduleDialog` generating a full month (22 working days × 5 offices × 3 rules = 330 slots), computation takes approximately 50–150ms total — acceptable for a one-time batch generation.

### Re-render Optimization

- `useMemo` on all derived maps prevents re-computation on every render
- Coverage cells are individually memoized (`React.memo` on `CoverageCell`) to prevent full-grid re-renders when only one cell changes
- Drawer state changes (`setDrawerCell`) do not trigger grid re-renders (grid state is unchanged)

### Data Freshness

The component does **not** auto-poll for updates. Data is fetched:
- On initial mount
- On date range navigation (week/month change)
- After any mutation (shift assign/remove triggers `loadData()` refresh)

This means concurrent changes by another manager are not visible until the user navigates away and back, or refreshes. Real-time subscriptions (`supabase.channel()`) are planned but not yet implemented in this component.
