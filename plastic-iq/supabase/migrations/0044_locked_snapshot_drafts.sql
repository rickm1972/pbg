-- Phase 8: isolated locked-chain snapshot drafts (unpublished preview).
-- Does not alter published_display_snapshots or publish path.

begin;

create table if not exists public.locked_snapshot_drafts (
  locked_snapshot_draft_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  locked_input_id uuid not null,
  locked_output_id uuid not null references public.agent3_locked_outputs (locked_output_id) on delete restrict,
  locked_audit_id uuid not null references public.agent4_locked_audits (locked_audit_id) on delete restrict,
  lock_hash text not null,
  input_source text not null default 'agent4_locked_audit',
  methodology_version text not null,
  material_lookup_version text not null,
  snapshot_payload jsonb not null,
  display_payload jsonb not null,
  score_payload jsonb not null,
  math_breakdown jsonb not null,
  audit_summary jsonb not null,
  draft_status text not null default 'draft',
  created_by_system text not null default 'system:locked-snapshot-draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  supersedes_draft_id uuid references public.locked_snapshot_drafts (locked_snapshot_draft_id) on delete set null,
  superseded_by_draft_id uuid references public.locked_snapshot_drafts (locked_snapshot_draft_id) on delete set null,

  constraint locked_snapshot_drafts_input_source_allowed check (
    input_source = 'agent4_locked_audit'
  ),
  constraint locked_snapshot_drafts_draft_status_allowed check (
    draft_status in ('draft', 'ready_for_review', 'approved_for_future_publish', 'rejected', 'superseded')
  ),
  constraint locked_snapshot_drafts_snapshot_payload_is_object check (
    jsonb_typeof(snapshot_payload) = 'object'
  ),
  constraint locked_snapshot_drafts_display_payload_is_object check (
    jsonb_typeof(display_payload) = 'object'
  ),
  constraint locked_snapshot_drafts_score_payload_is_object check (
    jsonb_typeof(score_payload) = 'object'
  ),
  constraint locked_snapshot_drafts_math_breakdown_is_object check (
    jsonb_typeof(math_breakdown) = 'object'
  ),
  constraint locked_snapshot_drafts_audit_summary_is_object check (
    jsonb_typeof(audit_summary) = 'object'
  )
);

create index if not exists locked_snapshot_drafts_product_id_idx
  on public.locked_snapshot_drafts (product_id);

create index if not exists locked_snapshot_drafts_locked_audit_id_idx
  on public.locked_snapshot_drafts (locked_audit_id);

create index if not exists locked_snapshot_drafts_draft_status_idx
  on public.locked_snapshot_drafts (draft_status);

create index if not exists locked_snapshot_drafts_created_at_idx
  on public.locked_snapshot_drafts (created_at desc);

comment on table public.locked_snapshot_drafts is
  'Unpublished snapshot draft from locked Agent 1→3→4 chain. Not published_display_snapshots; not public-visible in Phase 8.';

alter table public.locked_snapshot_drafts enable row level security;

drop policy if exists locked_snapshot_drafts_admin_all on public.locked_snapshot_drafts;
create policy locked_snapshot_drafts_admin_all on public.locked_snapshot_drafts
  for all
  using (true)
  with check (true);

commit;
