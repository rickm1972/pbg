-- Agent 3: product_scores + V2.3.3 five-tier alignment on products

begin;

-- Align products.tier with Algorithm V2.3.3 (5 tiers)
alter table public.products
  drop constraint if exists products_tier_allowed;

alter table public.products
  add constraint products_tier_allowed check (
    tier is null
    or tier in ('Excellent', 'Good', 'Caution', 'Concern', 'High Risk')
  );

create table if not exists public.product_scores (
  score_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  input_id uuid references public.scoring_inputs (input_id) on delete set null,

  pac_safety_score integer not null,
  tier text not null,
  displayed_confidence_range text,
  transparency_badge text,
  weighted_npr numeric(8, 4) not null,
  component_nprs jsonb not null,
  escalator_applied text,
  layer_4a_net integer not null,
  ingredient_transparency_score integer,
  explanation_draft text,

  algorithm_version text not null default '2.3.3',
  run_timestamp timestamptz not null default now(),

  review_status text not null default 'pending_review',
  reviewer text,
  review_timestamp timestamptz,
  review_notes text,

  constraint product_scores_pac_safety_score_range check (
    pac_safety_score >= 0 and pac_safety_score <= 100
  ),
  constraint product_scores_tier_allowed check (
    tier in ('Excellent', 'Good', 'Caution', 'Concern', 'High Risk')
  ),
  constraint product_scores_review_status_allowed check (
    review_status in (
      'pending_review',
      'approved',
      'rejected',
      'superseded'
    )
  ),
  constraint product_scores_component_nprs_is_object check (
    jsonb_typeof(component_nprs) = 'object'
  ),
  constraint product_scores_ingredient_transparency_score_range check (
    ingredient_transparency_score is null
    or (ingredient_transparency_score >= 0 and ingredient_transparency_score <= 100)
  )
);

create index if not exists product_scores_product_id_idx
  on public.product_scores (product_id);

create index if not exists product_scores_input_id_idx
  on public.product_scores (input_id);

create index if not exists product_scores_review_status_idx
  on public.product_scores (review_status);

create index if not exists product_scores_run_timestamp_idx
  on public.product_scores (run_timestamp desc);

comment on table public.product_scores is
  'Agent 3 scoring output: PAC score, tier, NPR breakdown, and human review state per run.';

comment on column public.product_scores.input_id is
  'Approved scoring_inputs row used for this run; null if source input was deleted.';

comment on column public.product_scores.component_nprs is
  'Per-component NPR breakdown and related scoring fields (JSON object).';

comment on column public.product_scores.ingredient_transparency_score is
  'Formulation products only; null for non-formulation items.';

comment on column public.product_scores.explanation_draft is
  'Draft consumer-facing explanation; finalized after QA review.';

alter table public.product_scores enable row level security;

drop policy if exists "Admin manage product_scores" on public.product_scores;
create policy "Admin manage product_scores"
on public.product_scores
for all
to authenticated
using (true)
with check (true);

commit;
