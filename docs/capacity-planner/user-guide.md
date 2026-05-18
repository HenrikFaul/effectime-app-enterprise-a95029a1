# Capacity Planner — End-User Guide

This guide is written for workspace managers and administrators who are responsible for ensuring offices are adequately staffed each day. It covers every feature of the Capacity Planner from navigating to it for the first time through managing complex multi-role coverage rules, running intelligent batch scheduling, and broadcasting open shifts to the team.

---

## Section 1: Navigation

### Reaching the Capacity Planner

The Capacity Planner is accessed through the main workspace navigation:

1. Open your workspace. You land on the workspace dashboard at `/w/<workspaceId>`.
2. Click the **Naptár** (Calendar) tab in the main tab bar at the top of the screen.
3. Inside the Calendar area, a sub-tab bar appears below the main tab bar. Click **Kapacitástervező**.

The full path in the URL is `/w/<workspaceId>?tab=calendar&sub=coverage` (the exact search-parameter values are managed internally by the router).

When you land on Kapacitástervező for the first time in a workspace that has no offices, you will see an empty-state message in Hungarian: "Nincs még iroda hozzáadva. Hozz létre irodát a Szervezet fülön." This tells you to create an office first. Once at least one office exists and at least one coverage rule is attached to it, the coverage matrix grid appears.

### Header controls

The toolbar immediately below the sub-tab bar gives you date-navigation controls:

| Control | Description |
|---------|-------------|
| **Heti / Havi** toggle | Switches between weekly view (7 day columns) and monthly view (full calendar grid). The active mode has a primary-coloured background; the inactive one is white/outline. |
| **Left arrow (ChevronLeft)** | Goes back one week (weekly mode) or one month (monthly mode). |
| **Date range label** | Shows the current period. In weekly mode: "2026. máj. 11. — máj. 17.". In monthly mode: "2026. május". The month name is capitalized. |
| **Right arrow (ChevronRight)** | Goes forward one week or one month. |
| **"Ezen a héten" / "Ebben a hónapban"** ghost button | Jumps immediately back to the period that contains today's date. |

Navigation does not reload the page — the grid reloads its data when the date range changes, but the drawer state, rule manager state, and any pending draft assignments are preserved unless you explicitly navigate to a different period while a drawer is open (in which case the drawer closes and drafts are discarded).

---

## Section 2: Reading the Grid

### Row structure

The coverage matrix is a grid where:

- The **leftmost column** is 260 px wide and contains labels (office names and rule names).
- Each **remaining column** represents one calendar day in the current view period.

For each office, the grid renders one or more rows grouped together:

**Office name row**: Contains the Building2 icon, the office name in bold, and optionally the city name in parentheses in small muted text. If the office has at least one active coverage rule, a violet Wand2 button appears at the right end of the office name cell — this opens the Smart Batch Scheduling wizard (see Section 8). The day cells in the office name row are not clickable on their own; they are part of the visual grouping.

**Rule rows**: One row per active coverage rule that belongs to this office. The label cell shows the rule name (if one was given) or a generated label showing the required roles/skills (e.g., "BA, HR" or "—"). The day cells in a rule row are clickable and show the coverage status for that rule on that day.

If an office has no coverage rules, the day cells still appear but show the open-shift state for that office and date rather than a coverage-rule status (see the open-shift behavior described below).

### Color legend

Every rule-row cell is color-coded according to the current coverage ratio for that rule and day:

| Color | Meaning | When it appears |
|-------|---------|-----------------|
| **Rose / red tint** (`bg-rose-50`) | Understaffed | The number of assigned shifts matching this rule is less than `min_headcount` |
| **Emerald / green tint** (`bg-emerald-50`) | Sufficient — minimum exactly met | Assigned count equals `min_headcount` |
| **Amber / yellow tint** (`bg-amber-50`) | Overstaffed — more than minimum assigned | Assigned count exceeds `min_headcount` |
| **Gray** (`bg-zinc-50`) | Not applicable | The rule's `days_of_week`, `valid_from`, `valid_until`, or `rule_date` constraints mean this rule does not apply on this particular day |

The color also applies to the text inside the cell and the cell's left border, so the status is immediately readable even in low contrast situations.

For cells that belong to days with no coverage rule (e.g., a weekend day in an office whose rules only apply Mon–Fri), the cell color is controlled by the open-shift state:

| Cell state | Color |
|-----------|-------|
| No rule, no open shift, no assignments | Neutral gray |
| No rule, open-shift broadcast active | Amber background |
| No rule, assignments exist (no broadcast) | Emerald background |

### Cell content

Each applicable rule-row cell shows two pieces of information:

**"N / H" numbers** — displayed in a larger font (e.g., `text-sm` class). N is the `min_headcount` required by the rule. H is the number of shift assignments that currently match the rule on this day (same office, same date, role or skill matching at least one of the rule's requirements).

Examples:
- `2 / 0` — two people needed, nobody assigned yet (rose cell)
- `2 / 2` — two people needed, two assigned (emerald cell)
- `2 / 3` — two people needed, three assigned (amber cell)
- `1 / 1` — one person needed, one assigned (emerald cell)

**Status icon** — shown below the N/H numbers:

| Icon | Meaning |
|------|---------|
| `AlertTriangle` (triangle with !) | Understaffed — at least one more person needed |
| `CheckCircle2` (circle with checkmark) | Minimum exactly met |
| _(no icon)_ | Overstaffed |

For open-shift cells (no rule, has broadcast):
- `Megaphone` icon with "Meghirdett" text in amber — broadcast is active
- `CheckCircle2` with the count number in emerald — shifts filled without a rule

### Weekend columns

Days that fall on Saturday or Sunday receive the class `bg-zinc-50 dark:bg-zinc-900/30` and `text-muted-foreground` on the column header. The effect is a visually lighter background compared to weekday columns. Rule cells in weekend columns follow their normal color rules, but because most office coverage rules exclude weekends (by setting `days_of_week: [1,2,3,4,5]`), most weekend cells show as gray/not-applicable.

### Holiday columns

Days that match a date in the workspace's `enterprise_holidays` table receive:

- Header cell background: `bg-blue-50 dark:bg-blue-950/30`
- Header text color: `text-blue-700 dark:text-blue-300`

This blue tint is applied only to the header cell (day name + date number). The rule-row cells below it are not automatically tinted — they still show their normal coverage color. The holiday indicator is purely informational; it does not prevent scheduling. A public-holiday warning ("Public holiday — scheduling is informational only.") appears in the candidate list inside the assignment drawer, with a –5 score deduction for candidates.

### Open shift cells (no coverage rule)

When the grid cell corresponds to an office and date where no active coverage rule applies (the `rulesByOffice` map returns no matching rule for that day), the cell is rendered as a clickable button that opens a simplified open-shift sheet rather than the full assignment drawer. The behavior is:

- If there is an active open-shift broadcast for this office and date: amber background, Megaphone icon, "Meghirdett" label.
- If there are existing shift assignments (no broadcast): emerald background, CheckCircle2 icon, count number.
- Otherwise: neutral gray, hover triggers darker gray.

Clicking an open-shift cell opens a right-side sheet that shows existing assignments for that office and date (with role labels) and embeds the full `OpenShiftManager` broadcast form for posting new open shifts.

---

## Section 3: Assigning Staff — Step by Step

### Step 1: Click an understaffed cell

Click any rose-colored cell (understaffed) or any rule-row cell of any coverage status. The cell triggers an `onClick` that sets the `drawerCell` state to the clicked office, rule, and date.

### Step 2: The assignment drawer opens

A slide-in panel (Sheet) appears from the right side of the screen. The Sheet header contains:

- **Office name** as the main title (large bold text, e.g., "Budapest HQ")
- **Rule label** as the subtitle — either the rule's `name` field if one was given, or the system-generated label "Kapacitásszabály" as fallback
- **Date line** — formatted as "2026. május 14. (csütörtök)" with the weekday in parentheses, and the minimum headcount (e.g., "szükséges: 2 fő")
- **Compact OpenShiftManager** in the top-right corner of the header — a small Megaphone button or amber badge for broadcasting an open shift from within the drawer without switching views

### Step 3: Read the slot rows

Below the header, the drawer shows a section titled "Beosztva" (Assigned) with one row per required headcount slot. The number of slot rows equals `min_headcount` (or the number of expanded role entries in `business_roles[]` if that array is longer).

**Empty slot row**: Rendered as a dashed-border drop zone. The left side shows the role label for this slot (e.g., "BA", "HR", or "Bármilyen pozíció" if untyped). The right side shows "Húzd ide" (drag here) hint text. Empty slots accept drag-and-drop from the candidate list below.

**Filled slot row**: Shows the assigned member's display name and the role label for this slot. The background color indicates role match quality:
- **Emerald background** — the member's actual role (`business_role`) matches the slot's required role exactly
- **Rose background** — the member's actual role does not match (they were assigned anyway — perhaps as a fallback or manual override). A small note appears: "Tényleges pozíció: {role}" showing what role they actually hold.
- A Trash2 (delete) icon button on the right — click to unassign this member

**Draft slot row** (pending suggestion): Shows the same visual as a filled row but in a yellow/pending state. Draft rows are created by the Intelligens javaslat system and must be confirmed before they are saved to the database.

**Overflow section**: If more members are assigned than there are defined slots (e.g., you manually assigned a third person to a 2-slot rule), overflow assignments appear below the slot list in an amber-tinted section labeled "Extra (slot felett)" (Extra, above slots). Each overflow row shows the member's name and a Trash2 unassign button.

### Step 4: Choose how to assign

There are two methods:

#### Method A: Click "+ Beoszt" on a candidate card

In the section below the slot rows (titled "Elérhető jelöltek" / Available candidates), each candidate appears as a card showing:

- Display name (draggable, with cursor-grab style)
- A small green dot if this member self-marked available for the selected date
- A "score N" badge showing the eligibility match score (higher = better)
- Ineligibility issues listed below the name, with an X icon for blocking issues (rose text) and AlertTriangle for warnings (amber text)
- A "+ Beoszt" (Assign) button — enabled (primary style) for eligible candidates, outline style for ineligible ones

Clicking "+ Beoszt" immediately saves the shift assignment to the database (`enterprise_shift_assignments` insert), shows a success toast "X beosztva (YYYY-MM-DD)", and refreshes the grid and drawer data.

Ineligible candidates (those with at least one blocking issue) still appear in the list so the manager can make an informed override, but their assign button is styled as outline to signal the issue. Common blocking issues:
- `ON_LEAVE` — member has approved leave that day
- `DOUBLE_BOOKED` — member is already assigned to a different office on the same day
- `BLOCKED` — the date is in the workspace's blocked-dates list

#### Method B: Drag a candidate chip onto an empty slot drop zone

Each candidate card is `draggable`. Drag it from the candidate list and drop it onto any empty slot drop zone (the dashed-border row in the Beosztva section). On a valid drop, the assignment is saved immediately, identical to clicking "+ Beoszt".

Drag-and-drop is also possible between the candidate chip and the general content area of the drawer — anywhere that fires the `onDropToAssigned` handler.

### Step 5: Confirm and check the result

After a successful assignment via either method:
- A Sonner toast appears: "X beosztva (YYYY-MM-DD)"
- The grid refreshes — the rose/amber cell updates to reflect the new supply count
- The drawer content refreshes — the new assignment appears as a filled slot row

If the assignment brings the supply up to or above `min_headcount`, the cell changes from rose to emerald or amber.

### Unassigning a member

Click the Trash2 icon on any filled slot row (both confirmed assignments and overflow assignments have this button). This deletes the row from `enterprise_shift_assignments` and refreshes the drawer and grid. A toast "Beosztás törölve" confirms the deletion.

---

## Section 4: Intelligent Suggestion

### Accessing it

Inside the assignment drawer, below the slot rows, a button labelled **"Intelligens javaslat"** appears with an emerald green background. Clicking it triggers the automatic suggestion algorithm.

If the minimum headcount for this rule and date is already met or exceeded (supply >= demand), the system does not generate suggestions and instead shows a toast message: "A minimum szükséglet már teljesítve van." The button still appears to let managers see this confirmation.

### What the algorithm does

The suggestion algorithm fills only the unfilled slots — it does not touch already-confirmed assignments. It considers the following factors in order of priority:

**Step 1 — Build the available pool**

The pool consists of all workspace members who:
1. Are not already assigned to this slot (not in `unavailableUserIds` which combines confirmed assignments + current draft assignments)
2. Pass the site-priority filter: if any `enterprise_member_site_priorities` records exist for this workspace, only members who have a priority entry for this specific office are included. If no site priority records exist anywhere in the workspace, all members are eligible (legacy behavior).

**Step 2 — Score each candidate**

Scoring is done by `rankCandidates()` / `evaluateEligibility()` in `src/lib/coverageEligibility.ts`. The base score is 100. Adjustments:

| Condition | Score change |
|-----------|-------------|
| Public holiday (informational only) | −5 |
| On approved leave | Blocking (not eligible) |
| Pending leave request | −30 |
| Role matches requirement | +50 |
| Role does not match | −40 |
| Skill matches and level sufficient | +30 to +55 (more bonus for higher level above minimum) |
| Skill level below requirement | −20 |
| Missing required skill (no role match) | Blocking (not eligible) |
| Already assigned at a different office this day | Blocking (not eligible) |
| Member self-marked available (`enterprise_staff_availability`) | +20 |
| Projected weekly hours exceeds capacity | −10 (warning, not blocking) |

**Step 3 — Sort the eligible pool per slot**

For each unfilled slot (in order of slot index), the algorithm sorts the eligible available pool by:

1. **Role match for this specific slot**: members whose `business_role` exactly matches the slot's required role sort first (sort key = 0), all others sort second (sort key = 1).
2. **Office priority** (tie): lower `priority` number from `enterprise_member_site_priorities` sorts earlier. Members without a priority entry get sort key 99.
3. **Monthly shift load** (tie): members with fewer total shifts in the same calendar month as the target date sort earlier. This distributes work more evenly.
4. **Eligibility match score** (tie): higher `matchScore` sorts earlier.

**Step 4 — Pick and mark as draft**

The top-ranked candidate for each slot is selected. Once selected, that member's `user_id` is added to the `usedIds` set so they cannot be picked for a second slot in the same suggestion run (no double-assignment within the same suggestion).

A `DraftAssignment` object is created for each pick, storing the member, the target role, and whether it was a role match.

### Reviewing draft assignments

After the algorithm runs, each selected member appears as a **draft slot row** in the Beosztva section. Draft rows look identical to confirmed assignment rows but have not been written to the database yet.

Two action buttons appear below the slot list:

- **Red X (circle button)**: Discard all drafts — clears `draftAssignments` state and resets `pendingSuggestion` flag. The drawer returns to its previous state with only confirmed assignments.
- **Green CheckCircle2 (circle button)**: Confirm all drafts — calls `persistDraftAssignments()`, which inserts all draft assignments into `enterprise_shift_assignments` in a single batch insert. On success, a toast "Beosztás mentve" appears and the grid/drawer refresh.

If no eligible member can be found for any slot, a toast error appears: "Nincs elérhető jelölt." In this case, no drafts are created and the manager should consider using the Open Shift Broadcast (Section 5).

### Important behavioral notes

- The suggestion only fills slots that have no confirmed assignment. If 1 of 3 slots is already filled, the algorithm fills the remaining 2.
- Drafts are discarded automatically when you close the drawer (Sheet `onOpenChange` resets `draftAssignments`).
- Drafts are also discarded when you navigate to a different cell (the `useEffect` watching `drawerCell` resets the draft state).
- You can mix manual assignment (clicking "+ Beoszt") and then running Intelligens javaslat for remaining slots — the algorithm will skip already-assigned members.

---

## Section 5: Open Shift Broadcast

### When to use it

Use the Open Shift Broadcast when:
- No eligible member from the known assigned pool is available for a slot
- You want to invite volunteers rather than directly assigning someone
- You need to reach members who might not appear in the standard candidate list (perhaps because their office affiliation is different but they are willing to work at this location)
- A confirmed assigned member has cancelled their assignment and you need a replacement quickly

### Opening the broadcast form

**From inside the assignment drawer (compact mode)**: In the drawer header, there is a small compact `OpenShiftManager` widget. If no broadcast exists yet, it shows as a "Meghirdeti" (Megaphone) button with the label "Nyitott műszak meghirdetése". If a broadcast already exists, it shows as an amber badge with the Megaphone icon and a count (e.g., "2×"). Clicking either state opens the compact broadcast form inline inside the drawer header area.

**From an open-shift cell (no-rule cell, full mode)**: Clicking a cell that has no coverage rule opens a separate right-side sheet. This sheet shows any existing assignments for the office/date and embeds the full `OpenShiftManager` form (not compact).

### The broadcast form — compact mode fields

The compact form appears as a panel with a muted background. It shows any existing open-shift broadcasts for this exact office/date at the top (each with an X cancel button). Below that, the new-broadcast form has:

**Existing broadcasts list** — each active broadcast shows the role name (or "Bármilyen pozíció" if no role set) and an X button to cancel/close the broadcast.

**Position selector** — a dropdown pre-populated from the workspace's role catalog (`enterprise_workspace_roles` + `enterprise_memberships.business_role` union). The value is pre-set to the coverage rule's role if the drawer was opened from a rule cell. You can override it to post for a different role.

**Skill selector** — a dropdown listing all workspace skills (`enterprise_skills`). Available only when skills are defined in the workspace. Used to specify required skill(s) for the open shift beyond the role filter.

**Timeout (hours)** — a number input, minimum 1, maximum 72, default 3. After this many hours, the system's `process_open_shift_escalations()` pg_cron job sends the next batch of 5 notifications to candidates who have not yet responded. Set a shorter timeout (1–2 hours) for urgent gaps; use the default 3 for planned staffing.

**Notes textarea** — free text that appears in the push notification and in the employee's shift marketplace panel. Useful for indicating urgency or special requirements.

### Top-3 candidates shortlist

Below the form fields, the panel shows the top-3 eligible candidates from `useShiftCandidates`, which runs the same `rankCandidates()` engine used by the Intelligens javaslat button (see Section 4 for scoring details).

Each candidate card shows:
- Display name
- Business role (muted, small text)
- `CheckCircle2` (green) for fully eligible candidates
- `AlertTriangle` (amber) for candidates with warning-level issues
- A checkbox to select them for targeted notification

**Pending-notified guard**: If the same workspace/office/date/role has an existing open-shift broadcast that is still within its response window (`respond_by_at > now()`), candidates who have already been notified and have not yet responded appear as greyed-out rows with a dashed border and a "Folyamatban" badge with a Clock icon. These candidates cannot be re-targeted until the timeout expires or they respond.

**Intelligens javaslat button** (emerald, Sparkles icon): Appears in the candidates section header if at least one eligible non-pending candidate exists. Clicking it auto-selects the highest-ranked candidate's checkbox. This is the one-click "suggest best" shortcut for the broadcast flow.

### Two send options

**"Kiválasztottak értesítése (N)"** — violet button, appears only when at least one candidate checkbox is checked. Sends a targeted push notification only to the checked candidates. The `notified_user_ids` and `target_user_ids` arrays on the `enterprise_open_shift_requests` row are set to these specific user IDs. Employees who receive a targeted notification see an "Elfogad" (Accept) button instead of the generic "Igénylés" (Claim) button in their shift marketplace panel.

**"Meghirdetés az összes megfelelőnek"** — default primary button. Sends the broadcast to all role/skill-matching workspace members. The system's `create_open_shift_request` RPC filters the notification list server-side to members whose `business_role` matches the specified role (or all members if no role is set).

### After posting

- A success toast appears: "Nyitott műszak meghirdetve" (broadcast sent) or "X jelölt értesítve" (X candidates notified)
- The form closes (compact mode: the panel collapses back to the Megaphone button/badge)
- The grid cell (if it was a no-rule cell) updates to show the amber broadcast badge with the Megaphone icon
- On the employee side, the shift appears in the **Nyitott műszakok** tab of their Shift Marketplace panel
- If a targeted invitation was sent, the employee sees a personal "Elfogad / Elutasítás" choice

### Cancelling a broadcast

Click the X button on any existing broadcast row inside the compact panel. This calls `cancel.mutateAsync(id)` which updates the `enterprise_open_shift_requests` status. If the broadcast has already been filled (`status = 'filled'`), the cancel RPC returns a "not_open" error and the toast shows "A műszak már be van töltve."

---

## Section 6: Monthly View

### Switching to monthly mode

Click the **"Havi"** button in the Weekly/Monthly toggle in the toolbar. The grid immediately switches from a 7-column weekly view to a full calendar grid. The date-range label updates to show just the month and year (e.g., "2026. május"). The prev/next arrows and the "Ebben a hónapban" button operate on calendar months.

### Grid structure in monthly mode

In monthly mode, the column count matches the number of days in the month (28 to 31 columns). Column headers show just the day number (1–31) and below it the single-letter weekday abbreviation (e.g., "H" for Monday in Hungarian locale). Cell minimum width drops to 44 px in monthly mode to fit all days on screen, so the grid becomes denser.

### Color per cell in monthly mode

The color coding in monthly mode works differently from weekly mode. Instead of showing the coverage ratio for a single rule, monthly-mode cells show the **worst-case coverage status across all applicable rules for that day**. The logic:

- If at least one rule for this office/day is understaffed → the cell is **rose** (red)
- If all rules are met or there are no applicable rules but some overstaffing → the cell is **emerald** or **amber**
- If no rule applies → gray/not-applicable

This "worst-case wins" approach means a single understaffed rule makes the entire day's cell red, giving managers a quick month-at-a-glance view of problem days without needing to inspect individual rules.

### Clicking cells in monthly mode

Clicking a rule-row cell in monthly mode opens the same assignment drawer as in weekly mode — the drawer behavior is identical. The date sent to the drawer is the date of the clicked column. This means you can directly click a red day on the monthly calendar and immediately go to the assignment panel for that day.

For open-shift cells (no applicable rule), the same open-shift sheet opens as in weekly mode.

### Navigating months

- **Previous month**: Click the left ChevronLeft arrow. Sets `month` state to `subMonths(month, 1)`.
- **Next month**: Click the right ChevronRight arrow. Sets `month` state to `addMonths(month, 1)`.
- **Return to current month**: Click "Ebben a hónapban". Sets `month` state to `startOfMonth(new Date())`.

Data reloads on every month change — the system fetches all shift assignments, rules, holidays, blocked dates, leaves, and availability records for the new month's date range.

---

## Section 7: Managing Coverage Rules

### Opening the rule manager

At the very top of the Capacity Planner screen (above the toolbar), there is a collapsible header row labelled **"Kapacitásszabályok"** with a Settings2 icon on the left and a ChevronDown icon on the right. Click anywhere on this row to expand or collapse the `OfficeCoverageRuleManager` panel. The ChevronDown icon rotates 180 degrees when the panel is open.

### The rule list

When expanded, the panel shows two tabs:

- **"Aktív"** (Active) — rules with `status = 'active'`
- **"Archivált"** (Archived) — rules with `status = 'archived'` or `status = 'expired'`

Each rule in the list appears as a horizontal card showing:
- The rule name badge (if a name was given)
- The office name badge
- Role badges (one per distinct role in the expanded `business_roles[]` array)
- Skill badges (with optional skill-level suffix, e.g., "SQL (≥3)")
- Headcount label ("min. 2 fő")
- Days of week (abbreviated, e.g., "H, K, Sze, Cs, P" for Mon–Fri)
- Date range (valid_from – valid_until, with an "∞" symbol if no end date)
- An expiring-soon warning "⚠" in amber text if `valid_until` is within 7 days
- An "Archivált" badge for archived rules
- Action buttons on the right: Pencil (edit), Archive (archivize active rule), or ArchiveRestore (restore archived rule), and Trash2 (permanent delete)

### Creating a new rule

Click **"+ Új szabály"** (New rule) button. A dialog opens with the following fields:

**Name** (optional) — a free-text label for humans (e.g., "Budapest HQ — éjszakai minimumszükséglet"). If left empty, the grid renders a generated label from the roles/skills. Maximum 100 characters.

**Office** — a required dropdown of all offices in the workspace. The rule applies only to shifts at this office.

**Minimum headcount** — a required number input (minimum 1). If you select roles with per-role counts (see below), this field is calculated automatically from the sum of role counts and becomes read-only.

**Pozíciók (Positions)** — a scrollable list of all distinct `business_role` values from the workspace's memberships and role-allocation records. Check one or more positions. When a position is checked, a small number input (default 1) appears to its right so you can specify how many people of that role are needed. Examples:
- Check "BA" with count 2 and "HR" with count 1 → `min_headcount` is automatically set to 3, `business_roles = ['BA','BA','HR']`
- Check "BA" with count 1 → `min_headcount = 1`, `business_roles = ['BA']`

If you need a general headcount rule with no specific role (any role counts), leave all positions unchecked and set the minimum headcount manually.

**Készségek (Skills)** — appears only if any skills exist in the workspace. A scrollable list of skills. Check one or more required skills (OR logic — having any one of the checked skills satisfies the requirement). If skills are selected, a **minimum skill level** input appears (range 1–5, where 1 = beginner and 5 = expert). Only members with the skill at or above this level pass the eligibility check for skill matching.

**Napok (Days of week)** — a grid of 7 checkboxes, one per day. The order is Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (ISO weekday order). Leave all unchecked to apply the rule every day of the week. Check Mon–Fri only (weekdays) to skip weekends. The rule's `days_of_week` field stores the selected day numbers using JavaScript's `Date.getDay()` convention: Sunday = 0, Monday = 1, ..., Saturday = 6.

**Érvényes ettől** (Valid from) — date input. If set, the rule does not apply to dates before this date. Leave empty for no start-date restriction.

**Érvényes eddig** (Valid until) — date input. If set, the rule does not apply to dates after this date. Rules approaching their valid_until date display an expiring-soon warning. Leave empty for no end-date restriction ("∞").

**Megjegyzés** (Notes) — optional free-text note (e.g., "Seasonal rule, review in September"). Stored but not displayed in the grid.

### Validation

On save, the system validates:
- An office must be selected.
- At least one position or skill must be selected (a rule with neither is too broad to be useful).
- If both `valid_from` and `valid_until` are set, `valid_until` must be ≥ `valid_from`.
- Headcount must be ≥ 1.

### Editing an existing rule

Click the Pencil icon on any active rule row. The same dialog opens pre-filled with all the rule's current values. Change any field and click "Mentés" to update. Changes take effect immediately in the grid.

### Archiving vs. deleting

**Archive** (Archive icon): The rule's `status` is set to `'archived'` and `archived_at` is recorded. Archived rules do not appear in the Aktív list and have no effect on the coverage grid. They remain in the database for audit/history purposes. You can restore an archived rule by clicking the ArchiveRestore icon on its row in the Archivált tab.

**Permanent delete** (Trash2 icon): Shows a browser confirmation dialog. If confirmed, the rule is deleted from `enterprise_office_coverage_rules` permanently. This action cannot be undone. Use archiving rather than deletion if you might want to reactivate the rule later.

### Rules take effect immediately

When you save a new rule or restore an archived one, the Capacity Planner grid refreshes automatically (the `load()` function is called after every mutation). The new demand is reflected in the grid within seconds — understaffed cells appear in rose, and the manager can begin assigning right away.

---

## Section 8: Smart Batch Scheduling Wizard

### When to use it

The Smart Batch Scheduling wizard is designed for scheduling an entire office's staffing for a multi-day period at once — for example, filling all slots for the next two weeks, or scheduling the first week of the month. It is most effective when:
- You have a full roster of available members and want to distribute shifts fairly
- You are planning ahead and want to avoid scheduling conflicts by batch-computing the optimal assignment
- Individual slot-by-slot assignment would be tedious for many days

### Opening the wizard

On the office name row in the grid, if that office has at least one active coverage rule, a small **violet Wand2 button** appears at the right end of the office name cell. The button has a gradient background (violet → fuchsia) and a hover animation (slight scale-up + glow). Click it to open the Smart Batch Scheduling wizard dialog for that office.

The wizard title shows "Intelligens tömeges beosztás" with a Sparkles icon, and the subtitle shows the office name and city.

### Dialog fields

**Időszak kezdete / vége** (Period start / end) — two date inputs. Pre-populated with the first and last day of the currently visible week (weekly mode) or first and last day of the month (monthly mode). Adjust to any multi-day range you want to schedule.

**Stratégia** (Strategy) — a dropdown with three options:

| Strategy key | Label | Behavior |
|---|---|---|
| `role_match_first` | "Pozíció elsőbbsége" | Candidates whose role matches the slot role sort first; office priority is the tiebreaker, then monthly load |
| `priority_first` | "Telephely-prioritás elsőbbsége" | Candidates with the lowest `enterprise_member_site_priorities.priority` number sort first; role match is the secondary tiebreaker |
| `load_balanced` | "Terheléselosztás" | Candidates with the fewest shifts already planned in the same month sort first; role match and priority are secondary |

**Options**:
- **"Meglévő beosztások megtartása"** (Keep existing shifts) — checkbox, default checked. When checked, the wizard counts existing confirmed shifts toward the demand and only fills the remaining gap. When unchecked, the wizard ignores existing shifts and generates a fresh plan that may duplicate existing assignments.
- **"Bármilyen pozícióból töltse fel"** (Fill from any position) — checkbox, default unchecked. When checked and no site-priority-matching candidate can be found for a slot, the algorithm falls back to any eligible workspace member regardless of site priority. Useful when the office pool is too small. When unchecked, the algorithm only considers members who have a site-priority entry for this office.

**Szabályok** (Rules) — a scrollable list of all coverage rules for this office. By default, all rules are checked (pre-selected). Uncheck any rule to exclude it from the plan. A "Mindet / Egyet sem" toggle link above the list selects/deselects all at once.

### Generating the plan

Click **"Terv generálása"** (Generate plan) with the Sparkles icon. The button shows a spinning Loader2 while the algorithm runs. The wizard processes each day × rule × slot combination:

1. For each day in the date range, for each selected rule, if the rule applies on that day:
   - Calculate existing supply (if "keep existing" is checked, subtract confirmed assignments from the needed count)
   - For each remaining unfilled slot, determine the required slot role
   - Score and rank eligible members, applying the chosen strategy's sort order
   - Pick the top candidate who has not already been planned for any other shift on the same day
   - Add to the `out` plan array

2. After processing all days, display a summary toast: "N beosztás generálva" (N assignments generated), or "Nincs javaslat" (No suggestion) if all slots were already filled or no eligible candidate was found.

### Reviewing the generated plan

If the plan has assignments, a preview panel appears below the generate button showing:

- A summary badge row:
  - Emerald badge: "N egyező" (N role-matched assignments) with CheckCircle2 icon
  - Amber badge: "N nem egyező" (N role-mismatched assignments, i.e., best-available fallback) with AlertTriangle icon
  - Users badge: "N kolléga" (N distinct members scheduled)
- A scrollable list of assignments grouped by day. Each day shows its date header and below it one row per assignment. Each row shows:
  - Member display name
  - Role badge (the role the system assigned them)
  - Rule name (the coverage rule this slot belongs to)
  - Green background (emerald) for matched assignments
  - Amber background for mismatched assignments (the member's actual role differs from the required slot role)

### Confirming the plan

Click **"Beosztás rögzítése (N)"** (Finalize, N assignments) in the dialog footer. The button shows the count of planned assignments. On click, the wizard:
1. Constructs the full insert payload (one row per assignment: workspace_id, membership_id, user_id, office_id, business_role, skill_id, shift_date, created_by).
2. Chunks the payload into batches of 200 rows and inserts each batch via `enterprise_shift_assignments` insert.
3. Shows a success toast "N beosztás rögzítve" on completion.
4. Calls `onCompleted()` to trigger a full data reload in the Capacity Planner.
5. Closes the dialog.

If any chunk fails (e.g., a database constraint violation), a partial-failure toast appears indicating which chunk failed and the error message. Successfully inserted chunks are retained; only the failing chunk and subsequent chunks are aborted.

### Cancelling the wizard

Click "Mégsem" (Cancel) in the footer at any time. The dialog closes without saving anything. No data is modified. You can reopen the wizard by clicking the Wand2 button again.
