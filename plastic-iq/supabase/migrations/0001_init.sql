-- PACScore initial schema (hosted Supabase)

create extension if not exists "pgcrypto";

-- Keep date_last_updated current on updates.
create or replace function public.set_date_last_updated()
returns trigger
language plpgsql
as $$
begin
  new.date_last_updated = now();
  return new;
end;
$$;

create table if not exists public.products (
  product_id uuid primary key default gen_random_uuid(),
  product_name text not null,
  brand text,
  category text,
  subcategory text,
  description text,
  pac_safety_score integer,
  tier text,
  score_basis text,
  primary_material text,
  secondary_material text,
  bpa_free text,
  phthalate_free_claim text,
  amazon_asin text,
  amazon_url text,
  affiliate_link text,
  target_url text,
  walmart_url text,
  other_retailer_label text,
  other_retailer_url text,
  image_url text,
  date_added timestamptz not null default now(),
  date_last_updated timestamptz not null default now(),
  active boolean not null default true,

  constraint products_pac_safety_score_range check (pac_safety_score is null or (pac_safety_score >= 0 and pac_safety_score <= 100)),
  constraint products_category_allowed check (category is null or category in ('Kitchen', 'Personal Care', 'Home', 'Food and Beverage', 'Fitness and Sports')),
  constraint products_tier_allowed check (tier is null or tier in ('Excellent', 'Good', 'Caution', 'High Risk')),
  constraint products_score_basis_allowed check (score_basis is null or score_basis in ('Lab Verified', 'Based on Materials Science', 'AI Estimated', 'In Testing Queue')),
  constraint products_bpa_free_allowed check (bpa_free is null or bpa_free in ('Yes', 'No', 'Unknown')),
  constraint products_phthalate_free_claim_allowed check (phthalate_free_claim is null or phthalate_free_claim in ('Yes', 'No', 'Unknown'))
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_subcategory_idx on public.products (subcategory);
create index if not exists products_tier_idx on public.products (tier);
create index if not exists products_score_basis_idx on public.products (score_basis);
create index if not exists products_active_idx on public.products (active);
create index if not exists products_pac_safety_score_idx on public.products (pac_safety_score);

drop trigger if exists trg_products_set_date_last_updated on public.products;
create trigger trg_products_set_date_last_updated
before update on public.products
for each row
execute function public.set_date_last_updated();

create table if not exists public.score_details (
  score_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(product_id) on delete cascade,
  ingredient_score integer,
  material_score integer,
  contamination_score integer,
  confidence_notes text,
  data_sources text,
  reviewed_by text,
  review_date timestamptz
);

create index if not exists score_details_product_id_idx on public.score_details (product_id);

create table if not exists public.categories (
  category_id uuid primary key default gen_random_uuid(),
  category_name text,
  subcategory_name text,
  description text,
  display_order integer
);

create index if not exists categories_category_name_idx on public.categories (category_name);
create index if not exists categories_subcategory_name_idx on public.categories (subcategory_name);

-- Row Level Security
alter table public.products enable row level security;
alter table public.score_details enable row level security;
alter table public.categories enable row level security;

-- Public read: only active products; all categories; score details for active products.
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products"
on public.products
for select
using (active = true);

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories"
on public.categories
for select
using (true);

drop policy if exists "Public read score_details for active products" on public.score_details;
create policy "Public read score_details for active products"
on public.score_details
for select
using (exists (
  select 1
  from public.products p
  where p.product_id = score_details.product_id
    and p.active = true
));

-- Admin write (simple): any authenticated user can manage content.
drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin manage categories" on public.categories;
create policy "Admin manage categories"
on public.categories
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admin manage score_details" on public.score_details;
create policy "Admin manage score_details"
on public.score_details
for all
to authenticated
using (true)
with check (true);

