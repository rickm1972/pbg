-- Optional fourth PDP (Williams Sonoma, brand site, specialty retailer, etc.)
alter table public.products
  add column if not exists other_retailer_label text,
  add column if not exists other_retailer_url text;
