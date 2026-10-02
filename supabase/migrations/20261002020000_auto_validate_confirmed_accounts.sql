create or replace function public.set_initial_profile_validation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.is_validated := exists (
    select 1 from auth.users u where u.id = new.id and u.email_confirmed_at is not null
  );
  return new;
end;
$$;

revoke execute on function public.set_initial_profile_validation() from public, anon, authenticated;
create trigger profiles_initial_validation before insert on public.profiles
  for each row execute function public.set_initial_profile_validation();

create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    -- Only a nested server trigger may activate a confirmed account.
    new.is_validated := old.is_validated or (
      pg_trigger_depth() > 1 and new.is_validated and exists (
        select 1 from auth.users u where u.id = old.id and u.email_confirmed_at is not null
      )
    );
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

create or replace function public.validate_profile_on_email_confirmation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set is_validated = true
  where id = new.id and not is_validated;
  return new;
end;
$$;

revoke execute on function public.validate_profile_on_email_confirmation() from public, anon, authenticated;
create trigger on_auth_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.validate_profile_on_email_confirmation();

update public.profiles p
set is_validated = true
from auth.users u
where p.id = u.id and not p.is_validated and u.email_confirmed_at is not null;
