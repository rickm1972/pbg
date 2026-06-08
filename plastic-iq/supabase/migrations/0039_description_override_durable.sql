-- Part C.1: durable description override records + approved snapshot version metadata.
-- Baseline JSON snapshots remain immutable; approved override versions persist in published_display_snapshots.

begin;

create table if not exists public.description_override_records (
  override_id text primary key,
  product_id uuid not null references public.products (product_id) on delete cascade,
  field text not null default 'product_description' check (field = 'product_description'),
  previous_snapshot_id text not null,
  proposed_override_text text not null,
  status text not null check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  created_by text,
  created_at timestamptz not null,
  reviewed_by text,
  reviewed_at timestamptz,
  resulting_snapshot_id text,
  validation jsonb,
  negative_score_gate_result jsonb,
  notes text,
  updated_at timestamptz not null default now()
);

comment on table public.description_override_records is
  'Admin description override workflow metadata. Draft/pending do not affect public render; approved links to a new published_display_snapshots row.';

create index if not exists description_override_records_product_status_idx
  on public.description_override_records (product_id, status, updated_at desc);

alter table public.published_display_snapshots
  add column if not exists source_snapshot_id text,
  add column if not exists version_sequence integer,
  add column if not exists reason text,
  add column if not exists override_id text references public.description_override_records (override_id),
  add column if not exists approved_by text;

comment on column public.published_display_snapshots.source_snapshot_id is
  'Prior snapshot_id this version was derived from (baseline or previous approved version).';
comment on column public.published_display_snapshots.version_sequence is
  'Monotonic per-product version number; baseline JSON is not stored here.';
comment on column public.published_display_snapshots.reason is
  'Why this snapshot version exists, e.g. description_override.';
comment on column public.published_display_snapshots.override_id is
  'Link to description_override_records when reason = description_override.';

commit;
