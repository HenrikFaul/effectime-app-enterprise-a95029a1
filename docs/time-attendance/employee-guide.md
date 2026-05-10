# Employee guide — Időnyilvántartás

This is what an employee sees and does.

## Daily flow

1. Top navigation → **Időnyilvántartás**.
2. The current month opens by default. Use the `‹` / `›` arrows to switch months.
3. Each day is a clickable card in a 7-column grid (Monday-first).
4. Click any day to open the **Day editor**.

## Adding a work segment

In the Day editor:

1. Click **Új szegmens**.
2. Fill in:
   - **Kezdés / Vége** — start and end timestamps. The dialog uses `datetime-local` so you can edit minutes precisely.
   - **Típus** — one of:
     - **Normál munkaidő** — the default; counts toward `regular_hours`.
     - **Túlóra** — counts toward `overtime_hours` (or `weekend_overtime_hours` if Hétvégi is on).
     - **Szünet / megszakítás** — does NOT count toward worked hours; useful to record visible breaks/interruptions.
     - **Készenléti behívás (tényleges munka)** — counts toward `oncall_intervention_hours` and reduces standby hours by the same amount.
   - **Hétvégi munka** — toggle on if this segment falls on Sat/Sun. Auto-checked when you open the editor for a weekend day.
   - **Éjszakai munka** — toggle on for night/overnight work (your team's threshold).
   - **Megjegyzés** — free text.
3. Click **Mentés**.

If the new segment overlaps another existing segment on the same day, the dialog blocks the save and shows the conflict.

## Split shifts

Add as many segments as you need. Example:

- 09:00 – 12:00 — Normál
- 12:00 – 14:00 — Szünet (optional, for visibility only)
- 14:00 – 19:00 — Normál

The day card on the grid will show **8.0h** (breaks excluded).

## On-call standby

1. From the month header, click **Készenlét rögzítése**.
2. Enter the start and end of the standby block.
3. If you were called in and actually worked during that window:
   - close the dialog,
   - open the affected day,
   - add a **Készenléti behívás** segment for the actual work hours.

The system will:
- treat the rest of the standby window as compensated standby (× 0.20),
- treat the intervention segment as fully paid worked time.

## Monthly confirmation

When the month is ready (the totals look correct, all worked days are in):

1. Click **Benyújtás** in the month header.
2. If the system finds anomalies (no segments at all, or worked hours far below expected), it prompts you for confirmation.
3. After submission the period becomes **Benyújtva** and is read-only for you.

If the admin returns it for correction, the period status becomes **Javításra visszaküldve**, the return reason is shown at the top of the page, and you can edit and resubmit.

## What you cannot do

- Edit a `submitted` / `approved` / `locked` / `exported` period — only the admin can reopen it.
- Edit another employee's period — the RPCs reject the call.
- Create more than one period per (year, month) — the system upserts the existing one.

## Status meanings

| Badge | Meaning |
|-------|---------|
| Vázlat | You are still editing |
| Benyújtva | Awaiting admin review |
| Javításra visszaküldve | Admin asked for corrections — see the red banner |
| Jóváhagyva | Admin approved; you cannot edit |
| Bérszámfejtésre zárva | Locked for payroll; cannot be edited without admin reopen |
| Exportálva | Already in the payroll export batch |
