-- =====================================================================
-- GharFresh | 007 | Starter catalogue: 1 delivery area, 7 categories, 20 products WITH images
-- Run in the SQL Editor of the GharFresh project. Safe to run again:
-- it will not duplicate rows, and it fills in images/descriptions on existing ones.
-- PRICES ARE SAMPLES: change them in Admin > Products.
-- (Everything runs inside ONE block, so it works even in the Supabase SQL Editor.)
-- =====================================================================

do $$
declare r record;
begin
  insert into public.societies (name, city, pincode, is_serviceable, delivery_fee)
  select 'Demo Area (rename me)', 'Jaipur', '000000', true, 0
  where not exists (select 1 from public.societies);

  insert into public.categories (name, slug, sort_order) values
    ('Milk', 'milk', 1),
    ('Curd & Drinks', 'curd-drinks', 2),
    ('Paneer', 'paneer', 3),
    ('Ghee & Butter', 'ghee-butter', 4),
    ('Eggs', 'eggs', 5),
    ('Bread', 'bread', 6),
    ('Pantry', 'pantry', 7)
  on conflict (slug) do nothing;

  for r in
    select * from (values
  ('milk','Farm Fresh Cow Milk','500 ml',30,28,true,'/products/cow-milk-500ml.svg','Fresh cow milk from partner farms, packed the same morning and delivered before 7:30 AM. Pasteurised, no added preservatives.'),
  ('milk','Farm Fresh Cow Milk','1 L',58,55,true,'/products/cow-milk-1l.svg','Fresh cow milk from partner farms, packed the same morning and delivered before 7:30 AM. Pasteurised, no added preservatives.'),
  ('milk','Buffalo Milk','500 ml',38,36,true,'/products/buffalo-milk-500ml.svg','Thick, creamy full-fat buffalo milk. Great for tea, sweets and curd.'),
  ('milk','Buffalo Milk','1 L',74,70,true,'/products/buffalo-milk-1l.svg','Thick, creamy full-fat buffalo milk. Great for tea, sweets and curd.'),
  ('milk','A2 Desi Cow Milk','1 L',90,85,true,'/products/a2-desi-cow-milk-1l.svg','A2 milk from desi cows. Naturally rich and easy to digest.'),
  ('curd-drinks','Fresh Set Curd','400 g',40,38,true,'/products/set-curd-400g.svg','Thick set curd made fresh every day from farm milk.'),
  ('curd-drinks','Fresh Set Curd','1 kg',95,90,true,'/products/set-curd-1kg.svg','Thick set curd made fresh every day from farm milk. Family pack.'),
  ('curd-drinks','Masala Chaas (Buttermilk)','500 ml',25,22,true,'/products/masala-chaas-500ml.svg','Lightly spiced buttermilk with roasted cumin. Chilled and ready to drink.'),
  ('curd-drinks','Sweet Lassi','200 ml',30,28,true,'/products/sweet-lassi-200ml.svg','Thick sweet lassi made from fresh curd.'),
  ('paneer','Fresh Paneer','200 g',85,80,true,'/products/paneer-200g.svg','Soft, fresh paneer made from whole milk. No preservatives.'),
  ('paneer','Fresh Paneer','500 g',205,195,true,'/products/paneer-500g.svg','Soft, fresh paneer made from whole milk. No preservatives. Family pack.'),
  ('ghee-butter','Desi Cow Ghee','500 ml',480,450,false,'/products/desi-cow-ghee-500ml.svg','Traditional slow-cooked cow ghee with a rich aroma.'),
  ('ghee-butter','A2 Bilona Ghee','500 ml',780,730,false,'/products/a2-bilona-ghee-500ml.svg','Made by the bilona method from A2 milk curd. Granular texture and rich flavour.'),
  ('ghee-butter','White Butter (Makhan)','100 g',58,55,true,'/products/white-butter-100g.svg','Fresh unsalted white butter, churned from farm cream.'),
  ('eggs','Farm Fresh Eggs','6 pcs',60,55,true,'/products/farm-eggs-6.svg','Fresh eggs from partner poultry farms.'),
  ('eggs','Farm Fresh Eggs','12 pcs',115,108,true,'/products/farm-eggs-12.svg','Fresh eggs from partner poultry farms. Tray of 12.'),
  ('eggs','Country (Desi) Eggs','6 pcs',90,84,true,'/products/desi-eggs-6.svg','Free-range country eggs with a rich yolk.'),
  ('bread','Whole Wheat Bread','400 g',45,42,true,'/products/whole-wheat-bread-400g.svg','Soft whole wheat bread, baked fresh.'),
  ('bread','Multigrain Bread','400 g',55,50,true,'/products/multigrain-bread-400g.svg','Soft multigrain bread with seeds, baked fresh.'),
  ('pantry','Raw Forest Honey','500 g',330,299,false,'/products/raw-forest-honey-500g.svg','Raw, unprocessed honey collected from forest hives.')
    ) as t(cat, name, pack, mrp, price, sub_ok, img, descr)
  loop
    -- add the product if it is missing
    insert into public.products (category_id, name, description, image_url, pack_size, mrp,
                                 selling_price, is_subscription_allowed, stock, quality_info)
    select c.id, r.name, r.descr, r.img, r.pack, r.mrp, r.price, r.sub_ok, 100,
           jsonb_build_object('source', 'Partner farms', 'delivery', 'Before 7:30 AM')
      from public.categories c
     where c.slug = r.cat
       and not exists (select 1 from public.products p where p.name = r.name and p.pack_size = r.pack);

    -- fill image / description / category on an existing row (keeps your prices and stock)
    update public.products p
       set image_url = coalesce(p.image_url, r.img),
           description = coalesce(p.description, r.descr),
           category_id = coalesce(p.category_id, c.id)
      from public.categories c
     where c.slug = r.cat and p.name = r.name and p.pack_size = r.pack;
  end loop;
end $$;

-- result check
select (select count(*) from public.products) as products,
       (select count(*) from public.products where image_url is not null) as with_images,
       (select count(*) from public.categories) as categories,
       (select count(*) from public.societies) as areas;
