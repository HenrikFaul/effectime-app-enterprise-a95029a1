# Accessibility Audit (WCAG 2.2) — v3.49.1 baseline

**Date:** 2026-06-02
**Lens:** Senior Accessibility Specialist + Senior UI/UX Designer (per attached role briefs)
**Scope:** entire `src/` — all user-facing surfaces.

---

## 1. Severity matrix (WCAG 2.2 mapping)

| Finding | WCAG SC | Severity | Occurrences | Files | Effort | Priority |
|---|---|---|---:|---:|---|---|
| Icon-only `<Button size="icon">` missing `aria-label` | 4.1.2 Name, Role, Value (A) | **Critical** | 109 | 60 | low (mechanical) | P0 |
| `h-screen` instead of `h-dvh` on full-height layouts | 1.4.10 Reflow (AA) | High | 26 | 16 | low | P1 |
| Hardcoded `id="..."` in list-rendered components | 4.1.1 Parsing (deprecated but still asserted) | Medium | 39 | 10 | medium | P2 |
| Empty-state inconsistency (no unified `<EmptyState>` primitive) | 3.3.5 Help (AAA) + UX | Medium | many | many | high | P3 |
| Form `<Input aria-invalid>` not consistently paired with `<label for>` | 1.3.1 / 3.3.1 / 3.3.3 | Medium | unknown — needs deep audit | many | medium | P2 |

---

## 2. P0 — Icon Button `aria-label` (109 occurrences in 60 files)

### Top 13 offenders

| File | Missing | Suggested label source |
|---|---:|---|
| `enterprise/calendar/CoveragePlannerView.tsx` | 6 | prev/next month, unassign, accept/reject draft |
| `enterprise/AnnualLeaveGrid.tsx` | 4 | prev/next decade |
| `enterprise/OfficeCoverageRuleManager.tsx` | 4 | row edit/delete |
| `enterprise/developer/DeveloperPortal.tsx` | 4 | copy token, regenerate, etc. |
| `enterprise/AllowanceManager.tsx` | 3 | edit/delete row |
| `enterprise/BusinessRoleManager.tsx` | 3 | edit/delete row |
| `enterprise/LeaveCalendar.tsx` | 3 | event open, prev/next month |
| `enterprise/LeaveTypeManager.tsx` | 3 | edit/delete row |
| `enterprise/RoleAllocationEditor.tsx` | 3 | edit/delete |
| `enterprise/RuleTemplateLibrary.tsx` | 3 | edit/delete |
| `enterprise/WorkspaceDashboard.tsx` | 3 | delete invitation/report/widget |
| `enterprise/reports/PinnedReportsWidget.tsx` | 3 | unpin/move |
| `enterprise/workflows/HRWorkflowTemplates.tsx` | 3 | edit/delete |

### Fix pattern (mechanical, zero-risk)

```tsx
// before
<Button variant="ghost" size="icon" onClick={...}>
  <Trash2 className="h-4 w-4" />
</Button>

// after
<Button variant="ghost" size="icon" onClick={...} aria-label={t('common.delete')}>
  <Trash2 className="h-4 w-4" />
</Button>
```

Use existing `common.*` keys when possible: `common.edit`, `common.delete`, `common.cancel`, `common.save`, `common.add`. Add new keys for context-specific labels (e.g. `coverage_planner.prev_month_label`) when reusable phrasing doesn't fit.

### Anti-regression note
Adding `aria-label` is purely additive — no visual change, no behavior change, no risk of regression. Can be batched aggressively.

---

## 3. P1 — `h-screen` → `h-dvh` (26 occurrences in 16 files)

Affected layout shells:
- `src/App.tsx` (4)
- `src/pages/EmbedPage.tsx` (4)
- `src/pages/Admin.tsx`, `Superadmin.tsx`, `ResetPassword.tsx`, `CandidateBook.tsx` (2 each)
- `src/pages/Auth.tsx`, `Landing.tsx`, `Profile.tsx`, `Enterprise.tsx`, `Reseller.tsx`, `Unsubscribe.tsx`, `NotFound.tsx` (1 each)
- `src/components/shell/AppShell.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`, `src/components/ui/toast.tsx` (1 each)

### Why it matters
On mobile Safari/Chrome, `100vh` includes the address-bar overlay, causing content to be hidden behind the bar. `100dvh` (dynamic viewport height) is the modern replacement.

### Fix pattern
Project-wide search-replace: `h-screen` → `h-dvh`, `min-h-screen` → `min-h-dvh`, `max-h-screen` → `max-h-dvh`. Tailwind supports all three.

---

## 4. P2 — Hardcoded `id="..."` in list contexts

Highest risk files (forms in lists or repeated dialogs):
- `enterprise/agile/JiraIssueEditor.tsx`, `AzureDevOpsIssueEditor.tsx` (6 each)
- `reseller/ResellerPortal.tsx`, `superadmin/SuperadminControlPlane.tsx` (5/4)
- `enterprise/InviteMemberDialog.tsx`, `CreateWorkspaceDialog.tsx` (4 each)

**Fix:** wrap with `useId()` or interpolate row key: `id={\`email-${row.id}\`}`. Risk: low if dialogs are single-instance; medium if rendered in list contexts.

---

## 5. P3 — Empty-state unification

Currently every table/list/dashboard implements its own empty state. UX consequence: inconsistent voice, no help-link, no CTA.

**Recommendation:** introduce `src/components/ui/empty-state.tsx` shadcn-style primitive with props `{ icon, title, description, action? }`. Backlog item, not part of this audit's immediate fix scope.

---

## 6. Already-OK items (no fix needed)

- Radix/shadcn Dialog, DropdownMenu, Popover, Tooltip, Combobox — ARIA correct out of the box (per `<a11y>` Lovable knowledge file).
- Global `prefers-reduced-motion` honoured in `src/index.css` (lines 260–269).
- Color tokens have light/dark parity — contrast meets AA on the semantic token palette.
- Focus indicators via `ring-ring` are present on shadcn primitives.
- Sidebar nav (`WorkspaceSidebar`) has `tooltip` on each `SidebarMenuButton` for collapsed-mode labels.

---

## 7. Prioritized fix batches (anti-regression sequencing)

| Batch | Target | Scope | Risk |
|---|---|---|---|
| **B1 — viewport unit sweep** | v3.49.1 | `h-screen` → `h-dvh` across 16 files (project-wide find/replace) | very low |
| **B2 — admin / settings icon labels** | v3.49.2 | top 10 admin-surface files, ~30 buttons | very low |
| **B3 — calendar / scheduling icon labels** | v3.49.3 | CoveragePlannerView, AnnualLeaveGrid, LeaveCalendar, TimelineView, ~25 buttons | very low |
| **B4 — workflows / agile icon labels** | v3.49.4 | HRWorkflowTemplates, RuleTemplateLibrary, DeveloperPortal, agile editors, ~30 buttons | low |
| **B5 — embed / wellbeing / reports** | v3.49.5 | remaining ~24 buttons | low |
| **B6 — hardcoded id sweep** | v3.50.0 | 10 files, useId() replacement | medium (needs per-file QA) |
| **B7 — `<EmptyState>` primitive + adoption** | v3.50.x | new component + first 5 callsites | medium |

---

## 8. Verification protocol per batch

1. `bun run build` and `bun run build:dev` pass.
2. Manual screen-reader spot-check on 2 changed screens (VoiceOver / NVDA) — each icon Button announces a meaningful name.
3. Keyboard-only walk: Tab through every changed page — focus indicator visible at every stop, no focus trap.
4. Lighthouse a11y score on `/`, `/app`, `/w/:id` — must not regress; target ≥95.

---

## 9. Out-of-scope items (logged for later)

- AAA-level criteria (color contrast 7:1, sign-language interpretation, etc.) — not currently a product commitment.
- Native-app accessibility (Capacitor wrapper) — separate audit pass.
- Localization completeness for `aria-label` strings in `de`, `at`, `ro` — runtime fallback to English is acceptable per v3.28 scaffold strategy, English aria-label is WCAG-compliant.
