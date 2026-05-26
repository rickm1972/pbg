-- Session 2: Why This Score fixed vocabulary options (text arrays)

begin;

alter table public.scoring_inputs
  drop column if exists primary_material_summary,
  drop column if exists secondary_materials_summary,
  drop column if exists coatings_finishes_summary,
  drop column if exists use_conditions_summary,
  drop column if exists disclosure_quality_summary,
  drop column if exists certifications_summary;

alter table public.scoring_inputs
  add column if not exists primary_material_options text[] not null default array['None']::text[],
  add column if not exists secondary_materials_options text[] not null default array['None']::text[],
  add column if not exists coatings_finishes_options text[] not null default array['None']::text[],
  add column if not exists use_conditions_options text[] not null default array['None']::text[],
  add column if not exists disclosure_quality_options text[] not null default array['None']::text[],
  add column if not exists certifications_options text[] not null default array['Third-party verification absent']::text[];

comment on column public.scoring_inputs.primary_material_options is
  'Why This Score: selected primary material vocabulary options.';

comment on column public.scoring_inputs.secondary_materials_options is
  'Why This Score: selected secondary materials vocabulary options.';

comment on column public.scoring_inputs.coatings_finishes_options is
  'Why This Score: selected coatings and finishes vocabulary options.';

comment on column public.scoring_inputs.use_conditions_options is
  'Why This Score: selected use conditions vocabulary options.';

comment on column public.scoring_inputs.disclosure_quality_options is
  'Why This Score: Layer 4B transparency badge option.';

comment on column public.scoring_inputs.certifications_options is
  'Why This Score: certification badge options or Third-party verification absent.';

create or replace function public.get_why_this_score(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'primary_material_options', to_jsonb(si.primary_material_options),
        'secondary_materials_options', to_jsonb(si.secondary_materials_options),
        'coatings_finishes_options', to_jsonb(si.coatings_finishes_options),
        'use_conditions_options', to_jsonb(si.use_conditions_options),
        'disclosure_quality_options', to_jsonb(si.disclosure_quality_options),
        'certifications_options', to_jsonb(si.certifications_options)
      )
      from public.scoring_inputs si
      inner join public.products p on p.product_id = si.product_id
      where si.product_id = p_product_id
        and si.review_status = 'approved'
        and coalesce(p.active, true) = true
        and si.primary_material_options is not null
      order by si.review_timestamp desc nulls last
      limit 1
    ),
    'null'::jsonb
  );
$$;

revoke all on function public.get_why_this_score(uuid) from public;
grant execute on function public.get_why_this_score(uuid) to anon, authenticated;

commit;
