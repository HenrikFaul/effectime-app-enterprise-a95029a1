# Effectime Open Shift Broadcast — Complete Reference

**Introduced:** v3.40.0  
**Extended:** v3.43.0 (decline invitations), v3.44.0 (waitlist promotion)  
**Base path:** `docs/capacity-planner/open-shifts.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Two Entry Points](#two-entry-points)
3. [Create Open Shift Flow](#create-open-shift-flow)
4. [Employee Claim Flow](#employee-claim-flow)
5. [Waitlist](#waitlist)
6. [Cancellation & Replacement Flow](#cancellation--replacement-flow)
7. [Escalation System](#escalation-system)
8. [Decline Shift Invitation (v3.43.0)](#decline-shift-invitation-v3430)
9. [Database Schema Reference](#database-schema-reference)
10. [RPC Reference](#rpc-reference)
11. [Notification Architecture](#notification-architecture)
12. [UI State Reference](#ui-state-reference)

---

## Overview

The **Open Shift Broadcast** system solves the "nobody is available" problem in workforce scheduling. When a coverage rule has an unfilled slot and no known-available in-office member can fill it, managers can broadcast the opportunity to eligible employees who can volunteer to claim it.

The workflow supports:
- **Targeted notification** — send to specific pre-screened candidates
- **Broadcast notification** — send to all role/skill-matching active members
- **Waitlist** — queue interested employees if the shift is already claimed
- **Auto-replacement** — when an assigned member cancels, first waitlisted member is automatically promoted
- **Escalation** — if no one responds within a timeout, notify the next batch of candidates
- **Decline** — employees can decline an invitation, removing themselves from the candidate pool

**Cell visual states after posting:**

| State | Color | Label |
|-------|-------|-------|
| Not yet posted | Rose | Understaffed count |
| Posted, unclaimed | Amber | "Meghirdett" (Broadcast) |
| Claimed (filled) | Emerald | ✓ with member name |
| Cancelled after fill | Rose | Back to understaffed |

---

## Two Entry Points

### Entry Point 1: From a Coverage Rule Cell (Most Common)

This path is used when a defined coverage rule has an unfilled slot.

**Step-by-step:**

1. Manager clicks an understaffed (rose) cell in the Coverage Planner grid
2. The assignment drawer opens (`Sheet` component on the right side)
3. The drawer shows the coverage rule details and the current assignment list
4. If slots remain unfilled after exhausting available in-office members:
   - The compact `OpenShiftManager` component appears in the drawer header
   - It shows a "Post open shift" button and optionally the top 3 smart-suggested candidates
5. Manager clicks "Post open shift"
   - Opens the condensed position picker + notification form (all inline in the drawer)

This is the most common path — it contextually presents open shift posting only when understaffing is detected.

### Entry Point 2: From a No-Rule Cell (Flexible/Ad-hoc Shifts)

This path is used for cells that have no coverage rule (e.g., a Saturday cell when no rule exists for weekends).

**Step-by-step:**

1. Manager clicks any cell that has no coverage rule
2. A separate "open shift only" drawer opens (`openShiftCell` state vs. `drawerCell`)
3. The drawer header shows: office name + date
4. The drawer body shows:
   - Currently assigned members (freeform, not rule-bound)
   - Full-mode `OpenShiftManager` (not compact mode)
5. Manager can post an open shift broadcast without any rule constraint

**Differences from Entry Point 1:**

| Aspect | From Rule Cell | From No-Rule Cell |
|--------|----------------|-------------------|
| Mode | Compact (in drawer header) | Full |
| Role constraint | Inherited from coverage rule | Freely specified |
| Min headcount | From rule | Not enforced |
| Context | Rule already defines need | Manager defines need ad-hoc |

---

## Create Open Shift Flow

### Full Sequence

```
Step 1: Manager selects position (role)
  → PositionPickerDialog opens
  → Searchable list of enterprise_workspace_roles catalog
  → Manager selects one role
  → Dialog closes, role field populated

Step 2: Manager optionally selects skills
  → Multi-select skill picker (enterprise_skills)
  → Each selected skill appears as a chip
  → These become the skill_ids[] in the request

Step 3: Manager sets timeout_hours
  → Numeric input or slider
  → Default: 3 hours
  → After timeout: escalation logic triggers (next batch notified)
  → Sets respond_by_at = now() + timeout_hours

Step 4: View smart-suggested candidates
  → Top-3 candidates displayed (from rankCandidates() output)
  → Each has a checkbox (pre-checked for top candidate if ✨ wand used)
  → Issues shown as chips (⚠ Pending leave, ⚠ Over capacity, etc.)

Step 5: Choose notification action
  → Action A: "Notify selected N"
      - Creates request with target_user_ids = [checked user_ids]
      - Only selected employees receive notification
      - Cell shows amber "Meghirdett" label
  → Action B: "Broadcast to all matching"
      - Creates request with target_user_ids = []  (empty = broadcast)
      - All role/skill-matching active members receive notification
      - Cell shows amber "Meghirdett" label

Step 6: RPC create_open_shift_request() executes
  → Server validates role/skill
  → Server queries matching members (for broadcast)
  → Creates enterprise_open_shift_requests row
  → Sends push notifications / in-app notifications
  → Returns new request UUID
```

### PositionPickerDialog

- Searchable input filters `enterprise_workspace_roles` by role name
- Roles are shown with their color badges
- Selecting a role also pre-populates the business_role field (for legacy compatibility)
- Role catalog is workspace-scoped; custom roles defined by workspace admin appear here

### Notification Type Distinction

| Type | `target_user_ids` | Who gets notified |
|------|------------------|-------------------|
| Targeted | `[user_a, user_b]` | Only user_a and user_b |
| Broadcast | `[]` (empty array) | All role/skill-matching active members |

For targeted notifications, the server-side RPC uses `target_user_ids` directly without additional filtering. For broadcast, the RPC queries:

```sql
SELECT em.user_id
FROM enterprise_memberships em
WHERE em.workspace_id = _workspace_id
  AND em.status = 'active'
  AND em.business_role = ANY(_business_roles)   -- or skill match
```

---

## Employee Claim Flow

Employees interact with open shifts via the **Shift Marketplace** tab in their workspace dashboard.

### Discovery

Employees discover open shifts via:
1. **In-app notification** — push notification with deep link to the specific open shift
2. **Shift Marketplace tab** — panel in the employee's dashboard listing all open shifts for their workspace matching their role/skills
3. **Email notification** (if configured by workspace) — digest or per-shift email

### Claim Sequence

```
1. Employee views the open shift details:
   - Office name and location
   - Date and approximate shift time (from rule context)
   - Required role + skills
   - Notes from manager

2. Employee clicks "Claim" (Hungarian: "Igénylés" / "sikeres igénylés")

3. Frontend calls: claim_open_shift(_request_id: uuid)

4. RPC executes (SECURITY DEFINER):
   a. Validates request exists and status = 'open'
   b. Validates caller is an active member of the workspace
   c. Validates caller is not already assigned to a shift on this date at a different office
   d. Creates enterprise_shift_assignments row:
      INSERT INTO enterprise_shift_assignments (
        workspace_id, membership_id, user_id, office_id,
        shift_date, business_role, created_by
      ) VALUES (...) ON CONFLICT (user_id, shift_date) DO UPDATE ...
   e. Sets enterprise_open_shift_requests:
        status = 'filled',
        filled_by_user_id = auth.uid(),
        filled_at = now()
   f. Sends "shift filled" notification to other notified_user_ids
   g. Returns void (success)

5. UI updates:
   - Shift Marketplace removes this shift from the available list
   - Coverage grid cell turns green (emerald) with member name
   - Other employees who received notifications see "This shift has been filled"
```

### Concurrency Handling

If two employees click "Claim" simultaneously:
- The RPC uses a database-level transaction
- The first to commit wins
- The second receives a constraint error, which the frontend translates to: "Sorry, this shift has just been filled by another team member"
- The second employee is redirected to the "Join Waitlist" option

---

## Waitlist

### Purpose

The waitlist allows employees who are interested in an already-filled shift to queue for it. If the assigned member later cancels, the first waitlisted member is automatically promoted.

### Joining the Waitlist

```
If shift.status = 'filled':
  - Employee sees "Join waitlist" button instead of "Claim"
  - Clicking calls: join_open_shift_waitlist(_request_id: uuid)
  - RPC inserts into enterprise_open_shift_waitlist:
      (request_id, user_id, joined_at, queue_position)
      queue_position = MAX(queue_position) + 1 for this request
  - Employee receives confirmation: "You are #N in the waitlist"
```

### Waitlist Table Structure

```sql
TABLE enterprise_open_shift_waitlist (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid FK enterprise_open_shift_requests,
  user_id        uuid FK auth.users,
  joined_at      timestamptz DEFAULT now(),
  queue_position integer NOT NULL,
  promoted_at    timestamptz NULL,      -- set when promoted to assigned
  UNIQUE (request_id, user_id)
)
```

### Auto-Promotion Logic

When the assigned member cancels (see [Cancellation Flow](#cancellation--replacement-flow)):

```sql
-- In cancel_shift_assignment() RPC:

-- 1. Find first waitlisted member for this request
SELECT user_id, id
FROM enterprise_open_shift_waitlist
WHERE request_id = _request_id
  AND promoted_at IS NULL
ORDER BY queue_position ASC
LIMIT 1;

-- 2. If found:
--   a. Create new shift_assignment for this user
--   b. Set request.status = 'filled', request.filled_by_user_id = found user
--   c. Set waitlist row: promoted_at = now()
--   d. Notify promoted user: "Great news — you've been assigned to the shift"
--   e. Notify manager: "Auto-replacement found for [date] at [office]"

-- 3. If not found:
--   a. Create new open_shift_request (replacement broadcast)
--   b. Notify manager: "No replacement found — re-broadcast initiated"
```

### Waitlist Visibility

- Employees can see their current waitlist position in the Shift Marketplace
- Managers can see the waitlist for a shift in the Coverage Planner drawer (after clicking the shift cell)
- Queue positions are recalculated when a member leaves the waitlist (either promoted or withdrawn)

---

## Cancellation & Replacement Flow

### Employee-Initiated Cancellation

```
1. Employee finds the shift in "My Schedule" or the Coverage grid (their day cell)
2. Clicks "Cancel" button

3. Frontend calls: cancel_shift_assignment(_assignment_id: uuid)

4. RPC executes (SECURITY DEFINER):
   a. Validates caller owns this assignment (user_id = auth.uid())
      OR caller is a manager/owner of the workspace
   b. Inserts audit record into enterprise_shift_cancellations:
        (assignment_id, user_id, office_id, shift_date, business_role,
         cancelled_by, cancelled_at, reason)
   c. Deletes the enterprise_shift_assignments row

   d. Checks: does an open_shift_request exist for this (office, date, role)?
      -- If YES (shift was claimed from open shift):
        i. Check enterprise_open_shift_waitlist for this request:
           - If waitlisted member exists → auto-promote (see above)
           - If no waitlisted member → create new open_shift_request
             (same office, date, role; re-broadcast to eligible members)
      -- If NO (shift was manually assigned, not from open shift):
        i. No automatic replacement; notify managers

   e. Sets replacement_found = true/false on the original request (if exists)
   f. Notifies managers if no replacement was found automatically

5. UI updates:
   - Grid cell reverts to rose (understaffed)
   - Employee's "My Schedule" removes the shift
   - If auto-replacement found: grid cell goes back to green with new member name
```

### Manager-Initiated Cancellation

Managers can cancel any shift assignment from the Coverage Planner drawer:
- × button on a filled slot row
- Calls the same `cancel_shift_assignment()` RPC
- RPC allows cancellation if caller is a workspace owner/admin

### Audit Trail

Every cancellation creates a row in `enterprise_shift_cancellations`:

```sql
TABLE enterprise_shift_cancellations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid,              -- original assignment id (may no longer exist)
  user_id         uuid,              -- employee who had the shift
  office_id       uuid,
  shift_date      date,
  business_role   text NULL,
  cancelled_by    uuid,              -- who pressed cancel (may differ from user_id)
  cancelled_at    timestamptz DEFAULT now(),
  reason          text NULL,
  replacement_found boolean DEFAULT false
)
```

This table is append-only. Managers can review cancellation history in Workspace Settings → Schedule History (planned feature; table exists for future UI).

---

## Escalation System

### Current Status (as of v3.40.0)

The escalation system is **partially implemented**. The RPC infrastructure exists and has been tested, but the pg_cron job that calls it is not yet wired in production.

### Intended Design

```
Escalation trigger: respond_by_at < now() AND status = 'open'

pg_cron schedule: */15 * * * *  (every 15 minutes)
Function: process_open_shift_escalations()

Logic per qualifying request:
  1. Find next batch of 5 eligible members who:
     - Match the role/skill requirements
     - Have NOT been in notified_user_ids (haven't been notified yet)
     - Are active workspace members
  2. Send notifications to this batch
  3. Add them to notified_user_ids
  4. Increment escalation_level (escalation_level++)
  5. Reset respond_by_at = now() + timeout_hours

Escalation levels:
  Level 0: Initial targeted/broadcast notification
  Level 1: First escalation batch (next 5 members)
  Level 2: Second escalation batch
  Level N: After all members notified → manager alert + possible auto-cancel
```

### Request Fields for Escalation

```sql
respond_by_at      timestamptz NULL    -- deadline; NULL = no timeout
escalation_level   int DEFAULT 0      -- how many escalation rounds have occurred
timeout_hours      numeric DEFAULT 3  -- hours between escalation rounds
notified_user_ids  uuid[]             -- all users who have received notification
```

### Production Wiring (To-Do)

To activate the escalation system in production:

1. Enable `pg_cron` extension (requires Supabase Pro or higher)
2. Schedule the cron job:
   ```sql
   SELECT cron.schedule(
     'escalate-open-shifts',
     '*/15 * * * *',
     'SELECT process_open_shift_escalations()'
   );
   ```
3. Set `respond_by_at` in `create_open_shift_request` based on `timeout_hours`

Until this is wired, `respond_by_at` and `escalation_level` fields exist in the schema and RPC but have no automated behavior.

---

## Decline Shift Invitation (v3.43.0)

### Overview

Employees who receive a targeted open shift notification can now explicitly decline it. This prevents repeated notifications and allows the system to intelligently route to the next available candidate.

### Decline Flow

```
1. Employee views an open shift notification (targeted to them)

2. Employee clicks "Decline" (Hungarian: "Visszautasítás")

3. Frontend calls: decline_open_shift_invitation(_request_id: uuid)

4. RPC executes (SECURITY DEFINER):
   a. Validates: request exists and caller is in notified_user_ids or target_user_ids
   b. Inserts into enterprise_open_shift_claims:
        (request_id, user_id, action='declined', actioned_at=now())
   c. Removes auth.uid() from request.notified_user_ids
   d. Removes auth.uid() from request.target_user_ids (if targeted)
   e. Updates request: declined_user_ids = array_append(declined_user_ids, auth.uid())
   f. Checks: if all targeted candidates have declined → trigger early escalation
      (calls escalation logic immediately rather than waiting for respond_by_at)

5. UI updates:
   - Shift removed from employee's notification list
   - Employee sees "You declined this shift" confirmation
```

### open_shift_claims Table

```sql
TABLE enterprise_open_shift_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid FK enterprise_open_shift_requests,
  user_id      uuid FK auth.users,
  action       text CHECK (IN ('claimed', 'declined', 'waitlisted')),
  actioned_at  timestamptz DEFAULT now(),
  UNIQUE (request_id, user_id)
)
```

This table records every claim, decline, and waitlist action for auditing and analytics.

### Effect on Future Notifications

Once a user has declined a request:
- They are excluded from all future escalation batches for this specific request
- If a broadcast is re-issued (after cancellation), the declined user is eligible again for the new request (declines are per-request, not permanent)

---

## Database Schema Reference

### enterprise_open_shift_requests

```sql
TABLE enterprise_open_shift_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL FK enterprise_workspace,
  office_id             uuid NOT NULL FK enterprise_offices,
  shift_date            date NOT NULL,

  -- Position definition (multi-generation field evolution):
  business_role         text NULL,       -- legacy single-role field
  skill_id              uuid NULL,       -- legacy single-skill field
  role_id               uuid NULL FK enterprise_workspace_roles,  -- v3.40.0
  skill_ids             uuid[] DEFAULT '{}',                      -- v3.40.0

  -- Status:
  status                text NOT NULL CHECK (IN ('open', 'filled', 'cancelled')),
  filled_by_user_id     uuid NULL FK auth.users,
  filled_at             timestamptz NULL,
  replacement_found     boolean DEFAULT false,

  -- Notification state:
  notified_user_ids     uuid[] NOT NULL DEFAULT '{}',
  target_user_ids       uuid[] NOT NULL DEFAULT '{}',
  declined_user_ids     uuid[] NOT NULL DEFAULT '{}',      -- v3.43.0
  respond_by_at         timestamptz NULL,
  escalation_level      integer NOT NULL DEFAULT 0,
  timeout_hours         numeric NOT NULL DEFAULT 3,

  -- Content:
  notes                 text NULL,

  -- Meta:
  created_by            uuid NOT NULL FK auth.users,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
)
```

**Indexes:**
```sql
CREATE INDEX ON enterprise_open_shift_requests (workspace_id, office_id, shift_date, status);
CREATE INDEX ON enterprise_open_shift_requests (status, respond_by_at) WHERE status = 'open';
```

---

## RPC Reference

### claim_open_shift

```sql
FUNCTION public.claim_open_shift(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Caller:** Authenticated employee (any active workspace member).

**Preconditions:**
- `enterprise_open_shift_requests.status = 'open'`
- Caller is active member of the request's workspace
- Caller is not double-booked on `shift_date`

**Effects:**
1. Inserts `enterprise_shift_assignments` row
2. Updates request: `status = 'filled'`, `filled_by_user_id`, `filled_at`
3. Inserts `enterprise_open_shift_claims` row (action='claimed')
4. Sends "filled" notification to remaining `notified_user_ids`

**Errors:**
- `Shift already filled` — if status ≠ 'open' when RPC executes
- `Double booked` — if caller already has a shift at a different office on this date

---

### create_open_shift_request

```sql
FUNCTION public.create_open_shift_request(
  _workspace_id     uuid,
  _office_id        uuid,
  _shift_date       date,
  _role_id          uuid DEFAULT NULL,
  _skill_ids        uuid[] DEFAULT '{}',
  _target_user_ids  uuid[] DEFAULT '{}',
  _timeout_hours    numeric DEFAULT 3,
  _notes            text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
```

**Caller:** Authenticated workspace manager/owner.

**Behavior:**
- `_target_user_ids = []` → broadcast: queries all matching members, sends to all
- `_target_user_ids = [...]` → targeted: sends only to listed user IDs

**Returns:** UUID of created `enterprise_open_shift_requests` row.

---

### join_open_shift_waitlist

```sql
FUNCTION public.join_open_shift_waitlist(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Caller:** Authenticated employee.

**Preconditions:**
- Request exists and `status = 'filled'`
- Caller is not already on the waitlist for this request

**Effects:**
- Inserts `enterprise_open_shift_waitlist` row with next `queue_position`
- Inserts `enterprise_open_shift_claims` row (action='waitlisted')

---

### cancel_shift_assignment

```sql
FUNCTION public.cancel_shift_assignment(
  _assignment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Caller:** The employee who owns the assignment, OR a workspace manager/owner.

**Effects:**
1. Inserts `enterprise_shift_cancellations` audit row
2. Deletes `enterprise_shift_assignments` row
3. If associated open shift request exists:
   - Promotes first waitlisted member (if any)
   - Or creates new open_shift_request (if no waitlist)
4. Notifies relevant parties

---

### decline_open_shift_invitation

```sql
FUNCTION public.decline_open_shift_invitation(
  _request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Caller:** Authenticated employee who received the notification.

**Preconditions:**
- Caller is in `notified_user_ids` or `target_user_ids`
- Request status = 'open'

**Effects:**
1. Inserts `enterprise_open_shift_claims` row (action='declined')
2. Removes caller from `notified_user_ids` and `target_user_ids`
3. Appends caller to `declined_user_ids`
4. If all targeted candidates declined → triggers escalation immediately

---

## Notification Architecture

Open shift notifications are delivered via Effectime's internal notification system. Notification records are created in `enterprise_notifications` (or equivalent table):

```
Notification types used by open shift system:
  open_shift_broadcast    — new open shift available (broad)
  open_shift_targeted     — targeted open shift invitation
  open_shift_filled       — shift you were notified about is now filled
  open_shift_waitlist_promoted — you've been auto-assigned from waitlist
  open_shift_no_replacement   — manager alert: no replacement found after cancellation
  open_shift_escalated    — new batch notification (escalation level N)
```

**Delivery channels (workspace-configured):**
- In-app notification bell (always)
- Email (if workspace has email notifications enabled)
- Push notification (if employee has enabled push in their profile)

---

## UI State Reference

### Coverage Grid Cell State Machine

```
INITIAL (rule exists, no assignments, no open request)
  → status: understaffed
  → color: rose
  → label: "{assigned}/{needed}"

PARTIALLY_FILLED (some but not all slots filled)
  → status: understaffed
  → color: amber
  → label: "{assigned}/{needed}"

BROADCAST_POSTED (open_shift_request with status='open')
  → status: broadcast
  → color: amber
  → label: "Meghirdett" (Hungarian: "Posted/Broadcast")
  → additional info: small icon indicating open request

FULLY_FILLED (all slots filled, no open request or request is 'filled')
  → status: ok
  → color: emerald
  → label: "{assigned}/{needed}" or member names

OVERFILLED (more assigned than min_headcount)
  → status: ok (still good)
  → color: emerald
  → label: "{assigned}/{needed}" (shows excess)
```

### OpenShiftManager Component Modes

| Mode | When | Shows |
|------|------|-------|
| `compact` | Inside coverage rule drawer | Condensed form; inline in drawer header |
| `full` | Inside no-rule cell drawer | Full form with all fields visible |

Both modes share the same underlying form state and call the same RPC on submit.

### Drawer Opening Logic (CoveragePlannerView)

```typescript
// Coverage rule cell clicked:
setDrawerCell({ office_id, rule_id, date })  // opens assignment drawer

// No-rule cell clicked:
setOpenShiftCell({ office_id, date })         // opens open-shift-only drawer

// Both drawers close when:
setDrawerCell(null)  // or
setOpenShiftCell(null)
// Only one can be open at a time (they are mutually exclusive state)
```
