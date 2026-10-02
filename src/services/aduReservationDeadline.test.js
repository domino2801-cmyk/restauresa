// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aduReservationDeadline } from '../lib/dates'

let db
const adu = '00000000-0000-0000-0000-000000000001'
const member = '00000000-0000-0000-0000-000000000002'
const outsider = '00000000-0000-0000-0000-000000000003'
const openMenu = '00000000-0000-0000-0000-000000000010'
const closedMenu = '00000000-0000-0000-0000-000000000011'
const migrations = ['20261002000000_reservation_deadline.sql', '20261002010000_adu_reservation_deadline.sql']
  .map((name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create type public.reservation_status as enum ('reserved', 'cancelled');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid;
    $$;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.role', true), '') = 'admin';
    $$;
    create function public.auth_is_validated() returns boolean language sql stable as $$
      select coalesce(current_setting('test.validated', true), 'true')::boolean;
    $$;
    create function public.user_company_id(uuid) returns uuid language sql stable as $$
      select case when $1 = '${outsider}' then '${outsider}'::uuid else '${adu}'::uuid end;
    $$;
    create function public.has_company_role(text, uuid) returns boolean language sql stable as $$
      select coalesce(current_setting('test.role', true), '') = $1
        and $2 = public.user_company_id(auth.uid());
    $$;
    create table public.menus (id uuid primary key, menu_date date not null);
    create table public.reservations (
      id integer generated always as identity primary key,
      user_id uuid not null, menu_id uuid not null references public.menus(id),
      status public.reservation_status not null, attended boolean,
      unique (user_id, menu_id)
    );
    alter table public.reservations enable row level security;
    create policy reservations_select on public.reservations for select to authenticated
      using (user_id = auth.uid() or public.has_company_role('adu', public.user_company_id(user_id)));
    create policy reservations_insert_own on public.reservations for insert to authenticated with check (true);
    create policy reservations_update on public.reservations for update to authenticated
      using (true) with check (public.is_admin()
        or public.has_company_role('adu', public.user_company_id(user_id)) or user_id = auth.uid());
    grant usage on schema public, auth to authenticated;
    grant select on public.menus to authenticated;
    grant select, insert, update on public.reservations to authenticated;
    grant usage on sequence public.reservations_id_seq to authenticated;
  `)
  await db.exec(migrations[0])
  await db.exec(`
    create trigger reservations_guard before update on public.reservations
      for each row execute function public.guard_reservation_update();
  `)
  await db.exec(migrations[1])
}, 30000)

afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`
    truncate public.reservations, public.menus restart identity;
    insert into public.menus values
      ('${openMenu}', current_date + 21),
      ('${closedMenu}', current_date);
    insert into public.reservations (user_id, menu_id, status, attended) values
      ('${member}', '${closedMenu}', 'reserved', false);
  `)
})

async function asUser(role, fn, validated = true) {
  await db.exec(`
    set test.user_id = '${adu}'; set test.role = '${role}';
    set test.validated = '${validated}'; set role authenticated;
  `)
  try { return await fn() } finally {
    await db.exec('reset role; reset test.user_id; reset test.role; reset test.validated;')
  }
}
const change = (userId, menuId, reserved) =>
  db.query('select public.set_company_reservation($1, $2, $3)', [userId, menuId, reserved])

describe('migration ADU J-2', () => {
  it.each([
    ['2026-10-05', '2026-10-03T12:00:00.000Z'],
    ['2026-10-11', '2026-10-09T12:00:00.000Z'],
    ['2026-11-02', '2026-10-31T13:00:00.000Z'],
    ['2026-03-30', '2026-03-28T13:00:00.000Z'],
    ['2026-10-26', '2026-10-24T12:00:00.000Z'],
  ])('calcule la même échéance J-2 que le frontend pour %s', async (date, expected) => {
    const { rows } = await db.query('select public.adu_reservation_deadline($1::date) as deadline', [date])
    expect(rows[0].deadline.toISOString()).toBe(expected)
    expect(aduReservationDeadline(date).toISOString()).toBe(expected)
  })

  it('autorise ajout, annulation, réactivation et modification de ses propres repas', async () => {
    await asUser('adu', async () => {
      await change(member, openMenu, true)
      await change(member, openMenu, false)
      await change(member, openMenu, true)
      await change(adu, openMenu, true)
    })

    const { rows } = await db.query('select user_id, status from public.reservations where menu_id=$1', [openMenu])
    expect(rows).toEqual(expect.arrayContaining([
      { user_id: member, status: 'reserved' }, { user_id: adu, status: 'reserved' },
    ]))
  })

  it('ferme exactement à 14 h à J-2', async () => {
    const { rows } = await db.query(`
      select
        '2026-10-03 11:59:59.999+00'::timestamptz < public.adu_reservation_deadline('2026-10-05') as before,
        '2026-10-03 12:00:00+00'::timestamptz < public.adu_reservation_deadline('2026-10-05') as at,
        '2026-10-03 12:00:00.001+00'::timestamptz < public.adu_reservation_deadline('2026-10-05') as after;
    `)
    expect(rows[0]).toEqual({ before: true, at: false, after: false })
  })

  it('refuse les personnels hors CIE, les clients, les CDU et les ADU non validés', async () => {
    await asUser('adu', () => expect(change(outsider, openMenu, true)).rejects.toThrow(/Accès réservé/))
    for (const role of ['user', 'cdu']) {
      await asUser(role, () => expect(change(member, openMenu, true)).rejects.toThrow(/Accès réservé/))
    }
    await asUser('adu', () => expect(change(member, openMenu, true)).rejects.toThrow(/Accès réservé/), false)
  })

  it('refuse ajout et annulation après J-2 par RPC, upsert et mise à jour directe', async () => {
    await asUser('adu', async () => {
      await expect(change(member, closedMenu, false)).rejects.toThrow(/J-2 à 14 h/)
      await expect(change(adu, closedMenu, true)).rejects.toThrow(/J-2 à 14 h/)
      await expect(db.query(`
        update public.reservations set status='cancelled' where user_id=$1 and menu_id=$2;
      `, [member, closedMenu])).rejects.toThrow(/Réservations clôturées/)
      await expect(db.query(`
        insert into public.reservations(user_id,menu_id,status) values ($1,$2,'cancelled')
        on conflict(user_id,menu_id) do update set status=excluded.status;
      `, [member, closedMenu])).rejects.toThrow(/Réservations clôturées/)
    })
  })

  it('conserve le pointage de présence après J-2', async () => {
    await asUser('adu', () => db.query(`
      update public.reservations set attended=true where user_id=$1 and menu_id=$2;
    `, [member, closedMenu]))
    const { rows } = await db.query('select status, attended from public.reservations where user_id=$1', [member])
    expect(rows[0]).toEqual({ status: 'reserved', attended: true })
  })

  it('refuse un menu inexistant ou un choix absent', async () => {
    await asUser('adu', async () => {
      await expect(change(member, outsider, true)).rejects.toThrow(/Menu introuvable/)
      await expect(change(member, openMenu, null)).rejects.toThrow(/Choix de réservation requis/)
    })
  })

  it('autorise encore la fenêtre ADU après la clôture client et garde le client bloqué', async () => {
    await db.exec(`
      update public.menus set menu_date =
        (statement_timestamp() at time zone 'Europe/Paris')::date + 3
      where id='${openMenu}';
    `)
    // For any weekday there is a meal still open to ADU whose weekly deadline has passed.
    const { rows } = await db.query(`
      select statement_timestamp() >= public.reservation_deadline(menu_date) as client_closed,
        statement_timestamp() < public.adu_reservation_deadline(menu_date) as adu_open
      from public.menus where id=$1;
    `, [openMenu])
    expect(rows[0]).toEqual({ client_closed: true, adu_open: true })
    await asUser('adu', () => change(member, openMenu, true))
    await asUser('user', () => expect(db.query(`
      insert into public.reservations(user_id,menu_id,status) values(auth.uid(),$1,'reserved');
    `, [openMenu])).rejects.toThrow(/Réservations clôturées/))
  })
})
