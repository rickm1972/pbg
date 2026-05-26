-- Public read of normalization components for product Risk Dashboard

begin;

create or replace function public.get_normalization_components(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select si.inputs -> 'components'
      from public.scoring_inputs si
      inner join public.products p on p.product_id = si.product_id
      where si.product_id = p_product_id
        and si.review_status = 'approved'
        and coalesce(p.active, true) = true
      order by si.review_timestamp desc nulls last
      limit 1
    ),
    '[]'::jsonb
  );
$$;

revoke all on function public.get_normalization_components(uuid) from public;
grant execute on function public.get_normalization_components(uuid) to anon, authenticated;

commit;
