-- Données de démonstration (exécutées par `supabase db reset`).
insert into public.regiments (id, name) values
  ('00000000-0000-0000-0000-000000000001', '1er Régiment d''Infanterie');

insert into public.companies (id, regiment_id, name) values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', '1CIE'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', '2CIE'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', '3CIE'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', '4CIE'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', '5CIE'),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', '6CIE'),
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', 'CLR'),
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000001', '9CIE'),
  ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0000-000000000001', 'CA'),
  ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0000-000000000001', 'CCL'),
  ('00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000001', 'CMA'),
  ('00000000-0000-0000-0001-000000000012', '00000000-0000-0000-0000-000000000001', 'CRE'),
  ('00000000-0000-0000-0001-000000000013', '00000000-0000-0000-0000-000000000001', 'GSC'),
  ('00000000-0000-0000-0001-000000000014', '00000000-0000-0000-0000-000000000001', 'PASSAGERS');

insert into public.sections (company_id, name)
select c.id, s.name
from public.companies c
cross join (values
  ('1ERE SECTION'),
  ('2EME SECTION'),
  ('3EME SECTION'),
  ('SECTION CDT')
) as s(name)
where c.regiment_id = '00000000-0000-0000-0000-000000000001';

insert into public.meals (name, description, category, unit_price) values
  ('Petit-déjeuner continental', 'Café, pain, beurre, confiture, jus', 'Petit-déjeuner', 2.10),
  ('Poulet basquaise', 'Riz pilaf, légumes de saison', 'Plat', 4.80),
  ('Bœuf bourguignon', 'Pommes vapeur', 'Plat', 5.20),
  ('Filet de colin', 'Purée maison, haricots verts', 'Plat', 4.90),
  ('Lasagnes végétariennes', 'Salade verte', 'Végétarien', 4.20),
  ('Soupe et omelette', 'Potage du jour, omelette, fromage', 'Dîner léger', 3.60);
