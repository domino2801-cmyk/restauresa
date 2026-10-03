create policy "reservations_insert_admin" on public.reservations
for insert to authenticated
with check (public.is_admin() and public.auth_is_validated());

notify pgrst, 'reload schema';
