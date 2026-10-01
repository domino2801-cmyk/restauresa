-- =============================================================================
-- RestauResa — schéma initial
--
-- Organisation : régiment > compagnie > section
-- Rôles        : admin (Administrateur), adu (Adjudant de compagnie),
--                cdu (Commandant de compagnie), user (Militaire)
-- Données      : catalogue des repas, menus (date + service), réservations,
--                validations d'effectifs (soumises par l'ADU, revues par le CDU)
--
-- Toutes les tables sont protégées par Row Level Security (RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'adu', 'cdu', 'user');
create type public.meal_service as enum ('petit_dejeuner', 'dejeuner', 'diner');
create type public.reservation_status as enum ('reserved', 'cancelled');
create type public.headcount_status as enum ('submitted', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Organisation
-- -----------------------------------------------------------------------------
create table public.regiments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  regiment_id uuid not null references public.regiments (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (regiment_id, name)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index companies_regiment_id_idx on public.companies (regiment_id);
create index sections_company_id_idx on public.sections (company_id);

-- -----------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  role public.app_role not null default 'user',
  regiment_id uuid references public.regiments (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  is_validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles (company_id);
create index profiles_full_name_lower_idx on public.profiles (lower(full_name));

-- -----------------------------------------------------------------------------
-- Repas, menus, réservations
-- -----------------------------------------------------------------------------
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  category text,
  unit_price numeric(8, 2) not null default 0 check (unit_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null,
  service public.meal_service not null,
  meal_id uuid not null references public.meals (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (menu_date, service)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  status public.reservation_status not null default 'reserved',
  attended boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, menu_id)
);

create index reservations_menu_id_idx on public.reservations (menu_id);

-- Validation des effectifs d'une compagnie pour un menu (soumise par l'ADU,
-- revue par le CDU) avant transmission aux cuisines.
create table public.headcount_validations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  reserved_count integer not null check (reserved_count >= 0),
  total_members integer not null check (total_members >= 0),
  status public.headcount_status not null default 'submitted',
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  comment text,
  unique (company_id, menu_id)
);

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires (SECURITY DEFINER pour éviter la récursion RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.auth_is_validated()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_validated from public.profiles where id = auth.uid()), false)
$$;

-- Compagnie d'un utilisateur donné.
create or replace function public.user_company_id(p_user_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select company_id from public.profiles where id = p_user_id
$$;

-- Vrai si l'utilisateur connecté (validé) a le rôle donné dans la compagnie donnée.
create or replace function public.has_company_role(p_role public.app_role, p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select role = p_role and is_validated and company_id = p_company_id
    from public.profiles where id = auth.uid()
  ), false)
$$;

-- Vrai si l'utilisateur connecté est ADU ou CDU (validé) de la compagnie donnée.
create or replace function public.is_company_manager(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_company_role('adu', p_company_id)
      or public.has_company_role('cdu', p_company_id)
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger reservations_touch before update on public.reservations
  for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription (métadonnées passées par
-- supabase.auth.signUp({ options: { data } })). Le rattachement n'est conservé
-- que si la hiérarchie régiment > compagnie > section est cohérente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_regiment uuid;
  v_company uuid;
  v_section uuid;
begin
  begin
    select r.id, c.id, s.id into v_regiment, v_company, v_section
    from public.sections s
    join public.companies c on c.id = s.company_id
    join public.regiments r on r.id = c.regiment_id
    where s.id = (v_meta ->> 'section_id')::uuid
      and c.id = (v_meta ->> 'company_id')::uuid
      and r.id = (v_meta ->> 'regiment_id')::uuid;
  exception when invalid_text_representation then
    v_regiment := null; v_company := null; v_section := null;
  end;

  insert into public.profiles (id, full_name, email, regiment_id, company_id, section_id)
  values (
    new.id,
    left(coalesce(nullif(trim(v_meta ->> 'full_name'), ''), split_part(new.email, '@', 1)), 120),
    new.email,
    v_regiment, v_company, v_section
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde-fous sur les profils :
--  * un non-administrateur ne peut modifier ni son rôle, ni sa validation, ni
--    son rattachement, ni son email ;
--  * le rattachement saisi doit être cohérent (section ∈ compagnie ∈ régiment).
--    (Contrôle ignoré lors des mises à jour en cascade des clés étrangères.)
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_validated := old.is_validated;
    new.regiment_id := old.regiment_id;
    new.company_id := old.company_id;
    new.section_id := old.section_id;
    new.email := old.email;
  end if;

  if pg_trigger_depth() = 1 then
    if new.company_id is not null and not exists (
      select 1 from public.companies
      where id = new.company_id and regiment_id is not distinct from new.regiment_id
    ) then
      raise exception 'La compagnie n''appartient pas au régiment sélectionné';
    end if;

    if new.section_id is not null and not exists (
      select 1 from public.sections
      where id = new.section_id and company_id is not distinct from new.company_id
    ) then
      raise exception 'La section n''appartient pas à la compagnie sélectionnée';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Garde-fous sur les réservations :
--  * le titulaire ne peut changer que le statut (réserver / annuler) ;
--  * l'ADU de la compagnie ne peut changer que la présence (attended).
create or replace function public.guard_reservation_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.user_id <> old.user_id or new.menu_id <> old.menu_id then
    raise exception 'Modification non autorisée';
  end if;

  if not public.has_company_role('adu', public.user_company_id(old.user_id)) then
    new.attended := old.attended;
  end if;

  if old.user_id <> auth.uid() then
    new.status := old.status;
  end if;

  return new;
end;
$$;

create trigger reservations_guard before update on public.reservations
  for each row execute function public.guard_reservation_update();

-- Garde-fous sur les validations d'effectifs :
--  * l'ADU soumet (statut forcé à 'submitted') ; une nouvelle soumission
--    efface la revue précédente ;
--  * le CDU ne peut modifier que la décision (statut + commentaire).
create or replace function public.guard_headcount()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_reviewer boolean := false;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_is_reviewer := public.has_company_role('cdu', old.company_id);
  end if;

  if v_is_reviewer then
    new.company_id := old.company_id;
    new.menu_id := old.menu_id;
    new.reserved_count := old.reserved_count;
    new.total_members := old.total_members;
    new.submitted_by := old.submitted_by;
    new.submitted_at := old.submitted_at;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  else
    new.status := 'submitted';
    new.submitted_by := auth.uid();
    new.submitted_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.comment := null;
  end if;

  return new;
end;
$$;

create trigger headcount_guard before insert or update on public.headcount_validations
  for each row execute function public.guard_headcount();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.regiments enable row level security;
alter table public.companies enable row level security;
alter table public.sections enable row level security;
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.menus enable row level security;
alter table public.reservations enable row level security;
alter table public.headcount_validations enable row level security;

-- Organisation : lisible par tous (nécessaire au formulaire d'inscription),
-- modifiable uniquement par l'administrateur.
create policy "regiments_read" on public.regiments for select to anon, authenticated using (true);
create policy "regiments_admin" on public.regiments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "companies_read" on public.companies for select to anon, authenticated using (true);
create policy "companies_admin" on public.companies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "sections_read" on public.sections for select to anon, authenticated using (true);
create policy "sections_admin" on public.sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profils : chacun voit le sien ; ADU/CDU voient leur compagnie ; admin voit tout.
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_company_manager(company_id)
  );
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_delete" on public.profiles for delete to authenticated
  using (public.is_admin());

-- Catalogue et menus : lecture pour tout utilisateur connecté, écriture admin.
create policy "meals_read" on public.meals for select to authenticated using (true);
create policy "meals_admin" on public.meals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "menus_read" on public.menus for select to authenticated using (true);
create policy "menus_admin" on public.menus for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Réservations : chacun voit les siennes ; ADU/CDU voient celles de leur
-- compagnie ; admin voit tout.
create policy "reservations_select" on public.reservations for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_company_manager(public.user_company_id(user_id))
  );

-- Un militaire validé réserve pour lui-même, uniquement pour un menu à venir.
create policy "reservations_insert_own" on public.reservations for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.auth_is_validated()
    and exists (
      select 1 from public.menus m
      where m.id = reservations.menu_id and m.menu_date >= current_date
    )
  );

-- Mise à jour : le titulaire (menu à venir), l'ADU de sa compagnie (présence)
-- ou l'administrateur. Les colonnes modifiables sont limitées par trigger.
create policy "reservations_update" on public.reservations for update to authenticated
  using (
    public.is_admin()
    or public.has_company_role('adu', public.user_company_id(user_id))
    or (
      user_id = auth.uid()
      and public.auth_is_validated()
      and exists (
        select 1 from public.menus m
        where m.id = reservations.menu_id and m.menu_date >= current_date
      )
    )
  )
  with check (
    public.is_admin()
    or public.has_company_role('adu', public.user_company_id(user_id))
    or user_id = auth.uid()
  );

create policy "reservations_delete_admin" on public.reservations for delete to authenticated
  using (public.is_admin());

-- Validations d'effectifs : visibles par l'ADU/CDU de la compagnie et l'admin.
create policy "headcount_select" on public.headcount_validations for select to authenticated
  using (public.is_admin() or public.is_company_manager(company_id));

create policy "headcount_insert" on public.headcount_validations for insert to authenticated
  with check (public.is_admin() or public.has_company_role('adu', company_id));

-- L'ADU peut re-soumettre tant que l'effectif n'est pas approuvé ; le CDU décide.
create policy "headcount_update" on public.headcount_validations for update to authenticated
  using (
    public.is_admin()
    or public.has_company_role('cdu', company_id)
    or (public.has_company_role('adu', company_id) and status <> 'approved')
  )
  with check (
    public.is_admin()
    or public.has_company_role('cdu', company_id)
    or public.has_company_role('adu', company_id)
  );

create policy "headcount_delete_admin" on public.headcount_validations for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Droits d'exécution des fonctions de trigger (non appelables via l'API)
-- -----------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.guard_reservation_update() from public, anon, authenticated;
revoke execute on function public.guard_headcount() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Connexion par nom : résolution nom -> email, réservée au service_role
-- (appelée uniquement par l'Edge Function `login-by-name`, jamais exposée aux
-- clients afin de ne pas divulguer les adresses email).
-- Ne renvoie un email que si le nom désigne un unique compte.
-- -----------------------------------------------------------------------------
create or replace function public.login_email_for_name(p_name text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when count(*) = 1 then min(email) end
  from public.profiles
  where lower(trim(full_name)) = lower(trim(p_name))
$$;

revoke execute on function public.login_email_for_name(text) from public, anon, authenticated;
grant execute on function public.login_email_for_name(text) to service_role;
