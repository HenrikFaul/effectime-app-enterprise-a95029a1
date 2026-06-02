# Design System Audit — v3.43.0

**Date:** 2026-06-02
**Auditor lens:** Senior Design System Lead + Senior UI/UX Designer + Senior Accessibility Specialist
**Source role files:** `senior_design_system_lead.md`, `senior_ui_ux_designer.md`, `senior_accessibility_specialist.md`

---

## 1. Token foundation status

| Token family | Status | Notes |
|---|---|---|
| `--background` / `--foreground` | OK | light + dark parity |
| `--primary` + `--primary-glow` + `--primary-foreground` | OK | teal 172° |
| `--secondary` | OK | |
| `--accent` | OK | violet 262° |
| `--destructive` + `-foreground` | OK | |
| `--success` + `-foreground` | OK | green 152° |
| `--warning` + `-foreground` | OK | amber 38° |
| `--info` + `-foreground` | **ADDED v3.43.0** | sky 210° — fills the gap that forced `bg-blue-*` usage |
| `--muted` + `-foreground` | OK | |
| `--card` + `-foreground` / `--popover` + `-foreground` | OK | |
| `--vote-good/maybe/bad` | OK | committee voting domain |
| `--sidebar-*` family (8 tokens) | OK | dedicated sidebar palette |
| `--border` / `--input` / `--ring` | OK | |
| `--radius` (0.875rem) + scaled variants | OK | |
| `--shadow-card/elevated/modal/glow/premium/subtle` | OK | 6 elevation tiers |
| `--gradient-primary/accent/hero/surface` | OK | |
| `--font-display` (Space Grotesk) / `--font-body` (DM Sans) | OK | |

**Verdict:** Token taxonomy is mature. Only structural gap (info/sky) closed in this PR.

---

## 2. Hardcoded color inventory (state baseline)

Total: **648 occurrences across 86 files** (`src/`).

### Top offenders (≥10 hits)

| File | Hits | Lens |
|---|---|---|
| `enterprise/agile/GiGanttIcBoard.tsx` | 88 | flagship branded board — high visual weight |
| `pages/Auth.tsx` | 75 | first-impression surface, must convert first |
| `enterprise/time-attendance/EmployeeMonthView.tsx` | 31 | daily-use grid |
| `enterprise/agile/BacklogInsights.tsx` | 26 | insight panel |
| `enterprise/calendar/CoveragePlannerView.tsx` | 24 | scheduling |
| `enterprise/LeaveCalendar.tsx` | 23 | core calendar |
| `superadmin/SuperadminControlPlane.tsx` | 18 | admin |
| `embed/EmbedCapacityView.tsx` | 17 | embed |
| `superadmin/FeatureTiersTab.tsx` | 15 | admin |
| `enterprise/wellbeing/WellbeingDashboard.tsx` | 15 | dashboard |
| `enterprise/agile/BacklogFilterBuilder.tsx` | 15 | builder |
| `enterprise/calendar/OpenShiftManager.tsx` | 14 | scheduling |
| `enterprise/analytics/AnalyticsDashboard.tsx` | 13 | dashboard |
| `enterprise/workflows/HRWorkflowTemplates.tsx` | 12 | workflows |
| `enterprise/calendar/TimelineView.tsx` | 12 | scheduling |
| `enterprise/wellbeing/WellbeingScoreCard.tsx` | 11 | card |
| `wellbeing/WellbeingRecalculateCard.tsx` | 10 | card |
| `analytics/PredictiveAnalyticsPanel.tsx` | 10 | panel |

### Replacement matrix

| Hardcoded class | Canonical semantic token | Notes |
|---|---|---|
| `bg-white` / `text-white` | `bg-background` / `text-foreground` OR `bg-primary text-primary-foreground` | depends on context |
| `bg-gray-50/100/200` | `bg-muted` | |
| `text-gray-400/500/600` | `text-muted-foreground` | |
| `text-gray-700/800/900` | `text-foreground` | |
| `border-gray-200/300` | `border-border` | |
| `bg-green-50` / `text-green-700` / `border-green-200` | `bg-success/10` / `text-success` / `border-success/30` | success state |
| `bg-red-50` / `text-red-600` / `border-red-200` | `bg-destructive/10` / `text-destructive` / `border-destructive/30` | error state |
| `bg-amber-50` / `text-amber-700` / `border-amber-200` | `bg-warning/10` / `text-warning` / `border-warning/30` | warning state |
| `bg-yellow-50` / `text-yellow-700` | `bg-warning/10` / `text-warning` | warning state |
| `bg-blue-50` / `text-blue-700` / `border-blue-200` | `bg-info/10` / `text-info` / `border-info/30` | **enabled by v3.43.0** |
| `bg-sky-50` / `text-sky-700` | `bg-info/10` / `text-info` | |
| `bg-emerald-50` / `text-emerald-700` | `bg-success/10` / `text-success` | |
| `bg-rose-50` / `text-rose-700` | `bg-destructive/10` / `text-destructive` | |
| `bg-orange-50` / `text-orange-700` | `bg-warning/10` / `text-warning` | (close enough; if a dedicated brand orange is needed later, add `--brand-orange`) |
| `bg-indigo-*` / `bg-violet-*` / `bg-purple-*` | `bg-accent/10` / `text-accent` | accent family |

**Override exceptions (KEEP hardcoded):** Recharts/d3 chart series palettes, syntax highlighters, brand-imitation assets (Jira/ADO badges), and where the role file `senior_graphic_designer.md` explicitly calls out a campaign palette. These should be migrated to `--chart-*` semantic tokens in a future PR, not bulk-replaced.

---

## 3. State matrix coverage (per UI/UX Designer lens)

Required states for every interactive primitive: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, `error`, `success`.

| Primitive | Default | Hover | Focus-visible | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|
| `Button` (shadcn) | OK | OK | OK | OK | manual | n/a | n/a |
| `Input` (shadcn) | OK | OK | OK | OK | n/a | n/a | needs `aria-invalid` + `border-destructive` pattern |
| `Card` | OK | n/a | n/a | n/a | n/a | **app-level inconsistent** | n/a |
| `Dialog` | OK | n/a | OK (Radix) | n/a | n/a | n/a | n/a |
| `Sidebar nav item` | OK | OK | OK | n/a | n/a | n/a | n/a |
| `Table row` | OK | OK | inconsistent | n/a | inconsistent | **inconsistent empty state** | n/a |

**Gap:** Empty-states are ad-hoc per feature. Backlog item → introduce `<EmptyState>` shadcn-style primitive in a follow-up PR.

---

## 4. Documentation / governance status

- `mem://index.md`: **missing** — no project memory file. Should hold token vocabulary as Core rules for future agents.
- Decision records (ADR): not present. Recommended for breaking token changes.
- Component ownership: implicit via folder structure (`enterprise/`, `superadmin/`, `embed/`).
- Adoption KPI: **not measured.** Add to monitoring: hardcoded-color hit count (currently 648; target ≤ 100 by v3.45).

---

## 5. Roadmap / prioritized backlog

| Batch | Target version | Files | Lens |
|---|---|---|---|
| **A0 (this PR — v3.43.0)** | DONE | tokens + audit doc + tailwind mapping | Design System Lead |
| **A1 — auth + flagship board** | v3.43.x | `pages/Auth.tsx` (75) + `GiGanttIcBoard.tsx` (88) | UI/UX + Graphic |
| **A2 — daily-use surfaces** | v3.43.x | EmployeeMonthView, LeaveCalendar, CoveragePlannerView, TimelineView (90 hits) | UI/UX |
| **A3 — insights & dashboards** | v3.44.x | BacklogInsights, WellbeingDashboard, AnalyticsDashboard, PredictiveAnalyticsPanel, WellbeingScoreCard, WellbeingRecalculateCard (85 hits) | UI/UX |
| **A4 — admin & superadmin** | v3.44.x | SuperadminControlPlane, FeatureTiersTab, HRWorkflowTemplates, OpenShiftManager (59 hits) | UI/UX |
| **A5 — embeds** | v3.44.x | EmbedCapacityView, EmbedOfficeHeadcountView, EmbedMemberScheduleView, EmbedLeaveCalendarView (43 hits) | UI/UX |
| **A6 — long tail** | v3.45.x | remaining ~68 files | Design System Lead |
| **A7 — chart palette** | v3.45.x | introduce `--chart-1..--chart-12` tokens for Recharts | Design System Lead |
| **A8 — `<EmptyState>` primitive** | v3.45.x | unify empty states across tables | UI/UX |

---

## 6. Anti-regression guardrails

- The `--info` token is **additive only**. No existing class names removed or repurposed.
- Tailwind utilities `bg-info`, `text-info`, `border-info`, `bg-info/10`, etc. are now valid; no existing utility was renamed.
- Future per-file conversions MUST be screenshot-QA'd in both light and dark mode before merging — see `.governance/ui_ux_rules.md`.
- No hardcoded color may be **added** to new code from v3.43.0 onward; reviewers reject PRs that introduce `text-gray-*`, `bg-blue-*`, etc. when a semantic token applies.

---

## 7. Accessibility-by-default contract (Design System Lead × Accessibility Specialist)

All future component spec PRs MUST include in the description:

1. **Color contrast:** default + hover + focus-visible all ≥ 4.5:1 vs. their background, tested in light and dark mode.
2. **Focus indicator:** visible focus ring (Radix/shadcn default `ring-ring` is acceptable; do not remove via `outline-none` without replacement).
3. **Keyboard path:** Tab/Shift-Tab/Enter/Esc/Arrow keys behave per WAI-ARIA Authoring Practices.
4. **Screen reader name:** every icon-only Button has `aria-label`; every form input has an associated `<Label>` or `aria-label`.
5. **Reduced motion:** any animation lasting >200ms respects `prefers-reduced-motion` (already enforced globally in `index.css`).

Items 1–5 audited in detail in `db-audit/a11y_audit_v3.43.1.md` (B-phase).
