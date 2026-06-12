-- Phase 7: isolated Agent 4 audits for agent3_locked_outputs (parallel path).
-- Does not replace product_qa; old Agent 2 → Agent 3 → Agent 4 path unchanged.

begin;

create table if not exists public.agent4_locked_audits (
  locked_audit_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  locked_output_id uuid not null references public.agent3_locked_outputs (locked_output_id) on delete restrict,
  locked_input_id uuid not null,
  lock_hash text not null,
  input_source text not null default 'agent3_locked_output',
  methodology_version text not null,
  material_lookup_version text not null,
  audit_status text not null,
  audit_payload jsonb not null,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  consistency_checks jsonb not null default '[]'::jsonb,
  created_by_system text not null default 'system:agent4-locked-audit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  supersedes_audit_id uuid references public.agent4_locked_audits (locked_audit_id) on delete set null,
  superseded_by_audit_id uuid references public.agent4_locked_audits (locked_audit_id) on delete set null,

  constraint agent4_locked_audits_input_source_allowed check (
    input_source = 'agent3_locked_output'
  ),
  constraint agent4_locked_audits_audit_status_allowed check (
    audit_status in ('draft', 'pending_review', 'passed', 'failed', 'rejected', 'superseded')
  ),
  constraint agent4_locked_audits_audit_payload_is_object check (
    jsonb_typeof(audit_payload) = 'object'
  ),
  constraint agent4_locked_audits_blockers_is_array check (
    jsonb_typeof(blockers) = 'array'
  ),
  constraint agent4_locked_audits_warnings_is_array check (
    jsonb_typeof(warnings) = 'array'
  ),
  constraint agent4_locked_audits_consistency_checks_is_array check (
    jsonb_typeof(consistency_checks) = 'array'
  )
);

create index if not exists agent4_locked_audits_product_id_idx
  on public.agent4_locked_audits (product_id);

create index if not exists agent4_locked_audits_locked_output_id_idx
  on public.agent4_locked_audits (locked_output_id);

create index if not exists agent4_locked_audits_audit_status_idx
  on public.agent4_locked_audits (audit_status);

create index if not exists agent4_locked_audits_created_at_idx
  on public.agent4_locked_audits (created_at desc);

comment on table public.agent4_locked_audits is
  'Agent 4 audit of agent3_locked_outputs (parallel opt-in path). Not product_qa; not publish-eligible in Phase 7.';

comment on column public.agent4_locked_audits.input_source is
  'Agent 4 input provenance: always agent3_locked_output (distinct from agent3_locked_outputs.input_source = locked_input_package).';

comment on column public.agent4_locked_audits.audit_payload is
  'Structured audit summary: provenance, score snapshot, check counts. Read-only; never mutates locked output.';

alter table public.agent4_locked_audits enable row level security;

drop policy if exists agent4_locked_audits_admin_all on public.agent4_locked_audits;
create policy agent4_locked_audits_admin_all on public.agent4_locked_audits
  for all
  using (true)
  with check (true);

commit;
