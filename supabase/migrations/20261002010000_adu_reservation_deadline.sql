create or replace function public.adu_reservation_deadline(menu_date date)
returns timestamptz
language sql immutable strict set search_path = ''
as $$
  select ((menu_date - 2) + time '14:00') at time zone 'Europe/Paris';
$$;

revoke execute on function public.adu_reservation_deadline(date) from public, anon;
grant execute on function public.adu_reservation_deadline(date) to authenticated;

create or replace function public.guard_reservation_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;

  select case
    when public.auth_is_validated()
      and public.has_company_role('adu', public.user_company_id(new.user_id))
      then public.adu_reservation_deadline(m.menu_date)
    else public.reservation_deadline(m.menu_date)
  end into deadline from public.menus m where m.id = new.menu_id;

  if statement_timestamp() >= deadline then
    raise exception 'Réservations clôturées : échéance dépassée (heure de Paris)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_reservation_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  company_adu boolean;
  deadline timestamptz;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.user_id <> old.user_id or new.menu_id <> old.menu_id then
    raise exception 'Modification non autorisée';
  end if;

  company_adu := public.auth_is_validated()
    and public.has_company_role('adu', public.user_company_id(old.user_id));
  if not company_adu then new.attended := old.attended; end if;

  if company_adu or old.user_id = auth.uid() then
    if new.status <> old.status then
      select case when company_adu then public.adu_reservation_deadline(m.menu_date)
        else public.reservation_deadline(m.menu_date) end
      into deadline from public.menus m where m.id = old.menu_id;
      if statement_timestamp() >= deadline then
        raise exception 'Réservations clôturées : échéance dépassée (heure de Paris)'
          using errcode = '42501';
      end if;
    end if;
  else
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- The RPC is the only additional insertion path for company-wide ADU changes.
create or replace function public.set_company_reservation(
  target_user_id uuid, target_menu_id uuid, reserve boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  meal_date date;
begin
  if auth.uid() is null or not public.auth_is_validated()
    or not public.has_company_role('adu', public.user_company_id(target_user_id)) then
    raise exception 'Accès réservé à l''ADU de la CIE du personnel sélectionné'
      using errcode = '42501';
  end if;
  if reserve is null then
    raise exception 'Choix de réservation requis' using errcode = '22023';
  end if;
  select menu_date into meal_date from public.menus where id = target_menu_id;
  if not found then
    raise exception 'Menu introuvable' using errcode = '22023';
  end if;
  if statement_timestamp() >= public.adu_reservation_deadline(meal_date) then
    raise exception 'Modifications ADU clôturées : échéance de J-2 à 14 h (heure de Paris) dépassée'
      using errcode = '42501';
  end if;

  insert into public.reservations (user_id, menu_id, status)
  values (target_user_id, target_menu_id,
    case when reserve then 'reserved'::public.reservation_status
      else 'cancelled'::public.reservation_status end)
  on conflict (user_id, menu_id) do update set status = excluded.status;
end;
$$;

revoke execute on function public.set_company_reservation(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_company_reservation(uuid, uuid, boolean) to authenticated;
