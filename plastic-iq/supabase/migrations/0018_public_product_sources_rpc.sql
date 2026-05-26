-- Public read of evidence sources from approved Agent 1 evidence (product pages only)

begin;

create or replace function public.get_product_sources(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pe.sources
      from public.product_evidence pe
      inner join public.products p on p.product_id = pe.product_id
      where pe.product_id = p_product_id
        and pe.review_status = 'approved'
        and coalesce(p.active, true) = true
      order by pe.bundle_version desc
      limit 1
    ),
    '[]'::jsonb
  );
$$;

revoke all on function public.get_product_sources(uuid) from public;
grant execute on function public.get_product_sources(uuid) to anon, authenticated;

commit;
