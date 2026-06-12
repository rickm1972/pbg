-- Managed taxonomy tables (FK-safe) + product claim intake + products FK columns.

begin;

-- Denormalized products.category text is no longer constrained to a fixed enum;
-- FK-backed product_categories is the source of truth for new intake.
alter table public.products drop constraint if exists products_category_allowed;

create table if not exists public.product_categories (
  category_id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  display_order integer,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_slug_unique unique (slug)
);

create index if not exists product_categories_display_order_idx
  on public.product_categories (display_order);

create index if not exists product_categories_is_archived_idx
  on public.product_categories (is_archived)
  where is_archived = true;

drop trigger if exists trg_product_categories_set_updated_at on public.product_categories;
create trigger trg_product_categories_set_updated_at
before update on public.product_categories
for each row
execute function public.set_date_last_updated();

create table if not exists public.product_subcategories (
  subcategory_id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(category_id),
  name text not null,
  slug text not null,
  display_order integer,
  default_severity numeric,
  default_duration numeric,
  defaults_status text not null,
  defaults_source text,
  registry_key text,
  matrix_key text,
  scoring_assumption_ref text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_subcategories_defaults_status_allowed check (
    defaults_status in ('complete', 'unset', 'role_split')
  ),
  constraint product_subcategories_slug_per_category unique (category_id, slug)
);

create index if not exists product_subcategories_category_id_idx
  on public.product_subcategories (category_id);

create index if not exists product_subcategories_is_archived_idx
  on public.product_subcategories (is_archived)
  where is_archived = true;

drop trigger if exists trg_product_subcategories_set_updated_at on public.product_subcategories;
create trigger trg_product_subcategories_set_updated_at
before update on public.product_subcategories
for each row
execute function public.set_date_last_updated();

alter table public.products
  add column if not exists category_id uuid references public.product_categories(category_id);

alter table public.products
  add column if not exists subcategory_id uuid references public.product_subcategories(subcategory_id);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_subcategory_id_idx on public.products (subcategory_id);

comment on column public.products.category is
  'Denormalized display/cache of product_categories.name during FK transition.';

comment on column public.products.subcategory is
  'Denormalized display/cache of product_subcategories.name during FK transition.';

create table if not exists public.product_claim_intake (
  product_claim_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(product_id) on delete cascade,
  claim_type text not null,
  claim_value text not null,
  claim_source text,
  evidence_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_claim_intake_type_allowed check (
    claim_type in (
      'bpa_free',
      'phthalate_free',
      'pfas_free',
      'lead_free',
      'non_toxic_marketing',
      'third_party_tested',
      'lab_tested'
    )
  ),
  constraint product_claim_intake_value_allowed check (
    claim_value in ('yes', 'no', 'unknown')
  ),
  constraint product_claim_intake_product_type_unique unique (product_id, claim_type)
);

create index if not exists product_claim_intake_product_id_idx
  on public.product_claim_intake (product_id);

drop trigger if exists trg_product_claim_intake_set_updated_at on public.product_claim_intake;
create trigger trg_product_claim_intake_set_updated_at
before update on public.product_claim_intake
for each row
execute function public.set_date_last_updated();

alter table public.product_categories enable row level security;
alter table public.product_subcategories enable row level security;
alter table public.product_claim_intake enable row level security;

drop policy if exists "Public read active product_categories" on public.product_categories;
create policy "Public read active product_categories"
on public.product_categories
for select
using (is_archived = false);

drop policy if exists "Admin manage product_categories" on public.product_categories;
create policy "Admin manage product_categories"
on public.product_categories
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Public read active product_subcategories" on public.product_subcategories;
create policy "Public read active product_subcategories"
on public.product_subcategories
for select
using (is_archived = false);

drop policy if exists "Admin manage product_subcategories" on public.product_subcategories;
create policy "Admin manage product_subcategories"
on public.product_subcategories
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Admin manage product_claim_intake" on public.product_claim_intake;
create policy "Admin manage product_claim_intake"
on public.product_claim_intake
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Public read product_claim_intake for active products" on public.product_claim_intake;
create policy "Public read product_claim_intake for active products"
on public.product_claim_intake
for select
using (exists (
  select 1
  from public.products p
  where p.product_id = product_claim_intake.product_id
    and p.active = true
));

commit;
