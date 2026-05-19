-- Public read of verified certifications from approved Agent 1 evidence (product pages only)

begin;

create or replace function public.get_verified_certifications(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pe.agent_metadata -> 'certifications_verified'
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

revoke all on function public.get_verified_certifications(uuid) from public;
grant execute on function public.get_verified_certifications(uuid) to anon, authenticated;

commit;
