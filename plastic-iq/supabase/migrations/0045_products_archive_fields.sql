-- Phase B: non-destructive archive/hide for test-debris product rows.

begin;

alter table public.products
  add column if not exists is_archived boolean not null default false;

alter table public.products
  add column if not exists record_origin text;

alter table public.products
  add column if not exists archived_at timestamptz;

alter table public.products
  add column if not exists archive_reason text;

comment on column public.products.is_archived is
  'When true, product is hidden from default admin list. Non-destructive; row and FK history preserved.';

comment on column public.products.record_origin is
  'Provenance: live_catalog, locked_pipeline_fixture, smoke_test_debris, archived_test_debris, etc.';

create index if not exists products_is_archived_idx
  on public.products (is_archived)
  where is_archived = true;

create index if not exists products_record_origin_idx
  on public.products (record_origin)
  where record_origin is not null;

commit;
