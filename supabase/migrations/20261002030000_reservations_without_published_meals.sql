-- A dated meal service exists independently of its optional published dish.
alter table public.menus alter column meal_id drop not null;

create or replace function public.ensure_meal_services(from_date date, to_date date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.auth_is_validated() then
    raise exception 'Un compte activé est requis pour consulter les services'
      using errcode = '42501';
  end if;
  if from_date is null or to_date is null or to_date < from_date or to_date - from_date > 30 then
    raise exception 'La période doit contenir entre 1 et 31 jours'
      using errcode = '22023';
  end if;

  insert into public.menus (menu_date, service)
  select from_date + day_offset, meal_service
  from generate_series(0, to_date - from_date) as days(day_offset)
  cross join unnest(enum_range(null::public.meal_service)) as services(meal_service)
  on conflict (menu_date, service) do nothing;

  delete from public.menus
  where meal_id is null
    and menu_date between from_date and to_date;
end;
$$;

revoke execute on function public.ensure_meal_services(date, date) from public, anon;
grant execute on function public.ensure_meal_services(date, date) to authenticated;

notify pgrst, 'reload schema';
