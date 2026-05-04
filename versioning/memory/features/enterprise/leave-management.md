# Enterprise Leave Management Memory

## 2026-04-25 — Remaining Absentify gap integration (dashboard + calendar + team policy)

### Implemented in this round
- Workspace Settings integration completed inside existing collapsible `SettingsSection` blocks:
  - `AllowanceManager`
  - `WorkspaceGeneralSettings`
  - `BrandingManager`
  - `CsvImportPanel`
- Calendar tab now includes in-tab sub-navigation:
  - `Naptár` (existing operational calendar)
  - `Éves nézet` (existing `AnnualLeaveGrid` embedded, not split into separate navigation)
- Team management policy extension:
  - `max_absent` editable per team
  - `approval_mode` editable per team (`linear` / `parallel`)
- Remaining package-I widgets added to calendar main view:
  - `BirthdayAnniversaryWidget`
  - `AnnualTrendChart`

### Regression-protection notes
- No parallel tab introduced for annual view.
- Existing tabs (`Tagok`, `Naptár`, `Kérelmek`, `Beállítások`) preserved.
- Existing request, approval, and integration flows remain untouched.

### Backend integration assumption
- Current data access is handled through the existing project data layer (`@/integrations/supabase/client`).
- If runtime backend is switched/abstracted by Lovable infrastructure, these components must keep the same query contracts and table/field mappings.
