create table public.establishment_qr (
  id boolean primary key default true check (id),
  token uuid not null default gen_random_uuid()
);
insert into public.establishment_qr(id) values(true);
alter table public.establishment_qr enable row level security;
revoke all on public.establishment_qr from anon, authenticated;

create table public.reservation_checkins (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  checked_at timestamptz not null default statement_timestamp()
);
alter table public.reservation_checkins enable row level security;
revoke all on public.reservation_checkins from anon, authenticated;

create function public.get_establishment_qr()
returns text language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.auth_is_validated() or not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
  return (select 'restauresa:attendance:' || token::text from public.establishment_qr where id);
end;
$$;

create function public.apply_reservation_checkin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.reservations set attended=true where id=new.reservation_id;
  return new;
end;
$$;
create trigger reservation_checkin_attendance after insert on public.reservation_checkins
for each row execute function public.apply_reservation_checkin();

create or replace function public.guard_reservation_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  company_adu boolean;
  deadline timestamptz;
  qr_checkin boolean;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.user_id <> old.user_id or new.menu_id <> old.menu_id then
    raise exception 'Modification non autorisée';
  end if;
  company_adu := public.auth_is_validated()
    and public.has_company_role('adu', public.user_company_id(old.user_id));
  qr_checkin := pg_trigger_depth() > 1 and old.user_id = auth.uid()
    and public.auth_is_validated() and new.attended is true
    and exists(select 1 from public.reservation_checkins where reservation_id=old.id);
  if not company_adu and not qr_checkin then new.attended := old.attended; end if;
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

create function public.check_in_meal(qr_content text, selected_service public.meal_service)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  reservation public.reservations%rowtype;
begin
  if auth.uid() is null or not public.auth_is_validated() then
    raise exception 'Un compte activé est requis' using errcode = '42501';
  end if;
  if qr_content is null or not exists(
    select 1 from public.establishment_qr where id and qr_content='restauresa:attendance:' || token::text
  ) then
    raise exception 'QR code établissement invalide' using errcode = '22023';
  end if;
  if selected_service is null then
    raise exception 'Choisissez un service' using errcode = '22023';
  end if;
  select r.* into reservation from public.reservations r join public.menus m on m.id=r.menu_id
  where r.user_id=auth.uid() and r.status='reserved' and m.service=selected_service
    and m.menu_date=(statement_timestamp() at time zone 'Europe/Paris')::date
  for update of r;
  if not found then
    raise exception 'Aucune réservation confirmée pour ce repas du jour' using errcode = '22023';
  end if;
  if reservation.attended is true or exists(
    select 1 from public.reservation_checkins where reservation_id=reservation.id
  ) then
    raise exception 'Passage déjà validé pour ce repas' using errcode = '22023';
  end if;
  insert into public.reservation_checkins(reservation_id) values(reservation.id);
end;
$$;
revoke execute on function public.get_establishment_qr() from public, anon;
revoke execute on function public.check_in_meal(text, public.meal_service) from public, anon;
revoke execute on function public.apply_reservation_checkin() from public, anon, authenticated;
grant execute on function public.get_establishment_qr() to authenticated;
grant execute on function public.check_in_meal(text, public.meal_service) to authenticated;
notify pgrst, 'reload schema';
