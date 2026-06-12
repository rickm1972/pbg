-- Phase 6.7: isolated Agent 3 outputs from locked-input packages (parallel path).
-- Does not replace product_scores; old Agent 2 → Agent 3 path unchanged.

begin;

create table if not exists public.agent3_locked_outputs (
  locked_output_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  locked_input_id uuid not null references public.agent1_locked_inputs (locked_input_id) on delete restrict,
  lock_hash text not null,
  input_source text not null default 'locked_input_package',
  methodology_version text not null,
  material_lookup_version text not null,
  score_payload jsonb not null,
  math_breakdown jsonb not null,
  display_payload jsonb,
  review_status text not null default 'pending_review',
  created_by_system text not null default 'system:agent3-locked-input',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  supersedes_output_id uuid references public.agent3_locked_outputs (locked_output_id) on delete set null,
  superseded_by_output_id uuid references public.agent3_locked_outputs (locked_output_id) on delete set null,

  constraint agent3_locked_outputs_input_source_allowed check (
    input_source = 'locked_input_package'
  ),
  constraint agent3_locked_outputs_review_status_allowed check (
    review_status in ('draft', 'pending_review', 'approved', 'rejected', 'superseded')
  ),
  constraint agent3_locked_outputs_score_payload_is_object check (
    jsonb_typeof(score_payload) = 'object'
  ),
  constraint agent3_locked_outputs_math_breakdown_is_object check (
    jsonb_typeof(math_breakdown) = 'object'
  ),
  constraint agent3_locked_outputs_display_payload_is_object check (
    display_payload is null or jsonb_typeof(display_payload) = 'object'
  )
);

create index if not exists agent3_locked_outputs_product_id_idx
  on public.agent3_locked_outputs (product_id);

create index if not exists agent3_locked_outputs_locked_input_id_idx
  on public.agent3_locked_outputs (locked_input_id);

create index if not exists agent3_locked_outputs_review_status_idx
  on public.agent3_locked_outputs (review_status);

create index if not exists agent3_locked_outputs_created_at_idx
  on public.agent3_locked_outputs (created_at desc);

comment on table public.agent3_locked_outputs is
  'Agent 3 score/display output from agent1_locked_inputs (parallel opt-in path). Not product_scores; not publish-eligible in Phase 6.7.';

comment on column public.agent3_locked_outputs.score_payload is
  'Final score, tier, badge, weighted NPR, Layer 4A, cap — derived from frozen locked values only.';

comment on column public.agent3_locked_outputs.math_breakdown is
  'Per-component NPR breakdown and weighted NPR trail for Gate 3 review.';

comment on column public.agent3_locked_outputs.display_payload is
  'Minimal display draft for review UI; not used by public product pages in Phase 6.7.';

alter table public.agent3_locked_outputs enable row level security;

drop policy if exists agent3_locked_outputs_admin_all on public.agent3_locked_outputs;
create policy agent3_locked_outputs_admin_all on public.agent3_locked_outputs
  for all
  using (true)
  with check (true);

commit;
