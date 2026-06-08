-- Public product page: minimal approved evidence for source/retailer eligibility (no admin audit noise).
create or replace function public.get_product_evidence_display_pack(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sources', pe.sources,
    'agent_metadata', pe.agent_metadata
  )
  from public.products p
  inner join public.product_evidence pe
    on pe.evidence_id = p.active_evidence_id
    and pe.product_id = p.product_id
    and pe.review_status = 'approved'
  where p.product_id = p_product_id
    and p.active = true
    and p.publish_status = 'published';
$$;

comment on function public.get_product_evidence_display_pack(uuid) is
  'Published products: approved evidence sources + metadata for public source/retailer filtering.';

revoke all on function public.get_product_evidence_display_pack(uuid) from public;
grant execute on function public.get_product_evidence_display_pack(uuid) to anon, authenticated;
