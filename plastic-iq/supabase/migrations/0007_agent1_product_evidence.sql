-- Agent 1 storage: product_evidence + products.agent_status
-- PlasticBegone four-agent pipeline (evidence stage first)
--
-- Decisions:
--   - JSONB facts[] and sources[] (not row-per-fact)
--   - Full agent_status enum for all four agents
--   - product_evidence is admin-only (no public SELECT policy)
--   - Existing products default to agent_status = 'unscored'

begin;

-- ---------------------------------------------------------------------------
-- 1) Pipeline position on existing products row
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists agent_status text not null default 'unscored';

comment on column public.products.agent_status is
  'Four-agent pipeline state; independent of active (public visibility).';

alter table public.products
  drop constraint if exists products_agent_status_allowed;

alter table public.products
  add constraint products_agent_status_allowed check (
    agent_status in (
      'unscored',
      'evidence_pending',
      'evidence_in_progress',
      'evidence_awaiting_review',
      'evidence_approved',
      'evidence_rejected',
      'normalization_pending',
      'normalization_in_progress',
      'normalization_awaiting_review',
      'normalization_approved',
      'normalization_rejected',
      'scoring_pending',
      'scoring_in_progress',
      'scoring_awaiting_review',
      'scoring_approved',
      'scoring_rejected',
      'qa_pending',
      'qa_in_progress',
      'qa_awaiting_review',
      'qa_approved',
      'qa_rejected',
      'ready_for_publish',
      'published'
    )
  );

-- Legacy catalog rows (live before pipeline): keep as unscored, not published.
update public.products
set agent_status = 'unscored'
where agent_status is distinct from 'unscored';

create index if not exists products_agent_status_idx
  on public.products (agent_status);

-- ---------------------------------------------------------------------------
-- 2) Agent 1 evidence bundles (facts only — no scores)
-- ---------------------------------------------------------------------------
create table if not exists public.product_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,

  bundle_version integer not null default 1,

  review_status text not null default 'draft',
  constraint product_evidence_review_status_allowed check (
    review_status in (
      'draft',
      'submitted',
      'approved',
      'rejected',
      'superseded'
    )
  ),

  algorithm_version text not null default 'v2.3.3',

  -- Research sources: manufacturer, retailer, PDF, SDS, ingredient page, etc.
  -- [{ "source_type", "url", "title", "fetched_at" }, ...]
  sources jsonb not null default '[]'::jsonb,

  -- Extracted facts only (no PAC score). Shape evolves with Agent 1.
  -- [{ "fact_type", "fact_key", "fact_value", "confidence", "source_index", "excerpt" }, ...]
  facts jsonb not null default '[]'::jsonb,

  agent_metadata jsonb not null default '{}'::jsonb,

  reviewer_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_evidence_bundle_version_positive check (bundle_version > 0),
  constraint product_evidence_sources_is_array check (jsonb_typeof(sources) = 'array'),
  constraint product_evidence_facts_is_array check (jsonb_typeof(facts) = 'array'),
  constraint product_evidence_agent_metadata_is_object check (jsonb_typeof(agent_metadata) = 'object'),

  unique (product_id, bundle_version)
);

create index if not exists product_evidence_product_id_idx
  on public.product_evidence (product_id);

create index if not exists product_evidence_review_status_idx
  on public.product_evidence (review_status);

create index if not exists product_evidence_product_review_idx
  on public.product_evidence (product_id, review_status);

create or replace function public.set_product_evidence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_product_evidence_set_updated_at on public.product_evidence;
create trigger trg_product_evidence_set_updated_at
before update on public.product_evidence
for each row
execute function public.set_product_evidence_updated_at();

-- ---------------------------------------------------------------------------
-- 3) RLS — admin-only (no public read; evidence is internal pipeline data)
-- ---------------------------------------------------------------------------
alter table public.product_evidence enable row level security;

drop policy if exists "Public read approved evidence for published products" on public.product_evidence;

drop policy if exists "Admin manage product_evidence" on public.product_evidence;
create policy "Admin manage product_evidence"
on public.product_evidence
for all
to authenticated
using (true)
with check (true);

commit;
