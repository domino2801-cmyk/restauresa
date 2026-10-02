create function public.rotate_establishment_qr()
returns text language plpgsql security definer set search_path = ''
as $$
declare
  new_token uuid;
begin
  if auth.uid() is null or not public.auth_is_validated() or not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
  update public.establishment_qr set token=gen_random_uuid() where id
  returning token into new_token;
  if not found then
    raise exception 'QR code établissement introuvable' using errcode = '22023';
  end if;
  return 'restauresa:attendance:' || new_token::text;
end;
$$;
revoke execute on function public.rotate_establishment_qr() from public, anon;
grant execute on function public.rotate_establishment_qr() to authenticated;

-- Serialize scans with rotation: an old code cannot validate after rotation commits.
create or replace function public.check_in_meal(qr_content text, selected_service public.meal_service)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  reservation public.reservations%rowtype;
  current_token uuid;
begin
  if auth.uid() is null or not public.auth_is_validated() then
    raise exception 'Un compte activé est requis' using errcode = '42501';
  end if;
  select token into current_token from public.establishment_qr where id for share;
  if qr_content is null or current_token is null
    or qr_content <> 'restauresa:attendance:' || current_token::text then
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
notify pgrst, 'reload schema';
