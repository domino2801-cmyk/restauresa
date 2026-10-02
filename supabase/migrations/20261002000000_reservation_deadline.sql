-- Each meal week closes the preceding Thursday at 14:00 in Paris.
create or replace function public.reservation_deadline(menu_date date)
returns timestamptz
language sql immutable strict
set search_path = ''
as $$
  select (
    (date_trunc('week', menu_date::timestamp)::date - 4) + time '14:00'
  ) at time zone 'Europe/Paris';
$$;

revoke execute on function public.reservation_deadline(date) from public, anon;
grant execute on function public.reservation_deadline(date) to authenticated;

create or replace function public.guard_reservation_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() and exists (
    select 1 from public.menus m
    where m.id = new.menu_id
      and statement_timestamp() >= public.reservation_deadline(m.menu_date)
  ) then
    raise exception 'Réservations clôturées : échéance du jeudi à 14 h (heure de Paris) dépassée'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_reservation_insert() from public, anon, authenticated;
create trigger reservations_insert_guard before insert on public.reservations
  for each row execute function public.guard_reservation_insert();

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
  elsif new.status <> old.status and not exists (
    select 1 from public.menus m
    where m.id = old.menu_id
      and statement_timestamp() < public.reservation_deadline(m.menu_date)
  ) then
    raise exception 'Réservations clôturées : échéance du jeudi à 14 h (heure de Paris) dépassée'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter policy "reservations_insert_own" on public.reservations
  with check (
    user_id = auth.uid()
    and public.auth_is_validated()
    and exists (
      select 1 from public.menus m
      where m.id = reservations.menu_id
        and (
          public.is_admin()
          or statement_timestamp() < public.reservation_deadline(m.menu_date)
        )
    )
  );

alter policy "reservations_update" on public.reservations
  using (
    public.is_admin()
    or public.has_company_role('adu', public.user_company_id(user_id))
    or (
      user_id = auth.uid()
      and public.auth_is_validated()
      and exists (
        select 1 from public.menus m
        where m.id = reservations.menu_id
          and statement_timestamp() < public.reservation_deadline(m.menu_date)
      )
    )
  );
