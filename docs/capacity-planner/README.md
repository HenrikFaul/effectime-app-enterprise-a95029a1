# Capacity Planner — Overview

The Capacity Planner is the core staffing coordination surface inside Effectime Enterprise. It gives workspace managers and admins a single, structured view of every office's minimum headcount requirements for every day of the week or month, and provides the tools to fulfil those requirements — whether through direct assignment, drag-and-drop, AI-driven automatic suggestion, open-shift broadcast, or large-scale batch scheduling.

Without the Capacity Planner, managers have to mentally reconcile which office needs how many people of which role on which day, cross-reference who is on leave, who is already assigned elsewhere, and who has the right skills — all manually. The Capacity Planner automates that gap analysis continuously and puts assignment, suggestion, and broadcasting into a single click.

---

## What the Capacity Planner can do

- Display a colour-coded weekly or monthly coverage matrix for all offices simultaneously — one row per coverage rule per office, one column per day
- Show "need / have" numbers in every cell so the coverage gap is always visible at a glance
- Apply colour semantics automatically: rose = understaffed, emerald = exactly met, amber = overstaffed, gray = rule does not apply on this day
- Detect weekends (slightly grayed columns) and public holidays (blue-tinted columns) and display them distinctly
- Open a right-side slide drawer when a manager clicks any cell, showing the full assignment detail for that office, rule, and date
- Render slot rows inside the drawer — one row per required headcount position — so the manager can see exactly which role positions are filled and which are empty
- Indicate role-match quality per slot: green background when the assigned member's role matches the slot requirement; rose background when it does not
- Support direct assignment via a "+ Beoszt" button on any candidate card in the drawer
- Support drag-and-drop assignment: drag a candidate chip from the candidate list and drop it onto an empty slot drop zone
- Run an intelligent suggestion algorithm ("Intelligens javaslat") that automatically picks the optimal available member for each unfilled slot, using role match, office priority, monthly load balance, and eligibility score as tiebreakers
- Show draft assignments in a pending/yellow state before the manager accepts or rejects them
- Accept all pending drafts with a single green checkmark or reject all with a red X
- Show a green availability dot next to any candidate who has proactively self-marked as available for that date
- Display ineligibility issues per candidate (blocking: on leave, double-booked, blocked date; warning: wrong role, skill level low, over capacity) with severity-appropriate icons
- Post open-shift broadcasts (Megaphone) for any slot that cannot be filled from the known pool, sending targeted notifications to selected candidates or broadcasting to all role/skill-matching members
- Apply an escalation timeout so the system automatically re-notifies the next batch of candidates if no one accepts within the configured window
- Show existing open-shift broadcasts as amber "Meghirdett" badges in the grid so managers know which cells are already in active broadcast
- Show a "pending-notified" guard for candidates who have already been notified about the same slot and have not yet responded — these appear grayed out and cannot be re-notified until the timeout expires or they respond
- Switch between weekly view (7-column day grid) and monthly view (full calendar, worst-case coverage color per day)
- Navigate backward and forward through weeks or months with prev/next arrows
- Jump back to the current week or current month with a single "ezen a héten" / "ebben a hónapban" button
- Manage coverage rules inline through a collapsible "Kapacitásszabályok" panel (Settings2 icon) without leaving the Capacity Planner screen
- Create coverage rules with multi-slot role definitions (e.g., "2 BA + 1 HR" = three headcount slots with specific roles), skill requirements, skill level thresholds, day-of-week filters, and validity date ranges
- Archive and restore rules without losing their history
- Run the Smart Batch Scheduling wizard (Wand2 icon on the office name row) to generate a complete multi-day staffing plan for an entire office at once, then review and confirm in bulk
- Choose between three batch scheduling strategies: role-match-first, load-balanced, or site-priority-first
- Export the Capacity Planner as a read-only iframe embed for third-party CRM and portal integration (Embed SDK v1/v2)
- Grant write access to CRM operators via write-enabled embed tokens so they can assign and remove shifts directly from the embedded view without an Effectime login

---

## Version history (v3.40.0 – v3.46.0)

| Version | Date | Description |
|---------|------|-------------|
| v3.40.0 | 2026-05-17 | Structured Open Shifts — position FK, multi-skill, top-3 candidates, auto-escalation, waitlist |
| v3.41.0 | 2026-05-17 | Unified Employee Calendar with claim fix and upcoming-schedule panel |
| v3.41.1 | 2026-05-17 | Bug fixes: office-click crash in planner, availability toggle, batch-fill office selector |
| v3.41.2 | 2026-05-17 | Bug fixes: open-shift 409 conflict (duplicate RPC overloads), OfficeEditorDialog wider, assigned badge |
| v3.41.3 | 2026-05-17 | UX: free-text search in position picker catalog |
| v3.41.4 | 2026-05-17 | UI/UX Refactor: global overflow, responsive grid, table scroll fixes |
| v3.41.5 | 2026-05-17 | Backend QA: RLS index coverage sweep — 29 missing indexes added |
| v3.41.6 | 2026-05-17 | Fix: open-shift position selector now shows all workspace positions |
| v3.41.7 | 2026-05-18 | Fix: open-shift candidate list filtered strictly by position match |
| v3.42.0 | 2026-05-17 | DB: canonicalized `features.route_path` to workspace-scoped URL shape |
| v3.42.2 | 2026-05-18 | Premium UI/UX Refactor: design-system elevation pass across all enterprise components |
| v3.42.3 | 2026-05-18 | Fix: `create_open_shift_request` null `notified_user_ids` (error 23502) |
| v3.42.4 | 2026-05-18 | Feature: OpenShiftManager targeted-notify fix + EmployeeMonthView dual-mode edit |
| v3.42.5 | 2026-05-18 | Feature: pending-notification guard so already-notified candidates cannot be re-pinged |
| v3.42.6 | 2026-05-18 | Feature: OpenShiftPanel smart button states (Elfogad vs Igénylés vs Beosztva) |
| v3.42.7 | 2026-05-18 | Fix: compact OpenShiftManager now shows full form when opened from a coverage-rule day |
| v3.42.8 | 2026-05-18 | Feature: EmployeeMonthView day info popup + OpenShiftPanel assigned-day filter |
| v3.42.9 | 2026-05-18 | Feature: unified shift marketplace tab, past-shift filter, compact clock-in layout |
| v3.43.0 | 2026-05-18 | Feature: decline shift invitation + Intelligens javaslat in open-shift creation |
| v3.43.1 | 2026-05-18 | Refactor: Phase 1 nav restructure — Pozíciók, Csapatok, Készségek moved to Szervezet |
| v3.44.0 | 2026-05-18 | Feature: Embed SDK — iframe Capacity Planner for third-party CRM integration |
| v3.45.0 | 2026-05-18 | Feature: Embed SDK v2 — multi-view, customization URL params, snippet builder |
| v3.46.0 | 2026-05-18 | Feature: Embed write mode — CRM operators can assign and remove shifts from embedded views |

---

## Documentation navigation

| File | Audience | Contents |
|------|----------|----------|
| [README.md](README.md) (this file) | All | Overview, feature summary, version history, quick start |
| [user-guide.md](user-guide.md) | Workspace managers / admins | Step-by-step usage: navigation, reading the grid, assigning staff, intelligent suggestion, open-shift broadcast, monthly view, managing rules, Smart Batch Scheduling |
| [coverage-rules.md](coverage-rules.md) | Technical and advanced users | Database schema for coverage rules, field reference, backward-compatibility notes, slot-based assignment logic, rule application algorithm, shift-matching algorithm |

---

## Main screen — what it looks like

When you open the Capacity Planner (Calendar tab → Kapacitástervező sub-tab), you see three visual zones stacked vertically:

**Zone 1 — Kapacitásszabályok collapsible (top)**
A horizontal bar with a Settings2 icon and the text "Kapacitásszabályok". Clicking it expands the `OfficeCoverageRuleManager` inline panel where you create, edit, archive, and restore coverage rules without navigating away. A chevron rotates 180 degrees when expanded.

**Zone 2 — Toolbar**
A row of controls from left to right:
- Weekly / Monthly toggle (two segments, active segment has primary background)
- Left arrow (previous week/month)
- Date range label ("2026. máj. 11. — máj. 17." in weekly mode, "2026. május" in monthly mode)
- Right arrow (next week/month)
- "Ezen a héten" ghost button (returns to current period)

Below the toolbar is a legend bar showing four color chips:
- Rose chip: "Hiány" (understaffed)
- Emerald chip: "Megfelelő" (sufficient)
- Amber chip: "Többlet" (overstaffed)
- Gray chip: "N/A" (not applicable)
- A small green circle: "Elérhető" (member self-marked available)

**Zone 3 — Coverage matrix grid**
A scrollable grid with a sticky header row and an office/rule body. The leftmost column is 260 px wide and contains office names and rule labels. All remaining columns are day columns (80 px wide in weekly mode, 44 px in monthly mode).

Header row shows day abbreviations + date numbers. Weekend columns have a slightly gray background. Public holiday columns have a blue tint and blue text.

Each office occupies one or more rows. The first row of an office shows the office name (Building2 icon) and optionally the city in parentheses. If that office has coverage rules, a small violet Wand2 button appears to open the Smart Batch Scheduling wizard. Below the office name row, one row appears per coverage rule.

Each rule-row cell shows "N / H" (needed / have) in a large font, plus an icon below it:
- AlertTriangle icon = understaffed
- CheckCircle2 icon = exactly met (no icon when overstaffed)

Cells for days where the rule does not apply show nothing (gray background). Cells for days with no rule at all but with an open-shift broadcast show a Megaphone icon and "Meghirdett" text in amber. Cells for days with no rule and no broadcast but with existing assignments show a CheckCircle2 and assignment count in emerald.

Clicking any rule cell opens the assignment drawer on the right side.

---

## Quick start — get scheduling in 3 steps

**Step 1: Create at least one coverage rule**

Click the "Kapacitásszabályok" header to expand the rule manager. Click "+ Új szabály", select the office, choose one or more roles (e.g., "BA" × 2 + "HR" × 1), set minimum headcount, choose which days of the week apply, and click "Hozzáad". The grid immediately updates to show the demand.

**Step 2: Assign staff to understaffed cells**

Rose-colored cells are understaffed. Click any rose cell. The assignment drawer opens on the right. Click "Intelligens javaslat" to have the system auto-pick the best available members for each empty slot. Pending assignments appear in yellow. Click the green checkmark to confirm, or the red X to cancel. Alternatively, click "+ Beoszt" on any candidate card, or drag a candidate chip onto an empty slot drop zone.

**Step 3: Handle gaps with open-shift broadcast**

If no eligible assigned member is available, click the "Megaphone" button in the drawer header to open the broadcast form. Select the position, optionally add required skills, set a response timeout (default 3 hours), review the top-3 suggested candidates, check the ones you want to notify, and click "Kiválasztottak értesítése" for targeted notification or "Meghirdetés az összes megfelelőnek" for a full broadcast. The cell immediately shows an amber broadcast badge.
