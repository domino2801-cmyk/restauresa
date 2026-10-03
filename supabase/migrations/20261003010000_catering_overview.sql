alter table public.reservations add column attended_at timestamptz;

update public.reservations r
set attended_at = c.checked_at
from public.reservation_checkins c
where c.reservation_id = r.id and r.attended is true;

-- Runs after reservations_guard: timestamps reflect the permitted attendance change.
create function public.record_attendance_time()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.attended_at := null;
  elsif new.attended is true and old.attended is distinct from true then
    new.attended_at := statement_timestamp();
  elsif new.attended is not true then
    new.attended_at := null;
  else
    new.attended_at := old.attended_at;
  end if;
  return new;
end;
$$;
create trigger reservations_passage_time before insert or update on public.reservations
for each row execute function public.record_attendance_time();
revoke execute on function public.record_attendance_time() from public, anon, authenticated;

create function public.get_catering_overview(from_date date, to_date date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  services jsonb;
  half_hours jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_validated and role in ('admin', 'restauration')
  ) then
    raise exception 'Accès réservé à la restauration et aux administrateurs'
      using errcode = '42501';
  end if;
  if from_date is null or to_date is null or to_date < from_date or to_date - from_date > 30 then
    raise exception 'La période doit contenir entre 1 et 31 jours' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(row_data order by menu_date, service), '[]'::jsonb)
  into services from (
    select m.menu_date, m.service, jsonb_build_object(
      'day', m.menu_date, 'service', m.service,
      'reserved', count(r.id),
      'passed', count(r.id) filter (where r.attended is true),
      'absent', count(r.id) filter (where r.attended is false),
      'unchecked', count(r.id) filter (where r.attended is null),
      'unknown_time', count(r.id) filter (where r.attended is true and r.attended_at is null),
      'other_day', count(r.id) filter (
        where r.attended is true and r.attended_at is not null
          and (r.attended_at at time zone 'Europe/Paris')::date <> m.menu_date
      )
    ) as row_data
    from public.menus m
    left join public.reservations r on r.menu_id = m.id and r.status = 'reserved'
    where m.menu_date between from_date and to_date
    group by m.menu_date, m.service
  ) aggregated;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', menu_date, 'service', service, 'slot', slot, 'passed', passed
  ) order by menu_date, service, slot), '[]'::jsonb)
  into half_hours from (
    select m.menu_date, m.service,
      to_char(date_trunc('hour', r.attended_at at time zone 'Europe/Paris')
        + case when extract(minute from r.attended_at at time zone 'Europe/Paris') >= 30
          then interval '30 minutes' else interval '0 minutes' end, 'HH24:MI') as slot,
      count(*) as passed
    from public.reservations r join public.menus m on m.id = r.menu_id
    where m.menu_date between from_date and to_date
      and r.status = 'reserved' and r.attended is true and r.attended_at is not null
      and (r.attended_at at time zone 'Europe/Paris')::date = m.menu_date
    group by m.menu_date, m.service, slot
  ) aggregated;

  return jsonb_build_object('services', services, 'half_hours', half_hours);
end;
$$;
revoke execute on function public.get_catering_overview(date, date) from public, anon;
grant execute on function public.get_catering_overview(date, date) to authenticated;
notify pgrst, 'reload schema';
