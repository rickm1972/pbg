-- Industry / counter-aligned channels (not seeding targets)

begin;

alter table public.channel_maps
  add column if not exists industry_channels jsonb not null default '[]'::jsonb;

alter table public.channel_maps
  add constraint channel_maps_industry_channels_is_array
  check (jsonb_typeof(industry_channels) = 'array');

comment on column public.channel_maps.industry_channels is
  'Trade/industry-aligned channels (orientation industry) — visible but excluded from seeding top 30.';

commit;
