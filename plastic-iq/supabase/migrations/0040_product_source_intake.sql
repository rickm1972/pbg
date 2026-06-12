-- Evidence source intake fields (Agent 1 starting URLs — separate from commerce/affiliate links).

alter table public.products
  add column if not exists primary_retailer_evidence_url text,
  add column if not exists manufacturer_product_url text,
  add column if not exists manufacturer_lab_results_url text,
  add column if not exists manufacturer_materials_faq_url text,
  add column if not exists agent1_source_notes text;

comment on column public.products.primary_retailer_evidence_url is
  'Verified primary retailer evidence URL for Agent 1 (falls back to amazon_url when empty). Not used for buy CTAs.';
comment on column public.products.manufacturer_product_url is
  'Verified manufacturer product detail page for Agent 1 evidence (exact PDP, not homepage).';
comment on column public.products.manufacturer_lab_results_url is
  'Optional manufacturer lab/test results page for Agent 1 retrieval.';
comment on column public.products.manufacturer_materials_faq_url is
  'Optional manufacturer materials/FAQ page for Agent 1 retrieval.';
comment on column public.products.agent1_source_notes is
  'Optional reviewer notes passed to Agent 1 synthesis (source intake hints).';
