-- Données de démonstration (exécutées par `supabase db reset`).
insert into public.regiments (id, name) values
  ('00000000-0000-0000-0000-000000000001', '1er Régiment d''Infanterie'),
  ('00000000-0000-0000-0000-000000000002', '2e Régiment du Génie');

insert into public.companies (id, regiment_id, name) values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', '1re Compagnie'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', '2e Compagnie'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', 'Compagnie d''appui');

insert into public.sections (company_id, name) values
  ('00000000-0000-0000-0001-000000000001', '1re Section'),
  ('00000000-0000-0000-0001-000000000001', '2e Section'),
  ('00000000-0000-0000-0001-000000000001', '3e Section'),
  ('00000000-0000-0000-0001-000000000002', '1re Section'),
  ('00000000-0000-0000-0001-000000000002', '2e Section'),
  ('00000000-0000-0000-0001-000000000003', 'Section commandement');

insert into public.meals (name, description, category, unit_price) values
  ('Petit-déjeuner continental', 'Café, pain, beurre, confiture, jus', 'Petit-déjeuner', 2.10),
  ('Poulet basquaise', 'Riz pilaf, légumes de saison', 'Plat', 4.80),
  ('Bœuf bourguignon', 'Pommes vapeur', 'Plat', 5.20),
  ('Filet de colin', 'Purée maison, haricots verts', 'Plat', 4.90),
  ('Lasagnes végétariennes', 'Salade verte', 'Végétarien', 4.20),
  ('Soupe et omelette', 'Potage du jour, omelette, fromage', 'Dîner léger', 3.60);
