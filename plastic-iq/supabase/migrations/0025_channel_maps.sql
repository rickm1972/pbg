-- Channel Discovery agent: topic channel maps (admin-only)

begin;

create table if not exists public.channel_maps (
  channel_map_id uuid primary key default gen_random_uuid(),

  topic text not null,
  topic_description text,

  status text not null default 'draft',
  constraint channel_maps_status_allowed check (
    status in ('draft', 'approved', 'rejected')
  ),

  channels jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  run_metadata jsonb not null default '{}'::jsonb,

  channel_count integer not null default 0,
  top_10_channel_ids jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channel_maps_channels_is_array check (jsonb_typeof(channels) = 'array'),
  constraint channel_maps_sources_is_array check (jsonb_typeof(sources) = 'array'),
  constraint channel_maps_run_metadata_is_object check (jsonb_typeof(run_metadata) = 'object'),
  constraint channel_maps_top_10_is_array check (jsonb_typeof(top_10_channel_ids) = 'array')
);

create index if not exists channel_maps_status_idx on public.channel_maps (status);
create index if not exists channel_maps_topic_idx on public.channel_maps (topic);
create index if not exists channel_maps_created_at_idx on public.channel_maps (created_at desc);

comment on table public.channel_maps is
  'US English channel maps from the Channel Discovery agent (Perplexity + Claude). Admin-only.';

create or replace function public.set_channel_maps_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_channel_maps_set_updated_at on public.channel_maps;
create trigger trg_channel_maps_set_updated_at
before update on public.channel_maps
for each row
execute function public.set_channel_maps_updated_at();

alter table public.channel_maps enable row level security;

drop policy if exists "Authenticated manage channel_maps" on public.channel_maps;
create policy "Authenticated manage channel_maps"
on public.channel_maps
for all
to authenticated
using (true)
with check (true);

commit;
