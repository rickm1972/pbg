-- Public product page: Agent 2 pipeline description from scoring_inputs.inputs.product_description

begin;

create or replace function public.get_product_description(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(si.inputs ->> 'product_description'), '')
  from public.scoring_inputs si
  inner join public.products p on p.product_id = si.product_id
  where si.product_id = p_product_id
    and si.review_status in ('approved', 'submitted')
    and coalesce(p.active, true) = true
  order by
    case si.review_status when 'approved' then 0 else 1 end,
    si.run_timestamp desc nulls last
  limit 1;
$$;

comment on function public.get_product_description(uuid) is
  'Product page copy from Agent 2 step 7 (inputs.product_description). Prefers approved normalization, then latest submitted.';

revoke all on function public.get_product_description(uuid) from public;
grant execute on function public.get_product_description(uuid) to anon, authenticated;

commit;
