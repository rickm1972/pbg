-- Phase 0.25: frozen published display snapshots + mutable commerce/affiliate layer.
-- Display snapshots are immutable once published; commerce links update without APR regen.

begin;

create table if not exists public.published_display_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  contract_version text not null,
  content_hash text not null,
  payload jsonb not null,
  parent_hashes jsonb not null default '{}'::jsonb,
  published_at timestamptz not null,
  is_active boolean not null default true,
  superseded_by uuid references public.published_display_snapshots (snapshot_id),
  created_at timestamptz not null default now(),
  constraint published_display_snapshots_product_hash_uidx unique (product_id, content_hash)
);

comment on table public.published_display_snapshots is
  'Frozen public-render display+score payload at publish time. buy_cta URLs are NOT stored — commerce layer supplies CTAs.';

create unique index if not exists published_display_snapshots_one_active_per_product_uidx
  on public.published_display_snapshots (product_id)
  where is_active = true;

create index if not exists published_display_snapshots_product_published_idx
  on public.published_display_snapshots (product_id, published_at desc);

create table if not exists public.product_commerce_links (
  link_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  retailer_key text not null check (retailer_key in ('amazon', 'target', 'walmart', 'other')),
  retailer_name text not null,
  canonical_url text,
  affiliate_url text not null,
  active boolean not null default true,
  priority integer not null default 0,
  disclosure_required boolean not null default true,
  last_checked timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.product_commerce_links is
  'Mutable affiliate/commerce CTAs. Updates do not require APR regen or display snapshot replacement.';

create index if not exists product_commerce_links_product_active_priority_idx
  on public.product_commerce_links (product_id, active desc, priority asc);

create table if not exists public.commerce_link_events (
  event_id uuid primary key default gen_random_uuid(),
  link_id uuid references public.product_commerce_links (link_id) on delete set null,
  product_id uuid not null references public.products (product_id) on delete cascade,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

comment on table public.commerce_link_events is
  'Audit log for commerce/affiliate link changes — separate from APR truth.';

create table if not exists public.display_regression_manifest (
  manifest_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  field_path text not null,
  reason text not null,
  requires_republish boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.display_regression_manifest is
  'Explicit allow-list for expected diffs in published display regression gate.';

create table if not exists public.display_update_proposals (
  proposal_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (product_id) on delete cascade,
  current_snapshot_id uuid references public.published_display_snapshots (snapshot_id),
  proposed_payload jsonb not null,
  diff_summary jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);

comment on table public.display_update_proposals is
  'Admin workflow: deliberate display snapshot updates require human approval before activation.';

commit;
