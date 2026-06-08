-- Phase 1 APR: immutable gate snapshots + assembled approved product records.
-- Snapshots are never mutated in place; downstream gates reference upstream content hashes.

begin;

create table if not exists public.apr_gate_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  gate text not null check (gate in ('evidence', 'normalization', 'display', 'score', 'qa')),
  schema_version text not null,
  content_hash text not null,
  parent_hashes jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint apr_gate_snapshots_product_gate_hash_uidx unique (product_id, gate, content_hash)
);

comment on table public.apr_gate_snapshots is
  'Immutable approved gate sub-records. Each row is content-addressed; approved rows are never updated in place.';

create index if not exists apr_gate_snapshots_product_gate_idx
  on public.apr_gate_snapshots (product_id, gate, approved_at desc);

create table if not exists public.approved_product_records (
  apr_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  schema_version text not null,
  assembled_content_hash text not null,
  evidence_snapshot_id uuid not null references public.apr_gate_snapshots (snapshot_id),
  normalization_snapshot_id uuid not null references public.apr_gate_snapshots (snapshot_id),
  display_snapshot_id uuid not null references public.apr_gate_snapshots (snapshot_id),
  score_snapshot_id uuid not null references public.apr_gate_snapshots (snapshot_id),
  qa_snapshot_id uuid not null references public.apr_gate_snapshots (snapshot_id),
  assembled_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.approved_product_records is
  'Latest fully-approved APR per product. Public page renders only is_current=true records with consistent hash chain.';

create unique index if not exists approved_product_records_one_current_per_product_uidx
  on public.approved_product_records (product_id)
  where is_current = true;

create index if not exists approved_product_records_product_assembled_idx
  on public.approved_product_records (product_id, assembled_at desc);

commit;
