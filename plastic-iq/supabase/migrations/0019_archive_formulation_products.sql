-- V2.3.4: materials-science scope only — hide formulation / dish soap products from public catalog.

begin;

update public.products
set active = false
where trim(coalesce(subcategory, '')) = 'Dish Soap'
   or product_id = 'a0c72167-f0f6-491e-90f7-bbb622fa5123'::uuid;

commit;
