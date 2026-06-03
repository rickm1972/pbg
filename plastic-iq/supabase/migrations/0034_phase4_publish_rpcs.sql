-- Phase 4: publish/unpublish RPCs + ready_to_publish sync (no data wipe).

begin;

-- ---------------------------------------------------------------------------
-- sync_product_publish_eligibility — draft vs ready_to_publish from approved chain
-- Never changes publish_status = 'published'.
-- ---------------------------------------------------------------------------
create or replace function public.sync_product_publish_eligibility(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select publish_status
  into v_status
  from public.products
  where product_id = p_product_id;

  if v_status is null or v_status = 'published' then
    return;
  end if;

  begin
    perform public.validate_publish_chain(p_product_id);
    update public.products
    set publish_status = 'ready_to_publish'
    where product_id = p_product_id
      and publish_status is distinct from 'published';
  exception
    when others then
      update public.products
      set publish_status = 'draft'
      where product_id = p_product_id
        and publish_status is distinct from 'published';
  end;
end;
$$;

revoke all on function public.sync_product_publish_eligibility(uuid) from public;
grant execute on function public.sync_product_publish_eligibility(uuid) to authenticated;
grant execute on function public.sync_product_publish_eligibility(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- set_product_published (Gate 4)
-- ---------------------------------------------------------------------------
create or replace function public.set_product_published(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_status text;
begin
  select publish_status
  into v_status
  from public.products
  where product_id = p_product_id
  for update;

  if v_status is null then
    raise exception 'Product not found: %', p_product_id;
  end if;

  if v_status = 'published' then
    return jsonb_build_object(
      'product_id', p_product_id,
      'publish_status', 'published',
      'already_published', true
    );
  end if;

  perform public.validate_publish_chain(p_product_id);

  update public.products
  set publish_status = 'published'
  where product_id = p_product_id;

  return jsonb_build_object(
    'product_id', p_product_id,
    'publish_status', 'published',
    'published_at', v_now
  );
end;
$$;

revoke all on function public.set_product_published(uuid) from public;
grant execute on function public.set_product_published(uuid) to authenticated;
grant execute on function public.set_product_published(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- set_product_unpublished (Gate 4)
-- ---------------------------------------------------------------------------
create or replace function public.set_product_unpublished(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select publish_status
  into v_status
  from public.products
  where product_id = p_product_id
  for update;

  if v_status is null then
    raise exception 'Product not found: %', p_product_id;
  end if;

  if v_status <> 'published' then
    return jsonb_build_object(
      'product_id', p_product_id,
      'publish_status', v_status,
      'already_unpublished', true
    );
  end if;

  update public.products
  set publish_status = 'unpublished'
  where product_id = p_product_id;

  return jsonb_build_object(
    'product_id', p_product_id,
    'publish_status', 'unpublished'
  );
end;
$$;

revoke all on function public.set_product_unpublished(uuid) from public;
grant execute on function public.set_product_unpublished(uuid) to authenticated;
grant execute on function public.set_product_unpublished(uuid) to service_role;

-- Patch approve_product_evidence: sync publish eligibility after Gate 1 approve
create or replace function public.approve_product_evidence(
  p_evidence_id uuid,
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
begin
  select product_id, review_status
  into v_product_id, v_status
  from public.product_evidence
  where evidence_id = p_evidence_id
  for update;

  if v_product_id is null then
    raise exception 'Evidence not found: %', p_evidence_id;
  end if;

  if v_status <> 'pending_review' then
    raise exception 'Evidence % must be pending_review to approve (current: %)', p_evidence_id, v_status;
  end if;

  update public.product_evidence
  set review_status = 'superseded'
  where product_id = v_product_id
    and review_status = 'approved'
    and evidence_id <> p_evidence_id;

  update public.product_evidence
  set
    review_status = 'approved',
    reviewed_at = v_now,
    approved_at = v_now,
    reviewed_by = nullif(trim(p_reviewed_by), '')
  where evidence_id = p_evidence_id;

  update public.products
  set
    agent_status = 'evidence_approved',
    active_evidence_id = p_evidence_id
  where product_id = v_product_id;

  perform public.sync_product_publish_eligibility(v_product_id);

  return jsonb_build_object(
    'evidence_id', p_evidence_id,
    'product_id', v_product_id,
    'active_evidence_id', p_evidence_id,
    'approved_at', v_now
  );
end;
$$;

-- Patch approve_scoring_inputs: sync after Gate 2 approve
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

  perform public.sync_product_publish_eligibility(v_product_id);

  return jsonb_build_object(
    'input_id', p_input_id,
    'product_id', v_product_id,
    'approved_at', v_now
  );
end;
$$;

-- Patch approve_product_score: sync after Gate 3 approve
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

  perform public.sync_product_publish_eligibility(v_product_id);

  return jsonb_build_object(
    'score_id', p_score_id,
    'product_id', v_product_id,
    'approved_at', v_now,
    'pac_safety_score', v_pac,
    'tier', v_tier
  );
end;
$$;

commit;
