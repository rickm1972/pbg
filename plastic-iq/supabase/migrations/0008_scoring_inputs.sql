-- Agent 2: scoring_inputs (normalization output for Algorithm V2.3.3)
-- normalization_* agent_status values already exist on products (0007).

begin;

create table if not exists public.scoring_inputs (
  input_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  evidence_id uuid not null references public.product_evidence (evidence_id) on delete cascade,
  agent_version text,
  algorithm_version text not null default '2.3.3',
  run_timestamp timestamptz not null default now(),
  inputs jsonb not null,
  review_status text not null default 'submitted',
  human_reviewer text,
  review_timestamp timestamptz,
  review_notes text,
  human_review_required boolean not null default false,
  human_review_reason text,

  constraint scoring_inputs_review_status_allowed check (
    review_status in (
      'draft',
      'submitted',
      'approved',
      'rejected',
      'superseded'
    )
  ),
  constraint scoring_inputs_inputs_is_object check (jsonb_typeof(inputs) = 'object')
);

create index if not exists scoring_inputs_product_id_idx
  on public.scoring_inputs (product_id);

create index if not exists scoring_inputs_evidence_id_idx
  on public.scoring_inputs (evidence_id);

create index if not exists scoring_inputs_review_status_idx
  on public.scoring_inputs (review_status);

comment on table public.scoring_inputs is
  'Agent 2 normalization output: structured scoring inputs for Algorithm V2.3.3 (no math).';

alter table public.scoring_inputs enable row level security;

drop policy if exists "Admin manage scoring_inputs" on public.scoring_inputs;
create policy "Admin manage scoring_inputs"
on public.scoring_inputs
for all
to authenticated
using (true)
with check (true);

commit;
