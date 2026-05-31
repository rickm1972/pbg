-- Persona agent: buyer personas (admin-only, internal research pipeline)

begin;

create table if not exists public.personas (
  persona_id uuid primary key default gen_random_uuid(),

  persona_name text,
  segment text,
  target_segment text not null,

  status text not null default 'draft',
  constraint personas_status_allowed check (
    status in ('draft', 'approved', 'rejected')
  ),

  persona_content jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  run_metadata jsonb not null default '{}'::jsonb,

  segment_size_estimate numeric,
  conversion_rate_estimate numeric,
  ltv_estimate numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personas_persona_content_is_object check (jsonb_typeof(persona_content) = 'object'),
  constraint personas_sources_is_array check (jsonb_typeof(sources) = 'array'),
  constraint personas_run_metadata_is_object check (jsonb_typeof(run_metadata) = 'object')
);

create index if not exists personas_status_idx on public.personas (status);
create index if not exists personas_segment_idx on public.personas (segment);
create index if not exists personas_created_at_idx on public.personas (created_at desc);

comment on table public.personas is
  'Buyer personas from the Persona agent (Perplexity retrieval + Claude synthesis). Admin-only.';

create or replace function public.set_personas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_personas_set_updated_at on public.personas;
create trigger trg_personas_set_updated_at
before update on public.personas
for each row
execute function public.set_personas_updated_at();

alter table public.personas enable row level security;

drop policy if exists "Authenticated manage personas" on public.personas;
create policy "Authenticated manage personas"
on public.personas
for all
to authenticated
using (true)
with check (true);

commit;
