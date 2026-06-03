-- Phase 2A: public site reads only publish_status = 'published' + approved pipeline data.
-- No pending_review / submitted / draft fallbacks on public RPCs or RLS.

begin;

-- ---------------------------------------------------------------------------
-- 1) get_product_page_score — approved product_scores only, no catalog cache fallback
-- ---------------------------------------------------------------------------
create or replace function public.get_product_page_score(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when ps.score_id is null then null::jsonb
    else jsonb_build_object(
      'pac_safety_score', ps.pac_safety_score,
      'tier', ps.tier,
      'transparency_badge', nullif(trim(ps.transparency_badge), ''),
      'displayed_confidence_range', nullif(trim(ps.displayed_confidence_range), ''),
      'explanation_draft', ps.explanation_draft
    )
  end
  from public.products p
  inner join lateral (
    select
      score_id,
      pac_safety_score,
      tier,
      displayed_confidence_range,
      transparency_badge,
      explanation_draft,
      input_id
    from public.product_scores
    where product_id = p_product_id
      and review_status = 'approved'
    order by run_timestamp desc
    limit 1
  ) ps on true
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_product_page_score(uuid) is
  'Phase 2A: published products only; approved product_scores only (no pending_review or products row cache).';

-- ---------------------------------------------------------------------------
-- 2) get_product_description — approved scoring_inputs linked to approved score
-- ---------------------------------------------------------------------------
create or replace function public.get_product_description(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(si.inputs ->> 'product_description'), '')
  from public.products p
  inner join lateral (
    select input_id
    from public.product_scores
    where product_id = p_product_id
      and review_status = 'approved'
    order by run_timestamp desc
    limit 1
  ) ps on true
  inner join public.scoring_inputs si
    on si.input_id = ps.input_id
    and si.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_product_description(uuid) is
  'Phase 2A: published + approved normalization (via approved score input_id) only.';

-- ---------------------------------------------------------------------------
-- 3) get_why_this_score — approved scoring_inputs on approved score chain
-- ---------------------------------------------------------------------------
create or replace function public.get_why_this_score(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when si.input_id is null then null::jsonb
    else jsonb_build_object(
      'primary_material_options', to_jsonb(si.primary_material_options),
      'secondary_materials_options', to_jsonb(si.secondary_materials_options),
      'coatings_finishes_options', to_jsonb(si.coatings_finishes_options),
      'use_conditions_options', to_jsonb(si.use_conditions_options),
      'disclosure_quality_options', to_jsonb(si.disclosure_quality_options),
      'certifications_options', to_jsonb(si.certifications_options)
    )
  end
  from public.products p
  inner join lateral (
    select input_id
    from public.product_scores
    where product_id = p_product_id
      and review_status = 'approved'
    order by run_timestamp desc
    limit 1
  ) ps on true
  inner join public.scoring_inputs si
    on si.input_id = ps.input_id
    and si.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published'
    and si.primary_material_options is not null;
$$;

comment on function public.get_why_this_score(uuid) is
  'Phase 2A: published + approved Why This Score fields only.';

-- ---------------------------------------------------------------------------
-- 4) get_normalization_components — approved inputs on approved score chain
-- ---------------------------------------------------------------------------
create or replace function public.get_normalization_components(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(si.inputs -> 'components', '[]'::jsonb)
  from public.products p
  inner join lateral (
    select input_id
    from public.product_scores
    where product_id = p_product_id
      and review_status = 'approved'
    order by run_timestamp desc
    limit 1
  ) ps on true
  inner join public.scoring_inputs si
    on si.input_id = ps.input_id
    and si.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_normalization_components(uuid) is
  'Phase 2A: published + approved components only.';

-- ---------------------------------------------------------------------------
-- 5) get_product_sources — active approved evidence version only
-- ---------------------------------------------------------------------------
create or replace function public.get_product_sources(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select pe.sources
  from public.products p
  inner join public.product_evidence pe
    on pe.evidence_id = p.active_evidence_id
    and pe.product_id = p.product_id
    and pe.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_product_sources(uuid) is
  'Phase 2A: published products; sources from products.active_evidence_id (approved only).';

-- ---------------------------------------------------------------------------
-- 6) get_verified_certifications — active approved evidence metadata only
-- ---------------------------------------------------------------------------
create or replace function public.get_verified_certifications(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(pe.agent_metadata -> 'certifications_verified', '[]'::jsonb)
  from public.products p
  inner join public.product_evidence pe
    on pe.evidence_id = p.active_evidence_id
    and pe.product_id = p.product_id
    and pe.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_verified_certifications(uuid) is
  'Phase 2A: published products; certs from active approved evidence only.';

-- ---------------------------------------------------------------------------
-- 7) RLS — tighten public read paths
-- ---------------------------------------------------------------------------
drop policy if exists "Public read active products" on public.products;
drop policy if exists "Public read published products" on public.products;

create policy "Public read published products"
on public.products
for select
to anon, authenticated
using (active = true and publish_status = 'published');

drop policy if exists "Public read displayable product_scores" on public.product_scores;
drop policy if exists "Public read approved product_scores" on public.product_scores;
drop policy if exists "Public read published approved product_scores" on public.product_scores;

create policy "Public read published approved product_scores"
on public.product_scores
for select
to anon, authenticated
using (
  review_status = 'approved'
  and exists (
    select 1
    from public.products p
    where p.product_id = product_scores.product_id
      and p.active = true
      and p.publish_status = 'published'
  )
);

drop policy if exists "Public read score_details for active products" on public.score_details;
drop policy if exists "Public read score_details for published products" on public.score_details;

create policy "Public read score_details for published products"
on public.score_details
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.product_id = score_details.product_id
      and p.active = true
      and p.publish_status = 'published'
  )
);

commit;
