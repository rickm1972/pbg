-- Catch-up for hosted projects that predate retailer URL migrations.
-- Safe to run multiple times (IF NOT EXISTS).
alter table public.products
  add column if not exists target_url text,
  add column if not exists walmart_url text,
  add column if not exists other_retailer_label text,
  add column if not exists other_retailer_url text;
