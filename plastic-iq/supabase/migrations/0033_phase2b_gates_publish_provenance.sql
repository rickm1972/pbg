-- Phase 2B: Gate 2/3 approval RPCs, immutability, naming alignment, publish chain gate, published_at.

begin;

-- ---------------------------------------------------------------------------
-- 1) product_evidence: submitted_at → pending_review_at
-- ---------------------------------------------------------------------------
alter table public.product_evidence
  rename column submitted_at to pending_review_at;

comment on column public.product_evidence.pending_review_at is
  'When Agent 1 saved this version for human review (formerly submitted_at).';

-- ---------------------------------------------------------------------------
-- 2) scoring_inputs: submitted → pending_review + approved_at
-- ---------------------------------------------------------------------------
alter table public.scoring_inputs
  drop constraint if exists scoring_inputs_review_status_allowed;

update public.scoring_inputs
set review_status = 'pending_review'
where review_status = 'submitted';

alter table public.scoring_inputs
  add constraint scoring_inputs_review_status_allowed check (
    review_status in (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'superseded'
    )
  );

alter table public.scoring_inputs
  alter column review_status set default 'pending_review';

alter table public.scoring_inputs
  add column if not exists approved_at timestamptz;

comment on column public.scoring_inputs.approved_at is
  'Set when normalization is approved (Gate 2).';

-- Dedupe: supersede duplicate approved scoring_inputs (keep latest run)
update public.scoring_inputs si
set review_status = 'superseded'
from (
  select distinct on (product_id)
    product_id,
    input_id as keep_id
  from public.scoring_inputs
  where review_status = 'approved'
  order by product_id, run_timestamp desc nulls last
) keeper
where si.product_id = keeper.product_id
  and si.review_status = 'approved'
  and si.input_id <> keeper.keep_id;

create unique index if not exists scoring_inputs_one_approved_per_product_uidx
  on public.scoring_inputs (product_id)
  where review_status = 'approved';

-- ---------------------------------------------------------------------------
-- 3) product_scores: approved_at + dedupe approved rows
-- ---------------------------------------------------------------------------
alter table public.product_scores
  add column if not exists approved_at timestamptz;

comment on column public.product_scores.approved_at is
  'Set when score is approved (Gate 3).';

update public.product_scores ps
set review_status = 'superseded'
from (
  select distinct on (product_id)
    product_id,
    score_id as keep_id
  from public.product_scores
  where review_status = 'approved'
  order by product_id, run_timestamp desc nulls last
) keeper
where ps.product_id = keeper.product_id
  and ps.review_status = 'approved'
  and ps.score_id <> keeper.keep_id;

create unique index if not exists product_scores_one_approved_per_product_uidx
  on public.product_scores (product_id)
  where review_status = 'approved';

-- ---------------------------------------------------------------------------
-- 4) products.published_at
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists published_at timestamptz;

comment on column public.products.published_at is
  'Set when publish_status becomes published; cleared when unpublished or draft.';

-- ---------------------------------------------------------------------------
-- 5) Update evidence immutability trigger for pending_review_at
-- ---------------------------------------------------------------------------
create or replace function public.guard_product_evidence_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.review_status in ('approved', 'superseded') then
      raise exception 'Cannot delete evidence version % (status %)', old.evidence_id, old.review_status;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'approved' then
    if new.review_status = 'superseded'
      and new.product_id = old.product_id
      and new.bundle_version = old.bundle_version
      and new.sources is not distinct from old.sources
      and new.facts is not distinct from old.facts
      and new.agent_metadata is not distinct from old.agent_metadata
      and new.field_provenance is not distinct from old.field_provenance
      and new.algorithm_version = old.algorithm_version
      and new.pending_review_at is not distinct from old.pending_review_at
      and new.approved_at is not distinct from old.approved_at
      and new.reviewed_at is not distinct from old.reviewed_at
      and new.reviewed_by is not distinct from old.reviewed_by
      and new.reviewer_notes is not distinct from old.reviewer_notes
    then
      return new;
    end if;
    raise exception 'Approved evidence % is immutable; create a new draft version instead', old.evidence_id;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'superseded' then
    raise exception 'Superseded evidence % is immutable', old.evidence_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) guard_scoring_inputs_immutable
-- ---------------------------------------------------------------------------
create or replace function public.guard_scoring_inputs_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.review_status in ('approved', 'superseded') then
      raise exception 'Cannot delete scoring_inputs % (status %)', old.input_id, old.review_status;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'approved' then
    if new.review_status = 'superseded'
      and new.product_id = old.product_id
      and new.evidence_id = old.evidence_id
      and new.inputs is not distinct from old.inputs
      and new.agent_version is not distinct from old.agent_version
      and new.algorithm_version is not distinct from old.algorithm_version
      and new.human_review_required = old.human_review_required
      and new.human_review_reason is not distinct from old.human_review_reason
      and new.primary_material_options is not distinct from old.primary_material_options
      and new.secondary_materials_options is not distinct from old.secondary_materials_options
      and new.coatings_finishes_options is not distinct from old.coatings_finishes_options
      and new.use_conditions_options is not distinct from old.use_conditions_options
      and new.disclosure_quality_options is not distinct from old.disclosure_quality_options
      and new.certifications_options is not distinct from old.certifications_options
      and new.approved_at is not distinct from old.approved_at
      and new.review_timestamp is not distinct from old.review_timestamp
      and new.human_reviewer is not distinct from old.human_reviewer
      and new.review_notes is not distinct from old.review_notes
    then
      return new;
    end if;
    raise exception 'Approved scoring_inputs % is immutable; create a new pending version instead', old.input_id;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'superseded' then
    raise exception 'Superseded scoring_inputs % is immutable', old.input_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_scoring_inputs_immutable on public.scoring_inputs;
create trigger trg_scoring_inputs_immutable
before update or delete on public.scoring_inputs
for each row
execute function public.guard_scoring_inputs_immutable();

-- ---------------------------------------------------------------------------
-- 7) guard_product_scores_immutable
-- ---------------------------------------------------------------------------
create or replace function public.guard_product_scores_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.review_status in ('approved', 'superseded') then
      raise exception 'Cannot delete product_scores % (status %)', old.score_id, old.review_status;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'approved' then
    if new.review_status = 'superseded'
      and new.product_id = old.product_id
      and new.input_id is not distinct from old.input_id
      and new.pac_safety_score = old.pac_safety_score
      and new.tier = old.tier
      and new.displayed_confidence_range is not distinct from old.displayed_confidence_range
      and new.transparency_badge is not distinct from old.transparency_badge
      and new.weighted_npr = old.weighted_npr
      and new.component_nprs is not distinct from old.component_nprs
      and new.escalator_applied is not distinct from old.escalator_applied
      and new.layer_4a_net = old.layer_4a_net
      and new.ingredient_transparency_score is not distinct from old.ingredient_transparency_score
      and new.explanation_draft is not distinct from old.explanation_draft
      and new.algorithm_version = old.algorithm_version
      and new.approved_at is not distinct from old.approved_at
      and new.review_timestamp is not distinct from old.review_timestamp
      and new.reviewer is not distinct from old.reviewer
      and new.review_notes is not distinct from old.review_notes
    then
      return new;
    end if;
    raise exception 'Approved product_scores % is immutable; create a new pending version instead', old.score_id;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'superseded' then
    raise exception 'Superseded product_scores % is immutable', old.score_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_product_scores_immutable on public.product_scores;
create trigger trg_product_scores_immutable
before update or delete on public.product_scores
for each row
execute function public.guard_product_scores_immutable();

-- ---------------------------------------------------------------------------
-- 8) approve_scoring_inputs (Gate 2)
-- ---------------------------------------------------------------------------
create or replace function public.approve_scoring_inputs(
  p_input_id uuid,
  p_reviewed_by text default null,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_status text;
  v_now timestamptz := now();
begin
  select product_id, review_status
  into v_product_id, v_status
  from public.scoring_inputs
  where input_id = p_input_id
  for update;

  if v_product_id is null then
    raise exception 'scoring_inputs not found: %', p_input_id;
  end if;

  if v_status <> 'pending_review' then
    raise exception 'scoring_inputs % must be pending_review to approve (current: %)', p_input_id, v_status;
  end if;

  update public.scoring_inputs
  set review_status = 'superseded'
  where product_id = v_product_id
    and review_status = 'approved'
    and input_id <> p_input_id;

  update public.scoring_inputs
  set
    review_status = 'approved',
    approved_at = v_now,
    review_timestamp = v_now,
    human_reviewer = nullif(trim(p_reviewed_by), ''),
    review_notes = nullif(trim(p_review_notes), '')
  where input_id = p_input_id;

  update public.products
  set agent_status = 'normalization_approved'
  where product_id = v_product_id;

  return jsonb_build_object(
    'input_id', p_input_id,
    'product_id', v_product_id,
    'approved_at', v_now
  );
end;
$$;

revoke all on function public.approve_scoring_inputs(uuid, text, text) from public;
grant execute on function public.approve_scoring_inputs(uuid, text, text) to authenticated;
grant execute on function public.approve_scoring_inputs(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 9) approve_product_score (Gate 3)
-- ---------------------------------------------------------------------------
create or replace function public.approve_product_score(
  p_score_id uuid,
  p_reviewed_by text default null,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_status text;
  v_pac integer;
  v_tier text;
  v_now timestamptz := now();
begin
  select product_id, review_status, pac_safety_score, tier
  into v_product_id, v_status, v_pac, v_tier
  from public.product_scores
  where score_id = p_score_id
  for update;

  if v_product_id is null then
    raise exception 'product_scores not found: %', p_score_id;
  end if;

  if v_status <> 'pending_review' then
    raise exception 'product_scores % must be pending_review to approve (current: %)', p_score_id, v_status;
  end if;

  update public.product_scores
  set review_status = 'superseded'
  where product_id = v_product_id
    and review_status = 'approved'
    and score_id <> p_score_id;

  update public.product_scores
  set
    review_status = 'approved',
    approved_at = v_now,
    review_timestamp = v_now,
    reviewer = nullif(trim(p_reviewed_by), ''),
    review_notes = nullif(trim(p_review_notes), '')
  where score_id = p_score_id;

  update public.products
  set
    agent_status = 'scoring_approved',
    pac_safety_score = v_pac,
    tier = v_tier
  where product_id = v_product_id;

  return jsonb_build_object(
    'score_id', p_score_id,
    'product_id', v_product_id,
    'approved_at', v_now,
    'pac_safety_score', v_pac,
    'tier', v_tier
  );
end;
$$;

revoke all on function public.approve_product_score(uuid, text, text) from public;
grant execute on function public.approve_product_score(uuid, text, text) to authenticated;
grant execute on function public.approve_product_score(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 10) reject_scoring_inputs — does not clear prior approved chain
-- ---------------------------------------------------------------------------
create or replace function public.reject_scoring_inputs(
  p_input_id uuid,
  p_review_notes text default null,
  p_reviewed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_status text;
  v_now timestamptz := now();
  v_has_approved boolean;
begin
  select product_id, review_status
  into v_product_id, v_status
  from public.scoring_inputs
  where input_id = p_input_id
  for update;

  if v_product_id is null then
    raise exception 'scoring_inputs not found: %', p_input_id;
  end if;

  if v_status not in ('pending_review', 'draft') then
    raise exception 'scoring_inputs % cannot be rejected from status %', p_input_id, v_status;
  end if;

  update public.scoring_inputs
  set
    review_status = 'rejected',
    review_timestamp = v_now,
    review_notes = nullif(trim(p_review_notes), ''),
    human_reviewer = nullif(trim(p_reviewed_by), '')
  where input_id = p_input_id;

  select exists (
    select 1
    from public.scoring_inputs
    where product_id = v_product_id
      and review_status = 'approved'
  )
  into v_has_approved;

  update public.products
  set agent_status = case
    when v_has_approved then 'normalization_approved'
    else 'normalization_rejected'
  end
  where product_id = v_product_id;

  return jsonb_build_object(
    'input_id', p_input_id,
    'product_id', v_product_id,
    'kept_prior_approved', v_has_approved
  );
end;
$$;

revoke all on function public.reject_scoring_inputs(uuid, text, text) from public;
grant execute on function public.reject_scoring_inputs(uuid, text, text) to authenticated;
grant execute on function public.reject_scoring_inputs(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 11) reject_product_score — does not clear prior approved chain
-- ---------------------------------------------------------------------------
create or replace function public.reject_product_score(
  p_score_id uuid,
  p_review_notes text default null,
  p_reviewed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_status text;
  v_now timestamptz := now();
  v_has_approved boolean;
begin
  select product_id, review_status
  into v_product_id, v_status
  from public.product_scores
  where score_id = p_score_id
  for update;

  if v_product_id is null then
    raise exception 'product_scores not found: %', p_score_id;
  end if;

  if v_status <> 'pending_review' then
    raise exception 'product_scores % must be pending_review to reject (current: %)', p_score_id, v_status;
  end if;

  update public.product_scores
  set
    review_status = 'rejected',
    review_timestamp = v_now,
    review_notes = nullif(trim(p_review_notes), ''),
    reviewer = nullif(trim(p_reviewed_by), '')
  where score_id = p_score_id;

  select exists (
    select 1
    from public.product_scores
    where product_id = v_product_id
      and review_status = 'approved'
  )
  into v_has_approved;

  update public.products
  set agent_status = case
    when v_has_approved then 'scoring_approved'
    else 'scoring_rejected'
  end
  where product_id = v_product_id;

  return jsonb_build_object(
    'score_id', p_score_id,
    'product_id', v_product_id,
    'kept_prior_approved', v_has_approved
  );
end;
$$;

revoke all on function public.reject_product_score(uuid, text, text) from public;
grant execute on function public.reject_product_score(uuid, text, text) to authenticated;
grant execute on function public.reject_product_score(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 12) Publish gate + published_at on products
-- ---------------------------------------------------------------------------
create or replace function public.validate_publish_chain(p_product_id uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_active_evidence uuid;
  v_evidence_status text;
  v_input_id uuid;
  v_input_evidence uuid;
  v_score_id uuid;
  v_score_input uuid;
begin
  select active_evidence_id
  into v_active_evidence
  from public.products
  where product_id = p_product_id;

  if v_active_evidence is null then
    raise exception 'Publish blocked: products.active_evidence_id is not set for product %', p_product_id;
  end if;

  select review_status
  into v_evidence_status
  from public.product_evidence
  where evidence_id = v_active_evidence
    and product_id = p_product_id;

  if v_evidence_status is null then
    raise exception 'Publish blocked: active_evidence_id % does not exist for product %', v_active_evidence, p_product_id;
  end if;

  if v_evidence_status <> 'approved' then
    raise exception 'Publish blocked: active evidence % is % (must be approved)', v_active_evidence, v_evidence_status;
  end if;

  select input_id, evidence_id
  into v_input_id, v_input_evidence
  from public.scoring_inputs
  where product_id = p_product_id
    and review_status = 'approved'
  order by run_timestamp desc nulls last
  limit 1;

  if v_input_id is null then
    raise exception 'Publish blocked: no approved scoring_inputs for product %', p_product_id;
  end if;

  if v_input_evidence is distinct from v_active_evidence then
    raise exception 'Publish blocked: approved scoring_inputs % references evidence % but active_evidence_id is %',
      v_input_id, v_input_evidence, v_active_evidence;
  end if;

  select score_id, input_id
  into v_score_id, v_score_input
  from public.product_scores
  where product_id = p_product_id
    and review_status = 'approved'
  order by run_timestamp desc nulls last
  limit 1;

  if v_score_id is null then
    raise exception 'Publish blocked: no approved product_scores for product %', p_product_id;
  end if;

  if v_score_input is distinct from v_input_id then
    raise exception 'Publish blocked: approved product_scores % references input_id % but approved scoring_inputs is %',
      v_score_id, v_score_input, v_input_id;
  end if;
end;
$$;

create or replace function public.guard_products_publish_and_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.publish_status = 'published'
    and (tg_op = 'INSERT' or old.publish_status is distinct from 'published')
  then
    perform public.validate_publish_chain(new.product_id);
    new.published_at := coalesce(new.published_at, now());
  elsif new.publish_status in ('unpublished', 'draft', 'ready_to_publish')
    and old.publish_status = 'published'
  then
    new.published_at := null;
  elsif new.publish_status <> 'published' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_publish_gate on public.products;
create trigger trg_products_publish_gate
before insert or update of publish_status on public.products
for each row
execute function public.guard_products_publish_and_published_at();

commit;
