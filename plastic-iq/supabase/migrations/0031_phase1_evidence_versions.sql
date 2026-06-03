-- Phase 1: evidence version foundation (product_evidence), supersede, immutability,
-- field provenance JSONB, publish_status on products. No data deletion.

begin;

-- ---------------------------------------------------------------------------
-- 1) product_evidence: submitted → pending_review
-- ---------------------------------------------------------------------------
update public.product_evidence
set review_status = 'pending_review'
where review_status = 'submitted';

alter table public.product_evidence
  drop constraint if exists product_evidence_review_status_allowed;

alter table public.product_evidence
  add constraint product_evidence_review_status_allowed check (
    review_status in (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'superseded'
    )
  );

comment on table public.product_evidence is
  'Evidence versions per product (bundle_version). Phase 1: one active approved row per product via products.active_evidence_id.';

-- ---------------------------------------------------------------------------
-- 2) Per-field provenance (JSONB map; normalize to child table in a later phase)
-- Keys: dot-path field ids, e.g. primary_contact_material.material_identity
-- Values: { value, source_url, source_quote, confidence_label, source_fetch_date, content_hash }
-- ---------------------------------------------------------------------------
alter table public.product_evidence
  add column if not exists field_provenance jsonb not null default '{}'::jsonb;

alter table public.product_evidence
  drop constraint if exists product_evidence_field_provenance_is_object;

alter table public.product_evidence
  add constraint product_evidence_field_provenance_is_object check (
    jsonb_typeof(field_provenance) = 'object'
  );

comment on column public.product_evidence.field_provenance is
  'Per-field provenance map (Phase 1 JSONB). Populated on Agent 1 save; immutable after approval.';

-- ---------------------------------------------------------------------------
-- 3) products.active_evidence_id + publish_status
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists active_evidence_id uuid references public.product_evidence (evidence_id) on delete set null;

comment on column public.products.active_evidence_id is
  'Currently active approved evidence version (product_evidence.evidence_id). Set by approve_product_evidence().';

create index if not exists products_active_evidence_id_idx
  on public.products (active_evidence_id)
  where active_evidence_id is not null;

alter table public.products
  add column if not exists publish_status text not null default 'draft';

alter table public.products
  drop constraint if exists products_publish_status_allowed;

alter table public.products
  add constraint products_publish_status_allowed check (
    publish_status in (
      'draft',
      'ready_to_publish',
      'published',
      'unpublished'
    )
  );

comment on column public.products.publish_status is
  'Public website visibility gate (Phase 1 schema only; queries wired in a later phase). Default draft.';

create index if not exists products_publish_status_idx
  on public.products (publish_status);

-- Backfill active_evidence_id from latest approved bundle (no deletes)
update public.products p
set active_evidence_id = sub.evidence_id
from (
  select distinct on (pe.product_id)
    pe.product_id,
    pe.evidence_id
  from public.product_evidence pe
  where pe.review_status = 'approved'
  order by pe.product_id, pe.bundle_version desc
) sub
where p.product_id = sub.product_id
  and p.active_evidence_id is null;

-- If multiple approved rows exist, supersede all but the highest bundle_version per product
update public.product_evidence pe
set review_status = 'superseded'
from (
  select distinct on (product_id)
    product_id,
    evidence_id as keep_id
  from public.product_evidence
  where review_status = 'approved'
  order by product_id, bundle_version desc
) keeper
where pe.product_id = keeper.product_id
  and pe.review_status = 'approved'
  and pe.evidence_id <> keeper.keep_id;

-- Re-point active_evidence_id after supersede cleanup
update public.products p
set active_evidence_id = sub.evidence_id
from (
  select distinct on (pe.product_id)
    pe.product_id,
    pe.evidence_id
  from public.product_evidence pe
  where pe.review_status = 'approved'
  order by pe.product_id, pe.bundle_version desc
) sub
where p.product_id = sub.product_id;

-- ---------------------------------------------------------------------------
-- 4) At most one approved evidence version per product (DB enforcement)
-- ---------------------------------------------------------------------------
create unique index if not exists product_evidence_one_approved_per_product_uidx
  on public.product_evidence (product_id)
  where review_status = 'approved';

-- ---------------------------------------------------------------------------
-- 5) Immutability: approved payloads cannot change (except → superseded)
-- ---------------------------------------------------------------------------
create or replace function public.guard_product_evidence_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.review_status in ('approved', 'superseded') then
      raise exception 'Cannot delete evidence version % (status %)', old.evidence_id, old.review_status;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'approved' then
    if new.review_status = 'superseded'
      and new.product_id = old.product_id
      and new.bundle_version = old.bundle_version
      and new.sources is not distinct from old.sources
      and new.facts is not distinct from old.facts
      and new.agent_metadata is not distinct from old.agent_metadata
      and new.field_provenance is not distinct from old.field_provenance
      and new.algorithm_version = old.algorithm_version
      and new.submitted_at is not distinct from old.submitted_at
      and new.approved_at is not distinct from old.approved_at
      and new.reviewed_at is not distinct from old.reviewed_at
      and new.reviewed_by is not distinct from old.reviewed_by
      and new.reviewer_notes is not distinct from old.reviewer_notes
    then
      return new;
    end if;
    raise exception 'Approved evidence % is immutable; create a new draft version instead', old.evidence_id;
  end if;

  if tg_op = 'UPDATE' and old.review_status = 'superseded' then
    raise exception 'Superseded evidence % is immutable', old.evidence_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_product_evidence_immutable on public.product_evidence;
create trigger trg_product_evidence_immutable
before update or delete on public.product_evidence
for each row
execute function public.guard_product_evidence_immutable();

-- ---------------------------------------------------------------------------
-- 6) Approve evidence: supersede prior approved, set active pointer, pipeline status
-- ---------------------------------------------------------------------------
create or replace function public.approve_product_evidence(
  p_evidence_id uuid,
  p_reviewed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_status text;
  v_now timestamptz := now();
begin
  select product_id, review_status
  into v_product_id, v_status
  from public.product_evidence
  where evidence_id = p_evidence_id
  for update;

  if v_product_id is null then
    raise exception 'Evidence not found: %', p_evidence_id;
  end if;

  if v_status <> 'pending_review' then
    raise exception 'Evidence % must be pending_review to approve (current: %)', p_evidence_id, v_status;
  end if;

  -- Supersede any existing approved versions (frees unique index slot)
  update public.product_evidence
  set review_status = 'superseded'
  where product_id = v_product_id
    and review_status = 'approved'
    and evidence_id <> p_evidence_id;

  update public.product_evidence
  set
    review_status = 'approved',
    reviewed_at = v_now,
    approved_at = v_now,
    reviewed_by = nullif(trim(p_reviewed_by), '')
  where evidence_id = p_evidence_id;

  update public.products
  set
    agent_status = 'evidence_approved',
    active_evidence_id = p_evidence_id
  where product_id = v_product_id;

  return jsonb_build_object(
    'evidence_id', p_evidence_id,
    'product_id', v_product_id,
    'active_evidence_id', p_evidence_id,
    'approved_at', v_now
  );
end;
$$;

comment on function public.approve_product_evidence(uuid, text) is
  'Approve one pending_review evidence version: supersede prior approved, set products.active_evidence_id.';

revoke all on function public.approve_product_evidence(uuid, text) from public;
grant execute on function public.approve_product_evidence(uuid, text) to authenticated;
grant execute on function public.approve_product_evidence(uuid, text) to service_role;

commit;
