-- Seed Kitchen managed taxonomy (v2.3.5 synced defaults) and backfill product FKs.

begin;

-- Deterministic IDs for tests and reporting.
insert into public.product_categories (
  category_id,
  name,
  slug,
  display_order,
  is_archived
) values (
  'a1111111-1111-4111-8111-111111111101',
  'Kitchen',
  'kitchen',
  1,
  false
)
on conflict (category_id) do update set
  name = excluded.name,
  slug = excluded.slug,
  display_order = excluded.display_order,
  is_archived = excluded.is_archived,
  updated_at = now();

insert into public.product_subcategories (
  subcategory_id,
  category_id,
  name,
  slug,
  display_order,
  default_severity,
  default_duration,
  defaults_status,
  defaults_source,
  registry_key,
  matrix_key,
  scoring_assumption_ref,
  is_archived
) values
  (
    'a1111111-1111-4111-8111-111111111201',
    'a1111111-1111-4111-8111-111111111101',
    'Cookware',
    'cookware',
    1,
    0.96,
    0.50,
    'complete',
    'v2.3.5_source_sync',
    'kitchen.cookware.fry_pan',
    'cookware',
    'v2.3.5.cookware',
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111202',
    'a1111111-1111-4111-8111-111111111101',
    'Cooking Utensils',
    'cooking_utensils',
    2,
    null,
    null,
    'role_split',
    'v2.3.5_role_split',
    'kitchen.utensils.spatula_or_cutting_board',
    'cooking_utensils',
    'v2.3.5.utensils',
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111203',
    'a1111111-1111-4111-8111-111111111101',
    'Food Storage',
    'food_storage',
    3,
    0.83,
    0.75,
    'complete',
    'v2.3.5_source_sync',
    'kitchen.food_storage.storage_container',
    'food_storage',
    'v2.3.5.food_storage',
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111204',
    'a1111111-1111-4111-8111-111111111101',
    'Water Bottles',
    'water_bottles',
    4,
    0.60,
    0.80,
    'complete',
    'v2.3.5_source_sync',
    'kitchen.drinkware.water_bottle',
    'water_bottles',
    'v2.3.5.water_bottles',
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111205',
    'a1111111-1111-4111-8111-111111111101',
    'Drinkware',
    'drinkware',
    5,
    0.60,
    0.80,
    'complete',
    'v2.3.5_source_sync',
    'kitchen.drinkware.tumbler',
    'drinkware',
    'v2.3.5.drinkware',
    false
  )
on conflict (subcategory_id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  slug = excluded.slug,
  display_order = excluded.display_order,
  default_severity = excluded.default_severity,
  default_duration = excluded.default_duration,
  defaults_status = excluded.defaults_status,
  defaults_source = excluded.defaults_source,
  registry_key = excluded.registry_key,
  matrix_key = excluded.matrix_key,
  scoring_assumption_ref = excluded.scoring_assumption_ref,
  is_archived = excluded.is_archived,
  updated_at = now();

-- Backfill FKs for clear Kitchen subcategory matches. Preserve legacy text columns.
update public.products p
set
  category_id = 'a1111111-1111-4111-8111-111111111101',
  subcategory_id = 'a1111111-1111-4111-8111-111111111201'
where p.category = 'Kitchen'
  and p.subcategory = 'Cookware'
  and p.category_id is null;

update public.products p
set
  category_id = 'a1111111-1111-4111-8111-111111111101',
  subcategory_id = 'a1111111-1111-4111-8111-111111111202'
where p.category = 'Kitchen'
  and p.subcategory = 'Cooking Utensils'
  and p.category_id is null;

update public.products p
set
  category_id = 'a1111111-1111-4111-8111-111111111101',
  subcategory_id = 'a1111111-1111-4111-8111-111111111203'
where p.category = 'Kitchen'
  and p.subcategory = 'Food Storage'
  and p.category_id is null;

update public.products p
set
  category_id = 'a1111111-1111-4111-8111-111111111101',
  subcategory_id = 'a1111111-1111-4111-8111-111111111204'
where p.category = 'Kitchen'
  and p.subcategory in ('Water Bottles', 'Water Bottles and Drinkware')
  and p.category_id is null;

update public.products p
set
  category_id = 'a1111111-1111-4111-8111-111111111101',
  subcategory_id = 'a1111111-1111-4111-8111-111111111205'
where p.category = 'Kitchen'
  and p.subcategory = 'Drinkware'
  and p.category_id is null;

commit;
