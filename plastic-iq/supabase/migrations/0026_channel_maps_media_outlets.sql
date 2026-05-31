-- Channel maps: separate media outlets from community channels

begin;

alter table public.channel_maps
  add column if not exists media_outlets jsonb not null default '[]'::jsonb;

alter table public.channel_maps
  add constraint channel_maps_media_outlets_is_array
  check (jsonb_typeof(media_outlets) = 'array');

comment on column public.channel_maps.channels is
  'Ranked community/seeding channels (top 30); excludes news/media outlets.';
comment on column public.channel_maps.media_outlets is
  'Ranked media/PR targets (news, NGO journalism); separate from community outreach list.';

commit;
