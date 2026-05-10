# Future hardware ingestion

Manual entry is the v1 path. The data model is deliberately **dual-source**: any hardware-driven attendance event (badge, NFC, mobile clock-in, IP webhook, BLE beacon) can land in the same domain without UI rework.

## Already in place

- `enterprise_attendance_segments.source` column — accepts `'manual'` (current default) or `'device'`.
- `enterprise_attendance_segments.device_event_id` column — reserved FK pointing at the (future) `enterprise_attendance_device_events` raw event table.
- All read paths (admin overview, payroll export, employee summary) are agnostic to `source` — they sum on `(starts_at, ends_at)`.
- The state machine and audit trail apply equally to device-sourced segments.

## Recommended next-step schema

```sql
CREATE TYPE enterprise_attendance_device_event_kind AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');

CREATE TABLE enterprise_attendance_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,                     -- auth.users.id
  membership_id uuid,                         -- resolved at write time
  device_id text NOT NULL,                    -- stable id of the reader / app instance
  device_kind text NOT NULL,                  -- 'badge' | 'nfc' | 'mobile' | 'web_kiosk'
  event_kind enterprise_attendance_device_event_kind NOT NULL,
  occurred_at timestamptz NOT NULL,
  raw_payload jsonb,                          -- vendor blob for forensics
  ingested_at timestamptz NOT NULL DEFAULT now(),
  paired_segment_id uuid REFERENCES enterprise_attendance_segments(id) ON DELETE SET NULL,
  pairing_status text NOT NULL DEFAULT 'pending', -- 'pending' | 'paired' | 'orphan' | 'rejected'
  reject_reason text
);
```

The `paired_segment_id` and `paired_segment_id`-side `device_event_id` on segments form the bridge: one **clock_in / clock_out pair** produces **one segment**.

## Pairing rule

```
  events sorted by (user, occurred_at):
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ clock_in @T1 │ → │ clock_out@T2 │ → │ clock_in @T3 │ → │ clock_out@T4 │
  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
       │                   │                   │                   │
       └────── seg A ──────┘                   └────── seg B ──────┘
              starts_at=T1, ends_at=T2                starts_at=T3, ends_at=T4
              source='device', segment_type='regular' (default)
```

A `clock_in` without a matching `clock_out` within 24h becomes `pairing_status='orphan'` and shows up in an admin reconciliation panel.

## Coexistence with manual entries

Two strategies, configurable per workspace:

1. **Device wins** — when a device segment overlaps a manual one, the manual one is auto-soft-deleted (audited) and replaced by the device segment.
2. **Manual wins** — manual segments are authoritative; device segments that overlap are flagged for review but not inserted.

The state machine remains intact: device segments can only land in `draft` or `returned` periods. The `submitted` → `locked` chain blocks all further writes regardless of source.

## Edge function for ingestion

A future edge function `attendance-ingest-device` will:

1. Verify a device-issued JWT or signed webhook payload.
2. Resolve `user_id` from the badge id (lookup table TBD).
3. Open or create the relevant period (`attendance_get_or_create_period`).
4. Insert a `device_event`, then attempt pairing.
5. On pair success, call a new RPC `attendance_materialize_device_pair(p_event_in_id, p_event_out_id)` that:
   - inserts a segment with `source='device'`,
   - sets `device_event_id` on the segment,
   - sets `paired_segment_id` on both events,
   - emits an audit event,
   - recomputes totals.

Authorization: the Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`; the new RPC is `SECURITY DEFINER` and is callable only from service role / admin RLS context.

## Backfill, deduplication, and forensics

- `raw_payload` is kept verbatim for forensics.
- `ingested_at` vs `occurred_at` lets you spot delayed batch syncs (offline mobile devices).
- A `(workspace_id, user_id, occurred_at, event_kind, device_id)` partial unique index prevents accidental duplicates on retry.

## Migration strategy

When hardware ingestion goes live:

1. Ship the `enterprise_attendance_device_events` migration.
2. Ship the ingestion Edge Function (no UI change).
3. Add an admin reconciliation panel listing `pairing_status='orphan'` events.
4. Optionally enable per-workspace "device-wins" preference in `enterprise_workspaces.settings`.

No change to the existing employee or admin UIs is required for the device path to start working — they will simply see additional segments labelled with a small "device" badge (extending `DayEditorDialog`).
