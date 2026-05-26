-- Session 2: structured Why This Score fields on scoring_inputs (Agent 2)

begin;

alter table public.scoring_inputs
  add column if not exists primary_material_summary text,
  add column if not exists secondary_materials_summary text,
  add column if not exists coatings_finishes_summary text,
  add column if not exists use_conditions_summary text,
  add column if not exists disclosure_quality_summary text,
  add column if not exists certifications_summary text;

comment on column public.scoring_inputs.primary_material_summary is
  'Why This Score: primary contact material and disclosure (newline-separated bullets, max 10 words each).';

comment on column public.scoring_inputs.secondary_materials_summary is
  'Why This Score: secondary components and materials.';

comment on column public.scoring_inputs.coatings_finishes_summary is
  'Why This Score: coatings and finishing treatments.';

comment on column public.scoring_inputs.use_conditions_summary is
  'Why This Score: normal-use exposure conditions from use case and severity/duration.';

comment on column public.scoring_inputs.disclosure_quality_summary is
  'Why This Score: Layer 4B transparency badge.';

comment on column public.scoring_inputs.certifications_summary is
  'Why This Score: verified third-party certifications or absence note.';

comment on column public.product_scores.explanation_draft is
  'Deprecated — use scoring_inputs Why This Score summary columns on the product page.';

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
        'primary_material_summary', si.primary_material_summary,
        'secondary_materials_summary', si.secondary_materials_summary,
        'coatings_finishes_summary', si.coatings_finishes_summary,
        'use_conditions_summary', si.use_conditions_summary,
        'disclosure_quality_summary', si.disclosure_quality_summary,
        'certifications_summary', si.certifications_summary
      )
      from public.scoring_inputs si
      inner join public.products p on p.product_id = si.product_id
      where si.product_id = p_product_id
        and si.review_status = 'approved'
        and coalesce(p.active, true) = true
        and si.primary_material_summary is not null
      order by si.review_timestamp desc nulls last
      limit 1
    ),
    'null'::jsonb
  );
$$;

revoke all on function public.get_why_this_score(uuid) from public;
grant execute on function public.get_why_this_score(uuid) to anon, authenticated;

commit;
