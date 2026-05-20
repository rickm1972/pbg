-- Agent 4: product_qa audit reports (read-only QA of evidence → score chain)

begin;

create table if not exists public.product_qa (
  qa_id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products (product_id) on delete cascade,

  evidence_id uuid not null
    references public.product_evidence (evidence_id) on delete restrict,
  input_id uuid not null
    references public.scoring_inputs (input_id) on delete restrict,
  score_id uuid not null
    references public.product_scores (score_id) on delete restrict,

  algorithm_version text not null default '2.3.3',
  agent_version text not null default '4.0.0',
  run_timestamp timestamptz not null default now(),

  overall_status text not null,
  human_review_required boolean not null default true,

  checks jsonb not null default '{}'::jsonb,
  certifications_verified jsonb not null default '[]'::jsonb,

  review_status text not null default 'pending_review',
  reviewer text,
  review_timestamp timestamptz,
  review_notes text,

  warnings text[] not null default '{}',

  constraint product_qa_overall_status_allowed check (
    overall_status in ('pass', 'flag', 'error')
  ),
  constraint product_qa_review_status_allowed check (
    review_status in ('pending_review', 'approved', 'rejected', 'superseded')
  ),
  constraint product_qa_checks_is_object check (jsonb_typeof(checks) = 'object'),
  constraint product_qa_certifications_verified_is_array check (
    jsonb_typeof(certifications_verified) = 'array'
  )
);

create unique index if not exists product_qa_score_id_uidx
  on public.product_qa (score_id);

create index if not exists product_qa_product_id_idx
  on public.product_qa (product_id);

create index if not exists product_qa_review_status_idx
  on public.product_qa (review_status);

create index if not exists product_qa_human_review_required_idx
  on public.product_qa (human_review_required)
  where human_review_required = true;

create index if not exists product_qa_overall_status_idx
  on public.product_qa (overall_status);

comment on table public.product_qa is
  'Agent 4 QA audit: read-only validation of evidence → normalization → score chain.';

comment on column public.product_qa.checks is
  'JSON: certification_audit, layer_4a_audit, score_sanity, evidence_gaps, explanation_accuracy.';

comment on column public.product_qa.certifications_verified is
  'Product-level certs that passed Check 1; does not mutate product_evidence.';

alter table public.product_qa enable row level security;

drop policy if exists "Admin manage product_qa" on public.product_qa;
create policy "Admin manage product_qa"
on public.product_qa
for all
to authenticated
using (true)
with check (true);

commit;
