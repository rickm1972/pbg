-- Public product page: score, transparency badge, and confidence range from Agent 3 / Agent 2.

begin;

create or replace function public.get_product_page_score(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prod as (
    select product_id, pac_safety_score, tier
    from public.products
    where product_id = p_product_id
      and active = true
  ),
  best_score as (
    select
      ps.pac_safety_score,
      ps.tier,
      ps.displayed_confidence_range,
      ps.transparency_badge,
      ps.explanation_draft
    from public.product_scores ps
    where ps.product_id = p_product_id
      and ps.review_status in ('approved', 'pending_review')
    order by
      case ps.review_status when 'approved' then 0 else 1 end,
      ps.run_timestamp desc
    limit 1
  ),
  best_inputs as (
    select si.inputs
    from public.scoring_inputs si
    where si.product_id = p_product_id
      and si.review_status in ('approved', 'submitted')
    order by
      case si.review_status when 'approved' then 0 else 1 end,
      si.run_timestamp desc
    limit 1
  ),
  resolved as (
    select
      p.product_id,
      coalesce(bs.pac_safety_score, p.pac_safety_score) as pac_safety_score,
      coalesce(bs.tier, p.tier) as tier,
      coalesce(
        bs.transparency_badge,
        bi.inputs -> 'layer_4b' ->> 'transparency_badge'
      ) as transparency_badge,
      coalesce(bs.displayed_confidence_range, null) as score_range,
      coalesce((bi.inputs -> 'layer_4b' ->> 'confidence_interval')::int, 0) as ci_half,
      bs.explanation_draft
    from prod p
    left join best_score bs on true
    left join best_inputs bi on true
  )
  select case
    when r.product_id is null then null::jsonb
    else jsonb_build_object(
      'pac_safety_score',
      r.pac_safety_score,
      'tier',
      r.tier,
      'transparency_badge',
      nullif(trim(r.transparency_badge), ''),
      'displayed_confidence_range',
      coalesce(
        r.score_range,
        case
          when r.ci_half > 0 and r.pac_safety_score is not null then
            (greatest(0, r.pac_safety_score - r.ci_half))::text
            || '–'
            || (least(99, r.pac_safety_score + r.ci_half))::text
          else null
        end
      ),
      'explanation_draft',
      r.explanation_draft
    )
  end
  from resolved r;
$$;

comment on function public.get_product_page_score(uuid) is
  'Product page display: prefers approved product_scores, then pending_review; transparency/range fall back to Agent 2 layer_4b on scoring_inputs.';

revoke all on function public.get_product_page_score(uuid) from public;
grant execute on function public.get_product_page_score(uuid) to anon, authenticated;

drop policy if exists "Public read approved product_scores" on public.product_scores;
drop policy if exists "Public read displayable product_scores" on public.product_scores;

create policy "Public read displayable product_scores"
on public.product_scores
for select
to anon, authenticated
using (
  review_status in ('approved', 'pending_review')
  and exists (
    select 1
    from public.products p
    where p.product_id = product_scores.product_id
      and p.active = true
  )
);

commit;
