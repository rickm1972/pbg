-- Phase 1 locked-input architecture: proposed → validated → locked Agent 3 package.
-- Does not replace scoring_inputs; old Agent 1→2→3 path remains unchanged.

begin;

-- ---------------------------------------------------------------------------
-- agent1_proposed_inputs — closed-field proposals before human review
-- Human review state lives on this table (reviewed_payload, reviewed_at, reviewed_by)
-- rather than a separate agent1_reviewed_inputs table.
-- ---------------------------------------------------------------------------
create table if not exists public.agent1_proposed_inputs (
  proposed_input_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  evidence_id uuid not null references public.product_evidence (evidence_id) on delete cascade,
  agent1_run_id uuid,
  schema_version text not null default '1.0.0',
  proposal_status text not null default 'draft',
  proposed_payload jsonb not null,
  reviewed_payload jsonb,
  reviewed_at timestamptz,
  reviewed_by text,
  created_by_system text not null default 'system:agent1',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent1_proposed_inputs_proposal_status_allowed check (
    proposal_status in ('draft', 'pending_review', 'reviewed', 'superseded')
  ),
  constraint agent1_proposed_inputs_proposed_payload_is_object check (
    jsonb_typeof(proposed_payload) = 'object'
  ),
  constraint agent1_proposed_inputs_reviewed_payload_is_object check (
    reviewed_payload is null or jsonb_typeof(reviewed_payload) = 'object'
  )
);

create index if not exists agent1_proposed_inputs_product_id_idx
  on public.agent1_proposed_inputs (product_id);

create index if not exists agent1_proposed_inputs_evidence_id_idx
  on public.agent1_proposed_inputs (evidence_id);

create index if not exists agent1_proposed_inputs_proposal_status_idx
  on public.agent1_proposed_inputs (proposal_status);

comment on table public.agent1_proposed_inputs is
  'Agent 1 proposed closed scoring fields (not score-authoritative). Human review captured in reviewed_payload.';

comment on column public.agent1_proposed_inputs.reviewed_payload is
  'Human-reviewed closed fields after Gate 1 review; not yet system-validated or locked for Agent 3.';

-- ---------------------------------------------------------------------------
-- agent1_system_validations — validation results before lock
-- ---------------------------------------------------------------------------
create table if not exists public.agent1_system_validations (
  validation_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  proposed_input_id uuid not null references public.agent1_proposed_inputs (proposed_input_id) on delete cascade,
  schema_version text not null default '1.0.0',
  validation_status text not null default 'pending',
  validation_payload jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent1_system_validations_status_allowed check (
    validation_status in ('pending', 'passed', 'failed', 'superseded')
  ),
  constraint agent1_system_validations_validation_payload_is_object check (
    jsonb_typeof(validation_payload) = 'object'
  ),
  constraint agent1_system_validations_blockers_is_array check (
    jsonb_typeof(blockers) = 'array'
  ),
  constraint agent1_system_validations_warnings_is_array check (
    jsonb_typeof(warnings) = 'array'
  )
);

create index if not exists agent1_system_validations_product_id_idx
  on public.agent1_system_validations (product_id);

create index if not exists agent1_system_validations_proposed_input_id_idx
  on public.agent1_system_validations (proposed_input_id);

create index if not exists agent1_system_validations_validation_status_idx
  on public.agent1_system_validations (validation_status);

comment on table public.agent1_system_validations is
  'System validation of proposed/reviewed Agent 1 closed fields before locked Agent 3 input package.';

-- ---------------------------------------------------------------------------
-- agent1_locked_inputs — immutable locked package for future Agent 3 reads
-- ---------------------------------------------------------------------------
create table if not exists public.agent1_locked_inputs (
  locked_input_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  proposed_input_id uuid not null references public.agent1_proposed_inputs (proposed_input_id) on delete restrict,
  validation_id uuid references public.agent1_system_validations (validation_id) on delete set null,
  schema_version text not null default '1.0.0',
  locked_input_status text not null default 'draft',
  locked_payload jsonb not null,
  lock_hash text,
  locked_at timestamptz,
  locked_by text,
  superseded_by uuid references public.agent1_locked_inputs (locked_input_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent1_locked_inputs_status_allowed check (
    locked_input_status in (
      'draft',
      'reviewed',
      'validated',
      'locked_for_agent_3',
      'superseded'
    )
  ),
  constraint agent1_locked_inputs_locked_payload_is_object check (
    jsonb_typeof(locked_payload) = 'object'
  )
);

create index if not exists agent1_locked_inputs_product_id_idx
  on public.agent1_locked_inputs (product_id);

create index if not exists agent1_locked_inputs_proposed_input_id_idx
  on public.agent1_locked_inputs (proposed_input_id);

create index if not exists agent1_locked_inputs_validation_id_idx
  on public.agent1_locked_inputs (validation_id);

create index if not exists agent1_locked_inputs_locked_input_status_idx
  on public.agent1_locked_inputs (locked_input_status);

create unique index if not exists agent1_locked_inputs_one_active_lock_per_product_idx
  on public.agent1_locked_inputs (product_id)
  where locked_input_status = 'locked_for_agent_3';

comment on table public.agent1_locked_inputs is
  'Locked Agent 3 input package. locked_for_agent_3 rows are immutable (payload cannot change).';

-- ---------------------------------------------------------------------------
-- Immutability guard — locked_for_agent_3 payload cannot be silently modified
-- ---------------------------------------------------------------------------
create or replace function public.guard_agent1_locked_inputs_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.locked_input_status in ('locked_for_agent_3', 'superseded') then
      raise exception 'Cannot delete agent1_locked_inputs % (status %)', old.locked_input_id, old.locked_input_status;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.locked_input_status = 'locked_for_agent_3' then
    if new.locked_input_status = 'superseded'
      and new.product_id = old.product_id
      and new.proposed_input_id = old.proposed_input_id
      and new.validation_id is not distinct from old.validation_id
      and new.schema_version = old.schema_version
      and new.locked_payload is not distinct from old.locked_payload
      and new.lock_hash is not distinct from old.lock_hash
      and new.locked_at is not distinct from old.locked_at
      and new.locked_by is not distinct from old.locked_by
      and new.superseded_by is not null
      and old.superseded_by is null
    then
      return new;
    end if;
    raise exception 'Locked agent1_locked_inputs % (locked_for_agent_3) is immutable; supersede and create a new row instead', old.locked_input_id;
  end if;

  if tg_op = 'UPDATE' and old.locked_input_status = 'superseded' then
    raise exception 'Superseded agent1_locked_inputs % is immutable', old.locked_input_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agent1_locked_inputs_immutable on public.agent1_locked_inputs;
create trigger trg_agent1_locked_inputs_immutable
before update or delete on public.agent1_locked_inputs
for each row
execute function public.guard_agent1_locked_inputs_immutable();

-- ---------------------------------------------------------------------------
-- RLS — admin-only (matches scoring_inputs / product_evidence pattern)
-- ---------------------------------------------------------------------------
alter table public.agent1_proposed_inputs enable row level security;
alter table public.agent1_system_validations enable row level security;
alter table public.agent1_locked_inputs enable row level security;

drop policy if exists "Admin manage agent1_proposed_inputs" on public.agent1_proposed_inputs;
create policy "Admin manage agent1_proposed_inputs"
on public.agent1_proposed_inputs
for all
using (true)
with check (true);

drop policy if exists "Admin manage agent1_system_validations" on public.agent1_system_validations;
create policy "Admin manage agent1_system_validations"
on public.agent1_system_validations
for all
using (true)
with check (true);

drop policy if exists "Admin manage agent1_locked_inputs" on public.agent1_locked_inputs;
create policy "Admin manage agent1_locked_inputs"
on public.agent1_locked_inputs
for all
using (true)
with check (true);

commit;
