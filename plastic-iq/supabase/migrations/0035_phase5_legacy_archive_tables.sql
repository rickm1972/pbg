-- Phase 5: archive tables for legacy pipeline data (audit/rollback only).
-- NOT connected to scoring, publishing, or Gate 1–4 review.

begin;

create table if not exists public.legacy_do_not_use_for_scoring_product_evidence (
  like public.product_evidence including defaults excluding constraints
);

alter table public.legacy_do_not_use_for_scoring_product_evidence
  add column if not exists archived_at timestamptz not null default now();

alter table public.legacy_do_not_use_for_scoring_product_evidence
  add column if not exists archive_reason text not null default 'phase5_pipeline_reset';

comment on table public.legacy_do_not_use_for_scoring_product_evidence is
  'ARCHIVE ONLY (legacy_do_not_use_for_scoring). Pre–Phase 5 product_evidence rows. Do not use for scoring, publishing, or review.';

create table if not exists public.legacy_do_not_use_for_scoring_scoring_inputs (
  like public.scoring_inputs including defaults excluding constraints
);

alter table public.legacy_do_not_use_for_scoring_scoring_inputs
  add column if not exists archived_at timestamptz not null default now();

alter table public.legacy_do_not_use_for_scoring_scoring_inputs
  add column if not exists archive_reason text not null default 'phase5_pipeline_reset';

comment on table public.legacy_do_not_use_for_scoring_scoring_inputs is
  'ARCHIVE ONLY (legacy_do_not_use_for_scoring). Pre–Phase 5 scoring_inputs rows.';

create table if not exists public.legacy_do_not_use_for_scoring_product_scores (
  like public.product_scores including defaults excluding constraints
);

alter table public.legacy_do_not_use_for_scoring_product_scores
  add column if not exists archived_at timestamptz not null default now();

alter table public.legacy_do_not_use_for_scoring_product_scores
  add column if not exists archive_reason text not null default 'phase5_pipeline_reset';

comment on table public.legacy_do_not_use_for_scoring_product_scores is
  'ARCHIVE ONLY (legacy_do_not_use_for_scoring). Pre–Phase 5 product_scores rows.';

create table if not exists public.legacy_do_not_use_for_scoring_product_qa (
  like public.product_qa including defaults excluding constraints
);

alter table public.legacy_do_not_use_for_scoring_product_qa
  add column if not exists archived_at timestamptz not null default now();

alter table public.legacy_do_not_use_for_scoring_product_qa
  add column if not exists archive_reason text not null default 'phase5_pipeline_reset';

comment on table public.legacy_do_not_use_for_scoring_product_qa is
  'ARCHIVE ONLY (legacy_do_not_use_for_scoring). Pre–Phase 5 product_qa rows.';

-- No RLS policies: service-role / migration scripts only (not in public app path)
alter table public.legacy_do_not_use_for_scoring_product_evidence enable row level security;
alter table public.legacy_do_not_use_for_scoring_scoring_inputs enable row level security;
alter table public.legacy_do_not_use_for_scoring_product_scores enable row level security;
alter table public.legacy_do_not_use_for_scoring_product_qa enable row level security;

revoke all on public.legacy_do_not_use_for_scoring_product_evidence from anon, authenticated;
revoke all on public.legacy_do_not_use_for_scoring_scoring_inputs from anon, authenticated;
revoke all on public.legacy_do_not_use_for_scoring_product_scores from anon, authenticated;
revoke all on public.legacy_do_not_use_for_scoring_product_qa from anon, authenticated;

grant select on public.legacy_do_not_use_for_scoring_product_evidence to service_role;
grant select on public.legacy_do_not_use_for_scoring_scoring_inputs to service_role;
grant select on public.legacy_do_not_use_for_scoring_product_scores to service_role;
grant select on public.legacy_do_not_use_for_scoring_product_qa to service_role;

commit;
