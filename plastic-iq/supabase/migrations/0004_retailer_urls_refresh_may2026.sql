-- If you already ran an older 0003, apply these PDP corrections (idempotent vs current 0003).

begin;

update public.products
set
  target_url = 'https://www.target.com/p/camelbak-32oz-chute-mag-vacuum-insulated-stainless-steel-water-bottle-beige/-/A-85576851',
  walmart_url = 'https://www.walmart.com/ip/Camelbak-Chute-Mag-Stainless-Steel-Vacuum-Insulated-Bottle/5244933685'
where product_name = 'CamelBak Chute Mag 32oz Stainless Steel';

update public.products
set
  walmart_url = 'https://www.walmart.com/ip/BlenderBottle-Strada-Insulated-Stainless-Steel-Shaker-Cup-with-Flip-Cap-24oz-Black/3735632777'
where product_name = 'BlenderBottle Strada 24oz Stainless Steel Shaker';

update public.products
set
  walmart_url = 'https://www.walmart.com/ip/Nalgene-32oz-Wide-Mouth-Sustain-Bottle/2346956668'
where product_name = 'Nalgene Sustain 32oz Wide Mouth Bottle';

update public.products
set
  walmart_url = 'https://www.walmart.com/ip/8pcs-Glass-Storage-Container-Set-with-Lids-Vtopmart-Meal-Prep-Containers-Airtight-Bento-Boxes-Gray/5116979629'
where product_name = 'Vtopmart Glass Food Storage Containers with Bamboo Lids 8 Pack';

update public.products
set
  walmart_url = 'https://www.walmart.com/ip/Glasslock-Oven-and-Microwave-Safe-Glass-Food-Storage-Containers-18-Piece-Set/16985494312'
where product_name = 'Glasslock Tempered Glass Containers with Locking Lids 18 Piece Set';

update public.products
set
  walmart_url = 'https://www.walmart.com/ip/T-fal-Ultimate-Hard-Anodized-Non-Stick-Cookware-3-Piece-Frypan-Set-8-inch-10-25-inch-and-12-inch-Grey/83563821619'
where product_name = 'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece';

update public.products
set
  target_url = null,
  walmart_url = null
where product_name = 'Viking 8 Piece Stainless Steel Cooking Utensil Set';

commit;
