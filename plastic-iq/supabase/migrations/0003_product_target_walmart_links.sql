-- Retailer links (Target / Walmart PDPs). Aligned with seed.sql and src/lib/retailerLinksCatalog.ts

begin;

update public.products
set
  target_url = null,
  walmart_url = 'https://www.walmart.com/ip/Hydro-Flask-Standard-Mouth-Water-Bottle-with-Flex-Cap-Black-21oz-621ml/8381206002'
where product_name = 'Hydro Flask 21oz Standard Mouth Water Bottle';

update public.products
set
  target_url = null,
  walmart_url = 'https://www.walmart.com/ip/Yeti-Rambler-26oz-Bottle/28383528573'
where product_name = 'YETI Rambler 26oz Stainless Steel Bottle';

update public.products
set
  target_url = 'https://www.target.com/p/klean-kanteen-20oz-tkwide-insulated-stainless-steel-water-bottle-with-cafe-cap/-/A-82748478',
  walmart_url = 'https://www.walmart.com/ip/Klean-Kanteen-TKWide-Insulated-Water-Bottle-with-Twist-Cap-Stainless-Steel-Water-Bottle-20-Oz-Black/6410129654'
where product_name = 'Klean Kanteen TKWide 20oz Insulated Bottle';

update public.products
set
  target_url = 'https://www.target.com/p/camelbak-32oz-chute-mag-vacuum-insulated-stainless-steel-water-bottle-beige/-/A-85576851',
  walmart_url = 'https://www.walmart.com/ip/Camelbak-Chute-Mag-Stainless-Steel-Vacuum-Insulated-Bottle/5244933685'
where product_name = 'CamelBak Chute Mag 32oz Stainless Steel';

update public.products
set
  target_url = 'https://www.target.com/p/owala-24oz-stainless-steel-freesip-water-bottle-out-of-the-blue/-/A-94894804',
  walmart_url = 'https://www.walmart.com/ip/Owala-FreeSip-Insulated-Stainless-Steel-Water-Bottle-24-Ounce-Neo-Sage/39039593946'
where product_name = 'Owala FreeSip 24oz Insulated Stainless Steel';

update public.products
set
  target_url = 'https://www.target.com/p/blender-bottle-usa-strada-24-oz-insulated-stainless-steel-shaker-with-loop-top/-/A-84310774',
  walmart_url = 'https://www.walmart.com/ip/BlenderBottle-Strada-Insulated-Stainless-Steel-Shaker-Cup-with-Flip-Cap-24oz-Black/3735632777'
where product_name = 'BlenderBottle Strada 24oz Stainless Steel Shaker';

update public.products
set
  target_url = 'https://www.target.com/p/nalgene-32-fl-oz-50-post-consumer-recycled-plastic-wide-mouth-water-bottle/-/A-94673389',
  walmart_url = 'https://www.walmart.com/ip/Nalgene-32oz-Wide-Mouth-Sustain-Bottle/2346956668'
where product_name = 'Nalgene Sustain 32oz Wide Mouth Bottle';

update public.products
set
  target_url = 'https://www.target.com/p/bentgo-8pc-glass-leak-proof-meal-prep-set-coastal/-/A-88549111',
  walmart_url = 'https://www.walmart.com/ip/Bentgo-Signature-Leak-Proof-Glass-Food-Storage-8-Piece-Set-1-Compartment-Plastic-Free-Containers-Airtight-Glass-Lids-BPA-Free-Microwave-Freezer-Oven/180399509959'
where product_name = 'Bentgo Glass Containers with Tempered Glass Lids Set of 3';

update public.products
set
  target_url = 'https://www.target.com/p/vtopmart-8-pack-glass-food-storage-containers-with-airtight-lids-glass-meal-prep-containers-for-microwave-oven-freezer-and-dishwasher-bpa-free/-/A-1007307911',
  walmart_url = 'https://www.walmart.com/ip/8pcs-Glass-Storage-Container-Set-with-Lids-Vtopmart-Meal-Prep-Containers-Airtight-Bento-Boxes-Gray/5116979629'
where product_name = 'Vtopmart Glass Food Storage Containers with Bamboo Lids 8 Pack';

update public.products
set
  target_url = 'https://www.target.com/p/pyrex-simply-store-8-piece-glass-food-storage-set-4-vessels-and-4-lids-standard-packaging/-/A-88763345',
  walmart_url = 'https://www.walmart.com/ip/Pyrex-18-piece-Glass-Food-Storage-Container-Set-with-Lids/2571045111'
where product_name = 'Pyrex Simply Store 9 Pack Glass Food Storage Set';

update public.products
set
  target_url = 'https://www.target.com/p/glasslock-oven-and-microwave-safe-glass-food-storage-containers-18-piece-set/-/A-76476370',
  walmart_url = 'https://www.walmart.com/ip/Glasslock-Oven-and-Microwave-Safe-Glass-Food-Storage-Containers-18-Piece-Set/16985494312'
where product_name = 'Glasslock Tempered Glass Containers with Locking Lids 18 Piece Set';

update public.products
set
  target_url = null,
  walmart_url = 'https://www.walmart.com/ip/Rubbermaid-Brilliance-Glass-Food-Storage-Containers-8-Cup-Food-Containers-with-Lids-2-Pack/59633111413'
where product_name = 'Rubbermaid Brilliance Glass Storage Set of 9';

update public.products
set
  target_url = 'https://www.target.com/p/rubbermaid-brilliance-10pc-plastic-food-storage-container-set/-/A-91597497',
  walmart_url = 'https://www.walmart.com/ip/Rubbermaid-Brilliance-Leak-Proof-Food-Storage-Containers-10-Piece-Set/5429707814'
where product_name = 'Rubbermaid Brilliance Plastic Food Storage 10 Pack';

update public.products
set
  target_url = 'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925',
  walmart_url = 'https://www.walmart.com/ip/Lodge-10-1-4-Cast-Iron-Skillet/596962815'
where product_name = 'Lodge 10.25 Inch Cast Iron Skillet';

update public.products
set
  target_url = 'https://www.target.com/p/greenpan-valencia-pro-10-34-ceramic-frypan-with-lid-black/-/A-86482934',
  walmart_url = 'https://www.walmart.com/ip/GreenPan-Valencia-Pro-Healthy-Ceramic-Nonstick-10-Frypan/61343940717'
where product_name = 'GreenPan Valencia Pro Ceramic Nonstick Skillet 10 Inch';

update public.products
set
  target_url = null,
  walmart_url = 'https://www.walmart.com/ip/HexClad-10-inch-Hybrid-Stainless-Steel-Frying-Pan-Nonstick/17619936018'
where product_name = 'HexClad Hybrid Nonstick 10 Inch Frying Pan';

update public.products
set
  target_url = 'https://www.target.com/p/t-fal-ultimate-hard-anodized-3pk-fry-pan-set/-/A-87417764',
  walmart_url = 'https://www.walmart.com/ip/T-fal-Ultimate-Hard-Anodized-Non-Stick-Cookware-3-Piece-Frypan-Set-8-inch-10-25-inch-and-12-inch-Grey/83563821619'
where product_name = 'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece';

update public.products
set
  target_url = 'https://www.target.com/p/caraway-home-10-5-ceramic-fry-pan/-/A-84082481',
  walmart_url = null
where product_name = 'Caraway Nonstick Ceramic Frying Pan 10.5 Inch';

update public.products
set
  target_url = null,
  walmart_url = null
where product_name = 'Viking 8 Piece Stainless Steel Cooking Utensil Set';

update public.products
set
  target_url = null,
  walmart_url = 'https://www.walmart.com/ip/OXO-Good-Grips-Stainless-Steel-Prep-Serve-Kitchen-Tool-6pc-Set/2019798401'
where product_name = 'OXO Good Grips 6 Piece Stainless Steel Utensil Set';

update public.products
set
  target_url = 'https://www.target.com/p/joseph-joseph-elevate-6-piece-carousel-utensil-set/-/A-84793467',
  walmart_url = 'https://www.walmart.com/ip/Joseph-Joseph-Elevate-6-Piece-Kitchen-Utensil-Set-Multicolored/14508906925'
where product_name = 'Joseph Joseph Elevate Nylon Cooking Utensil Set 6 Piece';

update public.products
set
  target_url = 'https://www.target.com/p/seventh-generation-free-38-clear-liquid-dish-soap-19-fl-oz/-/A-81400492',
  walmart_url = 'https://www.walmart.com/ip/Seventh-Generation-Dish-Soap-Liquid-Free-Clear-19-oz/13150863529'
where product_name = 'Seventh Generation Free and Clear Dish Soap';

update public.products
set
  target_url = 'https://www.target.com/p/dawn-ultra-original-scent-dishwashing-liquid-dish-soap/-/A-78259812',
  walmart_url = 'https://www.walmart.com/ip/Dawn-Ultra-Dish-Soap-Dishwashing-Liquid-Original-Scent-28-fl-oz/843280151'
where product_name = 'Dawn Ultra Original Scent Dishwashing Liquid';

commit;
