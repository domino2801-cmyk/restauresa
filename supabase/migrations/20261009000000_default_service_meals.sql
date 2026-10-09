-- Keep service identities and reservations, replacing unpublished dishes.
alter table public.meals add column is_service boolean not null default false;
create unique index meals_single_service_idx on public.meals (is_service) where is_service;

update public.meals
set is_service = true, is_active = true, name = 'Repas de service'
where id = (
  select id from public.meals where lower(trim(name)) = 'repas de service'
  order by is_active desc, created_at, id limit 1
);
insert into public.meals (name, is_service)
select 'Repas de service', true
where not exists (select 1 from public.meals where is_service);

create function public.protect_service_meal()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.is_service then
    if tg_op = 'DELETE' then
      raise exception 'Le repas de service ne peut pas être supprimé' using errcode = '23514';
    end if;
    if not new.is_service or not new.is_active or new.name <> old.name or new.id <> old.id then
      raise exception 'Le repas de service doit rester disponible' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_service_meal before update or delete on public.meals
for each row execute function public.protect_service_meal();

create function public.default_menu_meal()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  available boolean;
begin
  -- Serialize publication with dish deactivation.
  select is_active into available from public.meals where id = new.meal_id for share;
  if new.meal_id is null or available = false then
    select id into new.meal_id from public.meals where is_service for share;
  end if;
  return new;
end;
$$;
create trigger default_menu_meal before insert or update of meal_id on public.menus
for each row execute function public.default_menu_meal();

create function public.unpublish_inactive_meal()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    update public.menus set meal_id = null where meal_id = new.id;
  end if;
  return new;
end;
$$;
create trigger unpublish_inactive_meal after update of is_active on public.meals
for each row execute function public.unpublish_inactive_meal();

update public.menus
set meal_id = null
where meal_id is null
  or meal_id in (select id from public.meals where not is_active);
alter table public.menus alter column meal_id set not null;

-- Non-admin API clients no longer receive inactive catalogue entries.
alter policy "meals_read" on public.meals using (is_active);

revoke execute on function public.protect_service_meal() from public, anon, authenticated;
revoke execute on function public.default_menu_meal() from public, anon, authenticated;
revoke execute on function public.unpublish_inactive_meal() from public, anon, authenticated;

notify pgrst, 'reload schema';
