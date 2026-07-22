# Import/Export Center — Product & Technical Specification

**Version**: v3.5.0 draft  
**Date**: 2026-05-10  
**Status**: Implementation Blueprint  
**Owner**: Principal Product + Engineering  
**Target branch**: `claude/create-software-documentation-O7kj1`

---

## 1. CONTEXT SUMMARY

### Current State

The product currently has two separate, disconnected, limited bulk-data tools inside the Settings panel:

**ExportCenter** (`src/components/enterprise/ExportCenter.tsx`)
- Exports leave/vacation requests only
- Filters by date range, status, team, role
- Outputs CSV, XLS (XML-based), XML, HTML
- Uses display-friendly Hungarian labels — NOT re-importable
- No field selection; the column set is hardcoded
- Audit event logged on export

**CsvImportPanel** (`src/components/enterprise/CsvImportPanel.tsx`)
- Two hardcoded tabs: "Tagok meghívása" and "Szabadságok"
- Members tab: imports `email,role` → creates `enterprise_invitations` (not direct membership)
- Leave tab: imports `email,start_date,end_date,leave_type,status,comment` → creates `leave_requests`
- No template download
- No preview before commit
- No column mapping
- No validation feedback beyond per-row error strings
- Simple CSV parser (no embedded-comma support)
- No duplicate resolution UI

### What This Spec Replaces and Extends

This spec defines a complete redesign of both components into a single, config-driven **Import/Export Center** — a scalable, entity-aware, wizard-based system that safely handles bulk data operations across all workspace entities.

The current members-invitation and leave-import behaviors are preserved and upgraded. No existing data paths are removed.

---

## 2. PRODUCT GOALS

1. **Entity-aware selection**: Admin chooses which entity to operate on; the system adapts its field set, validation rules, and column mapping automatically.
2. **Field-selective exports**: Admin picks exactly which columns to include; the system remembers last selection per entity.
3. **Round-trip compatible exports**: Every export can function as an import template; adding new rows to the exported file and re-importing it works without manual reformatting.
4. **Safe imports**: Preview → validate → repair → confirm → summary. No blind bulk writes.
5. **Required field clarity**: Mandatory fields are always visually distinct — in the UI, in templates, and in error messages.
6. **Future extensibility**: Adding a new entity requires only a new config entry; no UI component rewriting.
7. **Zero regression**: Existing members invitation and leave import paths must remain functional throughout.

---

## 3. INFORMATION ARCHITECTURE

### Location in Settings

The Import/Export Center lives in the Settings tab as a `SettingsSection` collapsible panel, replacing both the current `CsvImportPanel` (currently in "CSV import") and `ExportCenter` (currently in "Export").

Both existing panels are merged into a single section titled **"Adatkezelés — Import / Export"** with icon `Database`.

### Structural Hierarchy

```
Settings tab
└── SettingsSection: "Adatkezelés — Import / Export"  [Database icon]
    ├── Action selector: [Export] [Import]
    ├── Entity selector grid (card-based, scrollable)
    ├── [Export flow] → Field picker → Format picker → Download
    └── [Import flow] → Upload → Map → Validate → Preview → Confirm → Summary
```

### Navigation Modes

- **Collapsed**: Standard `SettingsSection` collapsed view — shows title, icon, and a one-line description ("Tömeges adatkezelés: export, import, sablon letöltés").
- **Expanded**: Shows the action toggle and entity grid. The rest of the flow opens in a full-screen `Dialog` (modal) to avoid Settings page scroll interference.

### Modal Architecture

All detailed import/export work happens inside a **full-screen Dialog** (`max-w-4xl`, 90vh height, `overflow-y: auto`). This prevents the wizard from fighting with the Settings page scroll and sticky navigation.

The Dialog has:
- Header: entity name + action label + step indicator
- Scrollable body: current step content
- Footer: Back / Next / Confirm action buttons

---

## 4. UX REDESIGN

### 4.1 Collapsed Panel Behavior

```
[Database] Adatkezelés — Import / Export                        [▼]
Tömeges adatkezelés: adatok exportálása, importálása, sablonok letöltése
```

Clicking expands to the action selector and entity grid.

### 4.2 Action Selector

Two large toggle buttons side-by-side:

```
┌─────────────────────┐  ┌─────────────────────┐
│  ↑ Export           │  │  ↓ Import           │
│  Adatok letöltése   │  │  Adatok feltöltése  │
└─────────────────────┘  └─────────────────────┘
```

Active state: border-primary, bg-primary/10. One must always be selected.

### 4.3 Entity Selector

A responsive card grid (2 columns on mobile, 3-4 on desktop). Each card shows:
- Icon (Lucide)
- Entity name (Hungarian label)
- Short description (1 line)
- "Exportálható" / "Importálható" badges showing capability

Cards that are not yet available for import show a "Hamarosan" badge and are disabled.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 👤 Tagok         │  │ 🏖 Szabadságok   │  │ 🏢 Telephelyek   │
│ Munkavállalók    │  │ Kérelmek és      │  │ Irodák és helyek │
│ és profilok      │  │ jóváhagyások     │  │                  │
│ [Export][Import] │  │ [Export][Import] │  │ [Export][Import] │
└──────────────────┘  └──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🏷 Munkakörök    │  │ 💼 Pozíciók      │  │ 🎯 Készségek     │
│ Szerepkörök      │  │ Beosztások       │  │ Kompetenciák     │
│ [Export][Import] │  │ [Export][Import] │  │ [Export][Import] │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Selecting an entity + clicking "Tovább" opens the Dialog and starts the flow.

### 4.4 Export Flow (Inside Dialog)

**Step 1 — Field Picker**
- Grouped checklist of all exportable fields for the selected entity
- Each field shows: machine key, Hungarian label, data type badge, REQUIRED badge if mandatory for import
- Group headers (e.g. "Alapadatok", "Szervezeti adatok", "Bővebb adatok")
- "Összes kijelölése" / "Kötelező mezők" quick-select buttons
- "Mentett profil" dropdown: save/load field presets per entity (localStorage)

**Step 2 — Format & Options**
- Format: XLSX (default), CSV
- Filename preview: `effectime_tagok_20260510.xlsx`
- "Import-kompatibilis sablon" toggle (default ON): adds a guidance row below header explaining formats; marks required columns with asterisk in header
- For Leave entity: date range picker (start/end)
- For Members: status filter (active only / all)

**Step 3 — Download**
- Download button triggers generation and immediate browser download
- Shows row count and column count
- Audit event logged

### 4.5 Import Flow (Inside Dialog)

**Step 1 — Instructions + Template Download**
- One-paragraph explanation of the import process
- "Sablon letöltése" button downloads a blank template for the selected entity (all required fields pre-filled with examples)
- "Meglévő adatok exportálása sablon formátumban" — downloads current data in import-compatible format (round-trip)
- Accepted formats: XLSX, CSV (UTF-8 with BOM)
- Max file size: 5 MB, max rows: 2000

**Step 2 — File Upload**
- Drag-and-drop zone + "Fájl kiválasztása" button
- Shows: filename, size, detected format, detected row count
- Basic pre-parse check: can we read the file? Are headers present?
- Error: corrupted file, wrong format, no data rows

**Step 3 — Column Mapping**
- Table: left column = file headers found, right column = system field selector
- System auto-maps when header matches a known machine key or label
- Unmapped required columns flagged in red: "⚠ Kötelező mező nincs leképezve"
- Optional columns can be left unmapped → column is ignored
- Unknown columns the user added can be mapped or ignored

**Step 4 — Validation Preview**
- Full data table showing all rows with color-coded row status:
  - ✅ Green: valid, will be imported
  - 🟡 Yellow: warning (e.g. optional field missing, reference resolved by fuzzy match)
  - 🔴 Red: error (will be skipped unless repaired)
- Each error cell shows tooltip with: what failed + how to fix
- Summary bar: "N sor importálható · M sor hibás · K sor kihagyandó"
- "Hibás sorok szerkesztése" inline repair mode: user can fix individual cells in-place
- "Hibás sorok kihagyása" — proceed with only valid rows
- "Hibás sorok letöltése" — download error rows as CSV for offline repair + re-import

**Step 5 — Import Options**
- "Módszer" toggle:
  - **Csak új sorok** (create only) — skip if a matching record already exists
  - **Frissítés is** (upsert) — update existing records if unique key matches
- Warning for destructive fields if upsert mode
- Shows: estimated creates count, estimated updates count

**Step 6 — Confirm**
- Summary card: entity name, total rows to import, creates, updates, skips
- Warning if any rows were skipped
- Big confirmation button: "Importálás indítása"
- Checkbox: "Megértem, hogy ez visszavonhatatlan módosítás"

**Step 7 — Result Summary**
- Status: success / partial / failure
- Row-level counts: imported, updated, skipped, failed
- List of failed rows (max 20 shown, full list downloadable)
- "Importált adatok megtekintése" deeplink to relevant workspace tab
- Audit event logged

---

## 5. EXPORT DESIGN

### 5.1 Entity Selection for Export

One entity at a time. The "multi-entity batch" (exporting Members + Skills + Positions in one XLSX workbook) is a Phase 3 feature. For Phase 1–2, one entity = one download.

**Recommendation**: One entity per export run. Reason: multi-entity exports create complexity in validation, template stability, and user comprehension. The tradeoff — requiring two exports instead of one — is minor compared to the reduction in confusion. Multi-sheet workbooks for multi-entity will be offered in Phase 3 as an "Advanced export" mode.

### 5.2 Format

**Primary**: XLSX (Excel Open XML, `.xlsx`), generated via the `exceljs` library (or a lightweight XML-based approach matching current pattern). Human-readable, styled header row, column widths optimized.

**Secondary**: CSV (UTF-8 with BOM, RFC 4180 compliant, supports embedded commas/quotes). No library needed.

Both formats must produce identical data; only the file format differs.

**Recommendation**: Default to XLSX. Reason: XLSX supports styled headers, column widths, data validation dropdowns (for enum fields), and protects header rows from accidental editing — all critical for import-compatible templates.

### 5.3 Field Selection

Fields are organized into groups per entity config. The field picker shows:

- Required-for-import fields: always pre-checked, cannot be unchecked (checkbox disabled + locked icon)
- Optional fields: checked by default for "current data export", unchecked by default for "blank template"
- Computed/display-only fields: shown but marked "Csak exportra — nem importálható" with a note icon

The config stores `isExportable`, `isImportable`, `isRequired`, and `isComputed` flags per field per entity.

### 5.4 Import-Compatible Template Design

When "Import-kompatibilis sablon" is ON:
- Row 1: Column headers — machine-friendly keys (e.g. `email`, `display_name`, `team`, `office_name`)
- Row 2 (guidance row, styled gray): version marker
  `__EFFECTIME_GUIDANCE_V1__` in the first canonical importable field plus data
  type hints and examples (e.g. `user@example.com`, `Teszt Felhasználó`,
  `Backend`, `Budapest Iroda`)
- Required columns: header cell styled yellow + asterisk suffix in cell value (`email *`)
- Enum columns: Excel data validation dropdown listing valid values
- Date columns: hint "(YYYY-MM-DD)" in guidance row

The user may delete row 2 before adding data rows. Otherwise the importer skips
it only when the version marker and the field-key-specific guidance signature
match exactly. Column reordering remains compatible because matching follows
the mapped field key, not the physical column position. Pre-marker templates
are recognized only by an exact complete legacy signature. An invalid email or
other invalid first-row value is never, by itself, treated as guidance.

### 5.5 Reference Fields: ID vs Display Name

**Recommendation**: Use display names (human-readable) in exports, not raw UUIDs. The importer resolves display names back to IDs server-side. UUID fallback: if the cell contains a valid UUID pattern, use it directly.

Rationale: Admins editing spreadsheets should see `Budapest Iroda`, not `3e8f9a2c-...`. UUIDs in spreadsheets create confusion, manual lookup burden, and mistakes.

Exception: `membership_id` (the record's own PK) is exported for update-mode identification but marked as "system field — do not edit".

### 5.6 Date/Enum/Boolean Handling

- **Dates**: Exported as `YYYY-MM-DD` strings in both CSV and XLSX. On import, accept `YYYY-MM-DD`, `DD.MM.YYYY`, `YYYY/MM/DD`, `MM/DD/YYYY`. Reject ambiguous formats.
- **Enums**: Exported as machine-readable keys (e.g. `approved`, `pending`, `member`, `owner`). Guidance row shows Hungarian labels. Template includes Excel dropdown validation.
- **Booleans**: Exported as `true` / `false` strings. Accept: `true/false`, `igen/nem`, `1/0`, `yes/no` on import.
- **Null/empty**: Empty cell = null. Never export "null" as a literal string.

### 5.7 CSV Spreadsheet Execution Safety

Every generated CSV header and data cell whose first effective character could
start a spreadsheet formula (`=`, `+`, `-` or `@`, including leading spaces),
or which starts with a tab/carriage return, is prefixed with an apostrophe
before RFC 4180 escaping. Safe values remain byte-for-byte unchanged. This
v3.51.21 boundary applies to CSV generation; it must be preserved for current
data exports, blank templates and downloaded row-error reports.

---

## 6. IMPORT DESIGN

### 6.1 Accepted File Types

| Format | Extension | Encoding | Notes |
|--------|-----------|----------|-------|
| CSV | `.csv` | UTF-8 with BOM preferred; UTF-8 fallback; detect CP-1250 for legacy Windows exports | RFC 4180 compliant parser; handles embedded commas and quotes |
| Excel XML | `.xls` | n/a | Current format generated by ExportCenter; must remain importable |
| Excel Open XML | `.xlsx` | n/a | Primary recommended format |

Max file size: 5 MB. Max data rows: 2,000 per import after an authenticated
guidance row is removed. If larger, show guidance to split into batches.

### 6.2 File Structure Expectations

- Row 1: Column headers (required)
- Row 2: Optional guidance row (auto-detected and skipped)
- Rows 3+: Data rows
- Trailing blank rows: ignored
- Empty rows mid-file: skipped with warning

### 6.3 Header Validation

The importer performs header matching in priority order:
1. Exact match against machine key (e.g. `email`)
2. Case-insensitive match against machine key
3. Exact match against Hungarian display label
4. Fuzzy match (Levenshtein distance ≤ 2) with suggestion shown in column mapping UI

As of v3.51.22, empty and case-insensitively duplicated source headers are
rejected before mapping. A target field may be mapped from at most one source
column; collisions are shown and validation remains disabled. Dynamic source
headers are stored in null-prototype records, including reserved names such as
`__proto__`. The active implementation supports exact key, explicit alias and
label matching; fuzzy suggestions remain a documented target, not current
runtime behavior.

Unrecognized headers are surfaced in Step 3 (Column Mapping) for the user to either map or ignore.

### 6.4 Required Fields

Each entity config defines required fields. If a required field column is missing entirely from the file:
- Block progression past Step 3 (Column Mapping)
- Show: "Hiányzó kötelező oszlop: email — Az importálás nem folytatható"
- Suggest: download the template which includes this column

If a required field column is present but has empty cells:
- Flag those rows as errors in Step 4 (Validation Preview)
- Allow proceeding with only valid rows

### 6.5 Column Mapping UI

Table format:
```
Fájl fejléce         →  Rendszer mező               Státusz
─────────────────────────────────────────────────────────────
email                →  [Email (email) ▾]            ✅ Auto
Nev                  →  [Teljes név (display_name) ▾] 🟡 Egyeztetett (Nev → display_name)
csapat               →  [Csapat (team) ▾]            ✅ Auto
Telephely2           →  [-- Figyelmen kívül --  ▾]  ⬜ Nem leképezve
```

Each row: file header (left), system field dropdown (right), match status badge.
Required fields not yet mapped: highlighted red header row.

### 6.6 Row Validation

Per-row validation runs after column mapping. Validation checks:

1. **Required field empty**: `"email mező üres (sor: 5)"`
2. **Invalid email format**: RFC 5322
3. **Invalid date**: unrecognized format or impossible date
4. **Invalid enum value**: `"leave_type értéke 'xyz' nem érvényes. Érvényes: vacation, sick_leave, unpaid_leave, other"`
5. **Invalid reference**: `"Telephely: 'Ismeretlen Iroda' nem található a munkaterületen"` (warning, not error, in create mode)
6. **Duplicate in file**: two rows with same unique key within the file — show both, ask user to resolve
7. **Duplicate in database**: record with same unique key already exists — behavior depends on import mode (skip vs update)
8. **Out-of-range numeric value**: e.g. negative `base_working_hours`
9. **Business rule violation**: e.g. `end_date < start_date` for leaves

### 6.7 Duplicate Detection

**Within-file duplicates**: Detected during validation. Both rows highlighted. User must delete one or both before proceeding.

**Database duplicates**: Detected via pre-check query before commit. Results:
- **Create-only mode**: skip the row, report as "Kihagyva (már létezik)"
- **Upsert mode**: update the matching record, report as "Frissítve"

Unique keys per entity (see Section 7 for entity-specific definitions).

### 6.8 Update/Create Rules

**Create mode** (default):
- Row is valid + no existing record with matching unique key → INSERT
- Row is valid + existing record found → SKIP, log as "Kihagyva (duplikátum)"

**Upsert mode** (opt-in, admin must explicitly enable):
- Row is valid + no existing record → INSERT
- Row is valid + existing record found → UPDATE only the importable fields (protected fields never updated, see Section 8)
- Upsert requires the unique key column to be present and mapped

### 6.9 Unknown Reference Handling

When a reference field (e.g. `office_name`) cannot be resolved to an existing workspace entity:
- **Warning (not error)**: row proceeds but field is set to `null`
- Message: `"'Unknown Office': nem található, mező null értékkel importálva"`
- Alternatively: user can configure "Fail on unknown reference" in Step 5

### 6.10 Error Handling

Three severity levels:
- **Blocking**: row cannot be imported, marked red, excluded unless repaired
- **Warning**: row imported but with caveat, marked yellow
- **Info**: informational note, row imported normally, marked gray

All errors have:
- Row number
- Column name
- Current cell value
- Explanation (human-readable Hungarian)
- Suggested fix

### 6.11 Partial Success vs Full Rollback

**Recommendation**: Partial success is the default. Failed rows are skipped; valid rows are committed.

Rationale: In enterprise bulk operations, full rollback frustrates admins when 490/500 rows are valid. The minority of failures should not undo the majority of correct work. The admin can download the error report, fix the failed rows, and re-import.

Exception: If a transactional entity (e.g. a workflow that requires all-or-nothing) requires full rollback, this is configurable per entity via `transactional: true` in the entity config.

Commit strategy: Wrap each entity import in a Supabase transaction. Within that transaction, collect all valid rows and execute them. On any unexpected server error, roll back the whole transaction. Row-level validation errors are pre-filtered before the transaction starts, so the transaction only receives validated rows.

### 6.12 Auditability

Every import run generates an `enterprise_audit_events` record with:
```json
{
  "action": "import.completed",
  "metadata": {
    "entity": "members",
    "file_name": "tagok_2026.xlsx",
    "rows_total": 50,
    "rows_created": 45,
    "rows_updated": 2,
    "rows_skipped": 2,
    "rows_failed": 1,
    "import_mode": "upsert",
    "schema_version": "1.0"
  }
}
```

### 6.13 Background vs Synchronous

**Recommendation**: Synchronous for ≤ 500 rows. The import completes during the dialog session; no background job needed.

For files > 500 rows (Phase 3 only): queue a background job via a Supabase Edge Function, show progress with polling, and email the admin when done.

---

## 7. ENTITY-SPECIFIC REQUIREMENTS

### 7.1 Members (`enterprise_memberships` + `profiles`)

**Primary use case**: HR admin imports a new employee list from HRIS; bulk-updates job titles or offices after a reorg.

**Unique key**: `email` (looked up via `profiles.email` → `profiles.user_id` → `enterprise_memberships.user_id`)

**Fields for export/import**:

| Column key | Label | Type | Required | Importable | Notes |
|---|---|---|---|---|---|
| `email` | Email | string | ✅ | ✅ | Identifies the record |
| `display_name` | Teljes név | string | ✅ | ✅ | |
| `role` | Jogosultsági szerep | enum | ✅ | ✅ | `owner`/`resourceAssistant`/`member` |
| `team` | Csapat | string | ❌ | ✅ | Free-text or reference |
| `business_role` | Munkakör | string | ❌ | ✅ | Free-text |
| `location` | Helyszín (szabad) | string | ❌ | ✅ | Legacy free-text location |
| `office_name` | Telephely | string | ❌ | ✅ | Resolved to `office_id` on import |
| `city` | Város | string | ❌ | ✅ | |
| `base_working_hours` | Napi munkaidő (óra) | number | ❌ | ✅ | Default 8 |
| `joined_at` | Csatlakozás dátuma | date | ❌ | ✅ | `YYYY-MM-DD` |
| `status` | Tagság státusza | enum | ❌ | ✅ (restricted) | `active`/`inactive`; admin only |
| `manager_email` | Vezető (email) | string | ❌ | ✅ | OrgChart parent — resolved to manager membership |
| `membership_id` | Tagság ID | uuid | ❌ | Export-only | System PK, never imported directly |
| `user_id` | Felhasználó ID | uuid | ❌ | Export-only | Auth system FK |

**What triggers on import**:
- NEW member: creates an `enterprise_invitations` record (same as current behavior) — the invitation workflow handles auth account creation. Does NOT directly write to `enterprise_memberships` for new users without accounts.
- EXISTING member (upsert): updates `enterprise_memberships` for updatable fields only; never touches `profiles.email` or auth data.

**Import risks**:
- Changing `role` to `owner` must require explicit "Jogosultság-módosítás megerősítése" warning dialog
- `manager_email` chain import must handle circular hierarchy detection (A → B → A)

**Export recommendations**: Default field selection = all basic fields. Extended view fields (skills, goals, onboarding) are exported separately via their own entity tabs, not as columns in the member export.

### 7.2 Leave / Vacations (`leave_requests`)

**Primary use case**: HR imports historical leave data from legacy system; bulk-creates pre-approved leaves for a team.

**Unique key**: Composite — `email` + `start_date` + `end_date` + `leave_type`

**Fields**:

| Column key | Label | Type | Required | Importable | Notes |
|---|---|---|---|---|---|
| `email` | Tag email | string | ✅ | ✅ | Identifies the user |
| `start_date` | Kezdő dátum | date | ✅ | ✅ | `YYYY-MM-DD` |
| `end_date` | Záró dátum | date | ✅ | ✅ | ≥ start_date |
| `leave_type` | Típus | enum | ✅ | ✅ | `vacation`, `sick_leave`, `unpaid_leave`, `other` |
| `status` | Státusz | enum | ❌ | ✅ | Default `approved` on import |
| `comment` | Megjegyzés | string | ❌ | ✅ | |
| `is_half_day` | Félnap | boolean | ❌ | ✅ | `true`/`false` |
| `half_day_period` | Félnap időszak | enum | ❌ | ✅ | `morning`/`afternoon` |
| `display_name` | Tag neve | string | ❌ | Export-only | Derived; for human readability |
| `team` | Csapat | string | ❌ | Export-only | Derived from membership |

**Import risks**: Importing `status: approved` creates approved leave without going through the approval workflow. This is by design for historical data import, but the system shows a prominent warning: "Figyelem: Jóváhagyott státuszú kérelmek workflow nélkül kerülnek be az adatbázisba."

### 7.3 Locations / Sites (`enterprise_offices`)

**Primary use case**: Admin bulk-creates office locations from a company directory.

**Unique key**: `name` (within workspace)

**Fields**:

| Column key | Label | Type | Required | Importable |
|---|---|---|---|---|
| `name` | Telephely neve | string | ✅ | ✅ |
| `city` | Város | string | ❌ | ✅ |
| `country` | Ország | string | ❌ | ✅ |
| `address` | Cím | string | ❌ | ✅ |
| `is_remote` | Remote telephely | boolean | ❌ | ✅ |
| `office_id` | Telephely ID | uuid | ❌ | Export-only |

### 7.4 Work Categories (`enterprise_catalog_categories` / `enterprise_workspace_role_categories`)

**Primary use case**: Admin imports catalog categories used to organize job roles.

**Unique key**: `name` (workspace-scoped)

**Fields**:

| Column key | Label | Type | Required | Importable |
|---|---|---|---|---|
| `name` | Kategória neve | string | ✅ | ✅ |
| `description` | Leírás | string | ❌ | ✅ |
| `is_active` | Aktív | boolean | ❌ | ✅ | Default `true` |

### 7.5 Job Roles (`enterprise_catalog_roles` / `enterprise_workspace_roles`)

**Primary use case**: Admin imports job role catalog from HRIS.

**Unique key**: `name` within `category_name`

**Fields**:

| Column key | Label | Type | Required | Importable |
|---|---|---|---|---|
| `name` | Munkakör neve | string | ✅ | ✅ |
| `category_name` | Kategória | string | ✅ | ✅ | Resolved to FK |
| `description` | Leírás | string | ❌ | ✅ |
| `is_active` | Aktív | boolean | ❌ | ✅ |
| `required_skills` | Szükséges készségek | string | ❌ | ✅ | Semicolon-separated list |

### 7.6 Positions / Business Roles (`enterprise_business_roles`)

**Primary use case**: Admin bulk-creates project positions and allocation slots.

**Unique key**: `name` (workspace-scoped)

**Fields**:

| Column key | Label | Type | Required | Importable |
|---|---|---|---|---|
| `name` | Pozíció neve | string | ✅ | ✅ |
| `description` | Leírás | string | ❌ | ✅ |
| `department` | Osztály | string | ❌ | ✅ |
| `is_active` | Aktív | boolean | ❌ | ✅ |

### 7.7 Skills (`enterprise_skills` / `enterprise_catalog_skills`)

**Primary use case**: Admin imports skill catalog; HR assigns skills to members.

**Phase 1**: Export/import the skill catalog (skill names, categories).  
**Phase 2**: Member-skill assignments (`enterprise_member_skills`) — importable as part of Member extended import.

**Unique key**: `name`

**Fields**:

| Column key | Label | Type | Required | Importable |
|---|---|---|---|---|
| `name` | Készség neve | string | ✅ | ✅ |
| `category` | Kategória | string | ❌ | ✅ |
| `description` | Leírás | string | ❌ | ✅ |
| `is_active` | Aktív | boolean | ❌ | ✅ |

---

## 8. MEMBERS SPECIAL RULE

All fields visible in the member profile (basic and extended view) and org chart context must be considered for export. The following table classifies each:

| Field | Source | Export? | Import? | Notes |
|---|---|---|---|---|
| `email` | `profiles.email` | ✅ | ✅ Required | Unique key |
| `display_name` | `profiles.display_name` | ✅ | ✅ | |
| `role` | `enterprise_memberships.role` | ✅ | ✅ (admin + warning) | Role escalation confirmation |
| `team` | `enterprise_memberships.team` | ✅ | ✅ | |
| `business_role` | `enterprise_memberships.business_role` | ✅ | ✅ | |
| `location` | `enterprise_memberships.location` | ✅ | ✅ | Legacy field |
| `office_name` | `enterprise_offices.name` via `office_id` | ✅ | ✅ (resolved) | |
| `city` | `enterprise_memberships.city` | ✅ | ✅ | |
| `base_working_hours` | `enterprise_memberships.base_working_hours` | ✅ | ✅ | |
| `joined_at` | `enterprise_memberships.joined_at` | ✅ | ✅ | |
| `status` | `enterprise_memberships.status` | ✅ | ✅ (admin, warning) | active/inactive |
| `manager_email` | OrgChart parent via `enterprise_memberships` | ✅ | ✅ | Derived from reporting structure |
| `skills` | `enterprise_member_skills` | ✅ (semicolon list) | ✅ (Phase 2) | |
| `onboarding_status` | `enterprise_onboarding_instances.status` | ✅ | ❌ Export-only | Computed from workflow |
| `access_systems` | `enterprise_access_requests` | ✅ (summary) | ❌ Export-only | Access via workflow only |
| `goals_count` | `enterprise_member_goals` | ✅ (count) | ❌ Export-only | |
| `jira_assignee_issues_count` | `enterprise_agile_issues` | ✅ (count) | ❌ Export-only | Synced from Jira |
| `membership_id` | `enterprise_memberships.id` | ✅ | ❌ Export-only | System PK |
| `user_id` | `enterprise_memberships.user_id` | ❌ | ❌ | Auth system; never exposed in bulk |

**Protected fields** (cannot be modified via import under any circumstances):
- `user_id` — auth system ownership
- `profiles.email` — changing email changes auth identity; requires dedicated auth flow
- System-generated timestamps (`created_at`, `updated_at`) — managed by DB triggers

---

## 9. TEMPLATE DESIGN

### Template Philosophy

Templates serve two simultaneous audiences:
1. **Human editor**: person opening the file in Excel — needs to understand what to fill in
2. **Machine importer**: the import engine — needs unambiguous, stable column identifiers

Rules:
- **Row 1 (headers)**: Machine-friendly keys only. Stable across versions. Required columns suffixed `*`.
  - Example: `email *`, `display_name *`, `team`, `office_name`
- **Row 2 (guidance, styled gray)**: Version marker in the first canonical
  importable field plus human examples and type hints. Auto-skipped only after
  the deterministic marker/signature check described in Section 5.4.
  - Example: `kovacs.bela@ceg.hu`, `Kovács Béla`, `Backend`, `Budapest Iroda (YYYY-MM-DD)`
- **Column width**: auto-sized to header + example content
- **Header row**: styled (bold, yellow background for required, blue for optional)
- **Tab name**: entity label (e.g. "Tagok", "Szabadságok")
- **Schema version**: hidden column `__schema_version` = `"1.0"` for future template evolution detection
- **Enum columns**: Excel dropdown data validation showing valid values

### Template Stability Contract

Machine keys are versioned and stable. If a field is renamed in the system, the old key remains an accepted alias in the importer for 2 major versions. The `__schema_version` column enables version-specific parsing logic when needed.

---

## 10. REQUIRED FIELD STRATEGY

Required fields are visually consistent across all contexts:

| Context | Visual treatment |
|---|---|
| Export field picker | Lock icon + cannot uncheck + "Kötelező importhoz" tooltip |
| Downloaded template header | Yellow cell background + `*` suffix in header text |
| Column mapping step | Red warning if unmapped: "Kötelező — nem lehet kihagyni" |
| Validation preview | Red cell highlight if empty, tooltip "Kötelező mező üres" |
| Error summary | `[email *]: Kötelező mező — 3 sorban üres` |

The asterisk convention is universally understood. The lock icon reinforces that required fields cannot be excluded from templates. Tooltips explain WHY a field is required (e.g. "Az email alapján azonosítjuk a felhasználót az importálás során").

---

## 11. DATA MODEL + BACKEND RULES

### 11.1 Import Service Architecture

**Recommendation**: Client-side validation for speed; server-side validation for integrity. Two-pass approach:

**Pass 1 (client-side, synchronous)**:
- File parsing and header detection
- Column mapping
- Basic format validation (date format, enum values, email format, required fields present)
- Duplicate detection within file

**Pass 2 (server-side, via Supabase Edge Function `import-entity-data`)**:
- Reference resolution (office_name → office_id, manager_email → membership.user_id)
- Database duplicate detection (matching unique keys against existing records)
- Business rule validation (date ranges, role hierarchy permissions)
- **Target:** transactional batch write. **Current gap (v3.51.22):** the Edge
  handler performs sequential row operations, so an unexpected server failure
  can leave a documented partial result.

### 11.2 Edge Function: `import-entity-data`

```
POST /functions/v1/import-entity-data
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "workspace_id": "uuid",
  "entity": "members",
  "mode": "create" | "upsert",
  "schema_version": "1.0",
  "rows": [...],  // validated row objects, column-mapped, ready to process
  "dry_run": false
}

Response 200:
{
  "summary": {
    "total": 50, "created": 45, "updated": 2, "skipped": 2, "failed": 1
  },
  "errors": [
    { "row_index": 12, "field": "office_name", "value": "Ismeretlen", "code": "REFERENCE_NOT_FOUND", "message": "..." }
  ]
}
```

As of v3.51.22, the active web/Android/iOS client accepts that response as
completed only when `success === true`, every summary count is a non-negative
safe integer, `total` equals the exact submitted batch size, the four outcome
counts add up to `total`, and every bounded row error references a submitted
row. The current Edge contract emits at most one terminal error per submitted
row and pairs every failed count with exactly one unique row error, so the client
requires `errors.length === summary.failed` and rejects duplicate row indexes.
It also rejects `errors.length > rows.length` before iterating the collection.
Unknown additive response fields remain compatible. The client retains
the original source-row index next to each cleaned valid row but sends only the
existing row data wire shape; returned compact indexes are remapped to the
original file before display or error-report download.

The client performs exactly one invocation. A validated 4xx Functions HTTP
response is a definitive preflight rejection. A 5xx response, transport
failure, unreadable/malformed response or malformed HTTP 200 is presented as
an unknown outcome, with no automatic retry or fabricated zero-summary. Only a
bounded allowlisted code/status pair and a correlation-safe request ID may be
read from `FunctionsHttpError.context`; the clone is capped at 16,384 bytes and
two seconds of total read time. Provider messages are never displayed.

An end-to-end import request timeout remains deliberately unconfigured until
per-entity 2,000-row latency is measured. The current handler performs
sequential, non-transactional writes, so an unmeasured hard timeout could abort
a previously completing batch after partial writes. Any future timeout must
preserve the outcome-unknown/no-retry behavior and ship with load evidence plus
an idempotency or transactional recovery plan.

The request shape above is the target contract. **Current gap (v3.51.22):**
`schema_version` is not authoritatively validated by the handler.

**Dry-run target:** `dry_run: true` runs all server validation and reference
resolution without committing and returns the same response shape. **Current
gap (v3.51.22):** the active Import Wizard performs its validation preview on
the client and does not invoke the server dry-run before confirmation.

### 11.3 Transactional Behavior

**Target:** each entity import runs in a single PostgreSQL transaction. If a
mid-transaction server error occurs, the entire transaction rolls back, and
  only rows that passed validation enter the transaction. **Current gap
  (v3.51.22):** the handler performs row-level writes sequentially and can return
partial success; full rollback is not yet guaranteed. The v3.51.22 client
distinguishes this uncertainty but does not make the writes transactional.

### 11.4 Authorization

- Only active `owner` and `resourceAssistant` members may trigger imports.
- After authentication and role verification, but before `import.started`, dry-run
  accounting, reference reads or writes, the Edge Function resolves the
  workspace's authoritative tenant feature union. Both exact feature keys
  `csv_import` and its documented dependency `members_list` are required.
- A valid disabled entitlement returns a sanitized `403`. Tenant mapping,
  feature lookup or malformed response failures return a sanitized `503`.
- The v3.51.21 handler boundary returns stable additive `code` values without
  provider messages. JSON responses are `Cache-Control: no-store`, carry
  `X-Request-Id`, and expose that header through CORS; server-side failures also
  return the same bounded `request_id` in the JSON body. Invalid JSON is a
  bounded `400`, and methods other than `POST`/`OPTIONS` receive `405`.
- Authentication, active-role and entitlement denial occurs before the
  authorized executor, so `import.started`, dry-run accounting, dependency
  reads and writes remain at zero on those paths. Real-`Request` handler tests
  preserve this ordering contract.
- The UI mirrors this decision to disable and explain Import without removing
  Export. The Edge check remains authoritative for web, Android and iOS clients.
- The handler resolves authorization and references from the requesting
  workspace and create paths write that workspace identity. This is the current
  tenant boundary, not a proof that every mutation is atomically protected from
  a concurrent role or entitlement change; request-level adversarial coverage
  remains required.

### 11.5 Workspace Scoping

**Target:** every INSERT/UPDATE is constrained by the requesting workspace, and
reference resolution (for example `office_name`) uses the same tenant. Current
create paths explicitly carry `workspace_id`; not every UPDATE includes an
explicit workspace predicate because some use previously resolved parent/row
identities. Cross-workspace and concurrent demotion/revocation behavior must be
proven by dynamic request/DB contracts before production release.

### 11.6 Audit Events

**Target audit lifecycle:**
1. `import.started` — logged when the user confirms (before execution)
2. `import.completed` — logged after execution with full summary metadata

As of v3.51.22, failure to persist `import.started` fails closed before entity
reads or writes. A completion-audit failure after sequential writes is logged
as a bounded warning and cannot retroactively roll back those writes. A
guaranteed `import.failed` event and atomic coupling between mutations and the
completion audit remain gaps. Audit and log metadata use bounded codes and do
not include raw backend details.

### 11.7 Row-Level Error Reporting

The Edge Function returns a structured error array (see Section 11.2). Each error includes:
- `row_index`: 0-based index into the submitted rows array
- `field`: which column
- `value`: the submitted value
- `code`: machine error code (e.g. `REQUIRED_EMPTY`, `INVALID_ENUM`, `REFERENCE_NOT_FOUND`, `DUPLICATE_KEY`, `BUSINESS_RULE`)
- `reason_code` (optional): additive, more specific provider-failure category
- `message`: human-readable Hungarian explanation

Each submitted row reaches exactly one terminal accounting outcome and emits
at most one row-level error. Multiple field errors for the same row would be a
versioned contract change; clients may reject a response containing more errors
than submitted rows.

The v3.51.22 client preserves original zero-based source indexes for both local
validation CSV reports and remapped server errors. UI row labels add one only
for human-readable display. Global transport failures are not represented as a
synthetic row `-1`, so neither the UI nor downloaded reports can show a false
row 0.

Export/current-data template reads use a stable, detail-free client error
boundary. Primary entity reads, the job-role category join, positions lookup
and unsupported entity keys fail closed rather than returning partial or empty
success. The user receives a localized generic recovery message; raw database
or provider details are not forwarded to the DOM or toast layer.

Provider write failures preserve the legacy machine contract `code: DB_ERROR`
and add `reason_code: ROW_WRITE_FAILED` (or `INVITATION_FAILED`) with a fixed
client message; provider messages and codes are not reflected. Every returned
`value`, including validation and reference errors, is limited to 256 Unicode
code points so a surrogate pair is never split. Prerequisite lookup failures
fail the request closed instead of being interpreted as an empty dataset.

---

## 12. FRONTEND IMPLEMENTATION STRATEGY

### 12.1 Component Architecture

```
src/components/enterprise/import-export/
├── ImportExportCenter.tsx          # Main entry point (replaces CsvImportPanel + ExportCenter)
├── EntitySelector.tsx              # Card grid for entity selection
├── ExportWizard.tsx                # Export flow wizard
│   ├── ExportFieldPicker.tsx       # Grouped field checklist
│   └── ExportFormatPicker.tsx      # Format + options
├── ImportWizard.tsx                # Import flow wizard (7 steps)
│   ├── ImportInstructions.tsx      # Step 1: instructions + template download
│   ├── ImportUpload.tsx            # Step 2: drag-drop upload
│   ├── ImportColumnMapper.tsx      # Step 3: column mapping table
│   ├── ImportValidationPreview.tsx # Step 4: data table + inline repair
│   ├── ImportOptions.tsx           # Step 5: create/upsert mode
│   ├── ImportConfirm.tsx           # Step 6: summary + confirmation
│   └── ImportResult.tsx            # Step 7: result summary
├── config/
│   ├── entity-registry.ts          # Entity config definitions (see Section 13)
│   └── field-definitions.ts        # Field metadata
└── utils/
    ├── csv-parser.ts               # Robust CSV parser (handles BOM, quotes, commas)
    ├── xlsx-parser.ts              # XLSX reader (uses SheetJS or manual parser)
    ├── template-generator.ts       # Generates blank + pre-filled templates
    └── import-validator.ts         # Client-side validation logic
```

### 12.2 State Model

The wizard state is managed in a single `useImportExport` custom hook:

```typescript
interface ImportExportState {
  mode: 'export' | 'import' | null;
  entity: EntityKey | null;
  step: number;
  // Export state
  selectedFields: string[];
  exportFormat: 'xlsx' | 'csv';
  // Import state
  uploadedFile: File | null;
  parsedRows: Record<string, string>[];
  columnMapping: Record<string, string>;  // file header → entity field key
  validationResult: ValidationResult | null;
  importMode: 'create' | 'upsert';
  importResult: ImportResult | null;
}
```

State is local to the dialog; no global state pollution. On dialog close, state resets.

### 12.3 Extensibility Pattern

To add a new entity:
1. Add an entry to `entity-registry.ts` (see Section 13)
2. Add a migration for any new table needed
3. Add entity handling to the `import-entity-data` Edge Function

No UI component changes required. The wizard, field picker, mapper, and validator all read from the entity registry config.

---

## 13. CONFIG-DRIVEN ARCHITECTURE

### 13.1 Entity Registry

```typescript
// src/components/enterprise/import-export/config/entity-registry.ts

export interface FieldDefinition {
  key: string;                    // machine key (used in template headers and DB column)
  label: string;                  // Hungarian display label
  type: 'string' | 'email' | 'date' | 'boolean' | 'enum' | 'uuid' | 'number';
  enumValues?: string[];          // valid values for enum type
  required: boolean;              // required for import
  importable: boolean;            // can be written on import
  exportable: boolean;            // included in export
  computed?: boolean;             // derived/read-only, export-only
  group?: string;                 // field group label for picker UI
  description?: string;           // tooltip for field picker
  referenceEntity?: string;       // if this resolves to another entity key
  referenceDisplayField?: string; // which display field to use for label
  referenceIdField?: string;      // which id field to write on import
  templateExample?: string;       // example value shown in guidance row
  importAlias?: string[];         // alternative header names accepted on import
}

export interface EntityConfig {
  key: string;                    // unique identifier e.g. 'members'
  label: string;                  // "Tagok"
  icon: LucideIcon;
  description: string;
  exportEnabled: boolean;
  importEnabled: boolean;
  uniqueKeyFields: string[];      // fields that identify a record uniquely
  transactional?: boolean;        // rollback all on any failure
  supportsUpsert?: boolean;
  importRoleRequired?: 'owner' | 'resourceAssistant';
  fields: FieldDefinition[];
  // Hooks for server-side operations
  importEndpointEntity: string;   // entity name sent to Edge Function
}

export const ENTITY_REGISTRY: EntityConfig[] = [
  {
    key: 'members',
    label: 'Tagok',
    icon: Users,
    description: 'Munkavállalók és profiljaik',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['email'],
    supportsUpsert: true,
    importEndpointEntity: 'members',
    fields: [
      {
        key: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        importable: true,
        exportable: true,
        group: 'Alapadatok',
        templateExample: 'kovacs.bela@ceg.hu',
        description: 'Az email alapján azonosítjuk a felhasználót.',
      },
      {
        key: 'display_name',
        label: 'Teljes név',
        type: 'string',
        required: true,
        importable: true,
        exportable: true,
        group: 'Alapadatok',
        templateExample: 'Kovács Béla',
      },
      // ... remaining fields per Section 8 table
    ],
  },
  // ... other entities
];
```

### 13.2 Usage Pattern

All wizard components receive `EntityConfig` as a prop. They render dynamically based on the config — no switch/case on entity key inside UI components.

The edge function receives `entity` key and resolves it to server-side entity handler via a similar registry pattern (TypeScript map on the Deno side).

---

## 14. VALIDATION + ERROR UX

### 14.1 Error Categories and Messages

| Category | Code | UI Treatment | Example Message |
|---|---|---|---|
| File corrupted | `FILE_CORRUPT` | Full step error | "A fájl nem olvasható. Ellenőrizd, hogy XLSX vagy CSV formátumú-e." |
| No headers | `NO_HEADERS` | Full step error | "Az első sor üres. A fejléc sor kötelező." |
| Missing required column | `MISSING_REQUIRED_COLUMN` | Blocking column warning | "Hiányzó kötelező oszlop: email" |
| Required field empty | `REQUIRED_EMPTY` | Red cell | "Kötelező mező üres" |
| Invalid email | `INVALID_EMAIL` | Red cell | "'kovacs[at]ceg' nem érvényes email cím" |
| Invalid date | `INVALID_DATE` | Red cell | "'2026.13.45' nem érvényes dátum (YYYY-MM-DD)" |
| Invalid enum | `INVALID_ENUM` | Red cell | "'szabadsag' ismeretlen. Érvényes: vacation, sick_leave, unpaid_leave, other" |
| Reference not found | `REFERENCE_NOT_FOUND` | Yellow cell | "'Ismeretlen Iroda' nem található. Null értékkel importálva." |
| Duplicate in file | `DUPLICATE_IN_FILE` | Both rows orange | "Duplikált sor (email egyezés: kovacs@ceg.hu)" |
| Duplicate in DB | `DUPLICATE_IN_DB` | Yellow (skip) | "Már létező rekord. Kihagyva." |
| Business rule | `BUSINESS_RULE` | Red cell | "A záró dátum nem lehet korábbi a kezdő dátumnál" |
| Permission | `PERMISSION_DENIED` | Row blocked | "Jogosultság szükséges a szerepkör módosításához" |

### 14.2 Inline Repair

In Step 4, when a row has blocking errors:
- Red cells are editable inline (click → input appears)
- Corrected value is re-validated immediately (visual feedback within 200ms)
- Row status badge updates dynamically as errors are resolved

Inline repair handles simple cases. For complex issues (missing reference entity), the UI suggests: "Hozd létre a telephelyet előbb a Beállítások → Telephelyek szekcióban."

---

## 15. BULK OPERATION SAFETY

### Pre-Import Checklist (Step 6 Confirmation)

```
Importálás előtt ellenőrizd:

✅ 47 sor importálható
⚠  2 sor kihagyva (duplikátum)
❌  1 sor hibás (kizárva)

Mode: Csak új sorok (frissítés NEM történik)
Entity: Tagok (enterprise_memberships)
Workspace: Acme Corp

[ ] Megértem, hogy az importálás visszavonhatatlan.

                    [Mégsem]  [Importálás indítása →]
```

### Warning Escalation

- Importing > 100 rows: "Nagy mennyiségű importálás — ellenőrizd a sablon dátumát"
- Enabling upsert mode: "Frissítés módban a meglévő adatok felülírásra kerülnek"
- Importing `status: approved` leaves: "Jóváhagyott kérelmek workflow nélkül kerülnek be"
- Changing member role: "Szerepkör módosítása — erősítsd meg" (per-row inline confirm)

### Error Report Download

After a partially successful import, a "Hibák letöltése" button generates a CSV of the failed rows in the same format as the original template, with an extra `__error` column explaining each failure. This file can be fixed and re-imported directly.

---

## 16. WORKSPACE BEHAVIOR

### 16.1 Workspace Context

The Import/Export Center is rendered inside `WorkspaceDashboard`, which receives `workspaceId` as a prop. This ID flows into every component. The Edge Function receives `workspace_id` in the request body.

There is no concept of "selecting" a workspace inside the import flow — the workspace is always the currently active one.

### 16.2 Cross-Workspace Prevention

- All queries use explicit `workspace_id =` filter
- The Edge Function's workspace authorization check occurs before any data access
- Reference resolution (office_name lookup) also scopes to `workspace_id` — an office from workspace A cannot be resolved during an import into workspace B

### 16.3 Unknown References

If imported data references an entity that doesn't exist in this workspace:
- **Default behavior**: set the reference field to `null`, log a warning
- **Strict mode** (configurable per import run): reject the row if any reference cannot be resolved

### 16.4 Cross-Workspace Import (Explicitly Not Supported)

Importing data from workspace A into workspace B is not supported. If needed in the future, it would require explicit workspace selection with elevated permissions — a separate feature.

---

## 17. DESIGN PRINCIPLES

| Principle | Application |
|---|---|
| **Scalable** | Config-driven entity registry; adding entity = one config entry |
| **Explicit** | Required fields always marked; mode always shown; row counts always visible |
| **Safe** | Dry-run option; confirmation required; warnings for destructive operations |
| **Import-friendly** | Every export can function as an import template |
| **Round-trip compatible** | Export → edit → import works without reformatting |
| **Admin-efficient** | Template download, inline repair, error report download reduce manual work |
| **Low ambiguity** | Machine keys in templates; Hungarian labels in UI; consistent column naming |
| **Low regression risk** | Current CsvImportPanel and ExportCenter replaced via config-driven equivalent |
| **Accessible** | Keyboard-navigable wizard; screen reader labels on all interactive elements; error cells announced |
| **Future-proof** | Entity registry pattern; schema_version in templates; import alias support for renamed fields |

---

## 18. ANTI-PATTERNS TO AVOID

| Anti-pattern | Mitigation |
|---|---|
| Hardcoded entity logic in UI components | Entity registry pattern; all entity-specific logic in config |
| Unclear required fields | Visual distinction across all contexts (lock, asterisk, red highlight, tooltip) |
| Exports that cannot be re-imported | Import-compatible mode with guidance row; machine keys in headers |
| Hidden validation rules | All validation rules documented in config and surfaced in UI |
| Weak error feedback | Structured error format with row/field/value/code/message |
| Importing without preview | Step 4 is mandatory; cannot skip to confirmation |
| Irreversible overwrites without warning | Upsert mode requires explicit opt-in + confirmation checkbox |
| Mixing display text and machine keys | Machine keys in templates; display labels only in UI |
| Inconsistent column naming | Single field registry; same key used in DB, template, Edge Function, and error messages |
| Exporting UUIDs as-is | Display names in exports; UUID only for optional "system ID" column |

---

## 19. RECOMMENDED FINAL UX FLOW

```
1. User opens Settings tab
2. Expands "Adatkezelés — Import / Export" section
3. Selects action: [Export] or [Import]
4. Selects entity from card grid (e.g. "Tagok")
5. Clicks "Tovább" → Dialog opens

IF Export:
  6a. Field picker: checks/unchecks fields; uses "Kötelező mezők" preset
  7a. Format picker: XLSX (default); "Import-kompatibilis sablon" toggle ON
  8a. Clicks "Letöltés" → file downloads → dialog closes
  9a. Audit event logged

IF Import:
  6b. Instructions screen: reads note; optionally downloads blank template or
      "current data as template"
  7b. Uploads file (drag-drop or file picker)
  8b. Column mapping: reviews auto-mapped columns; fixes unmapped required fields
  9b. Validation preview: sees table with row statuses; repairs inline errors or
      downloads error rows for offline fix
  10b. Import options: selects Create-only or Upsert; reads counts
  11b. Confirmation: reads summary; checks "Megértem"; clicks "Importálás indítása"
  12b. Result summary: sees created/updated/skipped/failed counts;
       downloads error report if any failures
  13b. Optionally navigates to relevant tab via deeplink
  14b. Two audit events logged (import.started + import.completed)
```

---

## 20. IMPLEMENTATION PRIORITIES

### Phase 1 — Foundation (Minimal Breaking Change)

**Goal**: Replace both current panels with the new ImportExportCenter shell; preserve all current functionality; add entity selector and field selector.

1. Create `ImportExportCenter.tsx` replacing both `CsvImportPanel` and `ExportCenter` in Settings
2. Implement `ENTITY_REGISTRY` config with `members` and `leave` entities
3. Implement `EntitySelector` card grid
4. Implement `ExportWizard` with field picker (Members: all current member fields; Leave: all current leave fields)
5. Generate import-compatible XLSX templates with guidance row and required column markers
6. Implement `ImportWizard` Steps 1–3 (Instructions, Upload, Column Mapping) — replacing current blind CSV upload
7. Implement Step 4 (Validation Preview) — replaces current inline error list
8. Implement Steps 5–7 (Options, Confirm, Result)
9. Implement `import-entity-data` Edge Function for members and leave
10. Preserve current invitation-based member import behavior; wire it through new wizard
11. CHANGELOG entry v3.5.0; versioning file; codingLessonsLearnt update

**Does NOT include**: inline repair, background jobs, multi-entity export, upsert mode (available but hidden).

### Phase 2 — Extended Entities + Repair UX

1. Add entity configs for: `locations`, `work_categories`, `job_roles`, `positions`, `skills`
2. Add Edge Function handlers for each new entity
3. Implement inline repair in Step 4
4. Enable upsert mode (create + update toggle)
5. Add "current data as template" export for all entities
6. Add `manager_email` org chart field to member import/export
7. Add error report download (failed rows as CSV)
8. CHANGELOG entry v3.6.0

### Phase 3 — Advanced Features

1. Multi-entity batch export (multi-sheet XLSX workbook)
2. Background import for >500 rows (Edge Function job queue + email notification)
3. Import history log (view past imports with summaries)
4. Saved field profiles (export presets per entity)
5. Import dry-run mode exposed as explicit user action ("Ellenőrzés futtatása")
6. Member skills bulk assignment via import
7. Schema version migration support
8. CHANGELOG entry v3.7.0+

---

## EXPLICIT DESIGN DECISIONS SUMMARY

| Decision | Recommendation | Rationale |
|---|---|---|
| **File formats** | XLSX primary, CSV secondary; both accepted on import | XLSX enables styled templates, dropdown validation, column protection. CSV remains for CI/integrations. |
| **Single vs multi-sheet export** | Single sheet per entity in Phase 1–2; optional multi-sheet workbook in Phase 3 | Reduces complexity; multi-entity exports confuse mapping and validation |
| **One entity vs batch export** | One entity at a time for both import and export | Clearer UX, safer validation, lower regression risk |
| **Update existing rows** | Yes, via explicit opt-in "Upsert" mode | Historical data migrations and reorg updates require update capability; opt-in prevents accidental overwrites |
| **Unique keys** | `email` for members; `name` (workspace-scoped) for reference entities; composite for leaves | Natural keys are human-readable and stable; avoids UUID dependency in spreadsheets |
| **Protected member fields** | `user_id`, `profiles.email`, system timestamps cannot be imported | Changing email changes auth identity — requires dedicated auth flow, not bulk import |
| **Org chart fields** | `manager_email` is importable (creates hierarchy link); computed hierarchy (depth, path) is export-only | Computed fields change when any ancestor changes; importing them would create stale data |
| **Relationship field format** | Display names exported; server-side lookup on import; UUID accepted as fallback | Admins must be able to read and edit the spreadsheet without looking up UUIDs |
| **Failed rows behavior** | Partial success: valid rows committed, failed rows skipped and downloadable | Enterprise bulk operations should not be held hostage by 2% failure rate |
| **Template stability** | Machine keys in headers + `__schema_version` hidden column + import alias support | Allows field renames without breaking existing templates for 2 major versions |

---

## APPENDIX: Supabase Edge Function Structure

The authoritative implementation is
`supabase/functions/import-entity-data/handler.ts` plus `index.ts`; copied
single-callback skeletons are not an acceptable implementation because they
bypass the tested zero-side-effect authorization boundary. The runtime shape is:

```text
Deno.serve(createImportEntityDataHandler(...))
  handler.ts: method/body validation → authentication → active role → exact entitlements
  index.ts:    Supabase adapters → start audit → prerequisite reads → entity writes → completion audit
```

The handler owns ordering, stable error responses and request correlation. The
index executor is unreachable until authentication, workspace role and exact
entitlement checks all succeed.

---

*This specification is the implementation blueprint for the Effectime Enterprise Import/Export Center v3.5.0+. All design decisions are recorded with rationale. Implementation should follow Phase 1 → Phase 2 → Phase 3 sequence as documented in Section 20.*
