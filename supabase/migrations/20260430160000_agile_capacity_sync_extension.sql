-- Agile capacity sync extension (additive, backward compatible)

create table if not exists public.enterprise_agile_external_field_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.enterprise_workspaces(id) on delete cascade,
  integration_id uuid not null references public.enterprise_workspace_integrations(id) on delete cascade,
  provider text not null,
  external_field_id text not null,
  normalized_field text not null,
  sync_direction text not null default 'in' check (sync_direction in ('in','out','both')),
  is_required boolean not null default false,
  is_safe_writeback boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_id, external_field_id, normalized_field)
);

create table if not exists public.enterprise_agile_capacity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.enterprise_workspaces(id) on delete cascade,
  integration_id uuid not null references public.enterprise_workspace_integrations(id) on delete cascade,
  issue_key text,
  event_type text not null check (event_type in ('change','capacity','variance','risk','writeback','simulation')),
  impact_summary text not null,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  details jsonb not null default '{}'::jsonb,
  auto_action_taken text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_ea_events_workspace_created on public.enterprise_agile_capacity_events(workspace_id, created_at desc);
create index if not exists idx_ea_events_integration_created on public.enterprise_agile_capacity_events(integration_id, created_at desc);

alter table public.enterprise_agile_issues
  add column if not exists capacity_risk text,
  add column if not exists fit_score numeric,
  add column if not exists suggested_role text,
  add column if not exists plan_impact_reason text,
  add column if not exists external_type text,
  add column if not exists target_sprint text;

alter table public.enterprise_agile_external_field_mappings enable row level security;
alter table public.enterprise_agile_capacity_events enable row level security;

drop policy if exists "agile_field_mappings_select" on public.enterprise_agile_external_field_mappings;
create policy "agile_field_mappings_select" on public.enterprise_agile_external_field_mappings
for select to authenticated
using (public.is_enterprise_member(workspace_id, auth.uid()));

drop policy if exists "agile_field_mappings_modify" on public.enterprise_agile_external_field_mappings;
create policy "agile_field_mappings_modify" on public.enterprise_agile_external_field_mappings
for all to authenticated
using (public.has_enterprise_role(workspace_id, auth.uid(), array['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]))
with check (public.has_enterprise_role(workspace_id, auth.uid(), array['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]));

drop policy if exists "agile_capacity_events_select" on public.enterprise_agile_capacity_events;
create policy "agile_capacity_events_select" on public.enterprise_agile_capacity_events
for select to authenticated
using (public.is_enterprise_member(workspace_id, auth.uid()));

drop policy if exists "agile_capacity_events_insert" on public.enterprise_agile_capacity_events;
create policy "agile_capacity_events_insert" on public.enterprise_agile_capacity_events
for insert to authenticated
with check (public.has_enterprise_role(workspace_id, auth.uid(), array['owner'::public.enterprise_role,'resourceAssistant'::public.enterprise_role]));

