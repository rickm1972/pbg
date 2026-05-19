-- Optional affiliate / product URLs for Target and Walmart (in addition to Amazon columns).
alter table public.products
  add column if not exists target_url text,
  add column if not exists walmart_url text;
