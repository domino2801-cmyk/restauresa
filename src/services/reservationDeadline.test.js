// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { reservationDeadline } from '../lib/dates'

let db
const migration = readFileSync(
  new URL('../../supabase/migrations/20261002000000_reservation_deadline.sql', import.meta.url),
  'utf8',
)
const initialSchema = readFileSync(
  new URL('../../supabase/migrations/20261001000000_init.sql', import.meta.url),
  'utf8',
)
const originalGuard = initialSchema.match(
  /create or replace function public\.guard_reservation_update\(\)[\s\S]*?for each row execute function public\.guard_reservation_update\(\);/,
)[0]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid;
    $$;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.role', true), '') = 'admin';
    $$;
    create function public.auth_is_validated() returns boolean language sql stable as $$
      select true;
    $$;
    create function public.has_company_role(text, uuid) returns boolean language sql stable as $$
      select coalesce(current_setting('test.role', true), '') = $1;
    $$;
    create function public.user_company_id(uuid) returns uuid language sql stable as $$
      select '00000000-0000-0000-0000-000000000010'::uuid;
    $$;
    create table public.menus (id text primary key, menu_date date not null);
    create table public.reservations (
      id integer generated always as identity primary key,
      user_id uuid not null,
      menu_id text not null references public.menus(id),
      status text not null,
      attended boolean,
      unique (user_id, menu_id)
    );
    alter table public.reservations enable row level security;
    create policy reservations_select on public.reservations for select to authenticated using (true);
    grant usage on schema public, auth to authenticated;
    grant select on public.menus to authenticated;
    grant select, insert, update on public.reservations to authenticated;
    grant usage on sequence public.reservations_id_seq to authenticated;
  `)
  // Reuse the existing trigger so the migration is tested as an upgrade.
  await db.exec(originalGuard)
  for (const policy of ['reservations_insert_own', 'reservations_update']) {
    await db.exec(initialSchema.match(new RegExp(`create policy "${policy}"[\\s\\S]*?;`))[0])
  }
  await db.exec(migration)
}, 30000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec(`
    truncate public.reservations, public.menus restart identity;
    insert into public.menus values
      ('open', current_date + 21),
      ('open-refused', current_date + 21),
      ('closed', date_trunc('week', statement_timestamp() at time zone 'Europe/Paris')::date + 6);
    insert into public.reservations (user_id, menu_id, status) values
      ('00000000-0000-0000-0000-000000000001', 'open-refused', 'cancelled'),
      ('00000000-0000-0000-0000-000000000001', 'closed', 'reserved'),
      ('00000000-0000-0000-0000-000000000002', 'closed', 'reserved');
  `)
})

async function asClient(role, fn) {
  await db.exec(`
    set test.user_id = '00000000-0000-0000-0000-000000000001';
    set test.role = '${role}';
    set role authenticated;
  `)
  try {
    return await fn()
  } finally {
    await db.exec('reset role; reset test.user_id; reset test.role;')
  }
}

describe('reservation deadline migration', () => {
  it.each([
    ['2026-10-05', '2026-10-01T12:00:00.000Z'],
    ['2026-10-11', '2026-10-01T12:00:00.000Z'],
    ['2026-11-02', '2026-10-29T13:00:00.000Z'],
    ['2026-03-30', '2026-03-26T13:00:00.000Z'],
    ['2026-10-26', '2026-10-22T12:00:00.000Z'],
  ])('calcule la même échéance que le frontend pour %s', async (day, deadline) => {
    const { rows } = await db.query('select public.reservation_deadline($1::date) as deadline', [day])
    expect(rows[0].deadline.toISOString()).toBe(deadline)
    expect(rows[0].deadline.toISOString()).toBe(reservationDeadline(day).toISOString())
  })

  it('ouvre juste avant l’échéance et ferme dès 14 h', async () => {
    const { rows } = await db.query(`
      select
        '2026-10-01 11:59:59.999+00'::timestamptz < public.reservation_deadline('2026-10-05') as before,
        '2026-10-01 12:00:00+00'::timestamptz < public.reservation_deadline('2026-10-05') as at,
        '2026-10-01 12:00:00.001+00'::timestamptz < public.reservation_deadline('2026-10-05') as after;
    `)
    expect(rows[0]).toEqual({ before: true, at: false, after: false })
  })

  it('autorise un enregistrement groupé avant clôture', async () => {
    await asClient('user', () => db.exec(`
      insert into public.reservations (user_id, menu_id, status) values
        (auth.uid(), 'open', 'reserved'),
        (auth.uid(), 'open-refused', 'cancelled')
      on conflict (user_id, menu_id) do update set status = excluded.status;
    `))
    const { rows } = await db.query("select status from public.reservations where menu_id = 'open'")
    expect(rows[0].status).toBe('reserved')
  })

  it('bloque les insertions et upserts après clôture sans enregistrement partiel', async () => {
    await asClient('user', async () => {
      await expect(db.exec(`
        insert into public.reservations (user_id, menu_id, status) values (auth.uid(), 'closed', 'reserved');
      `)).rejects.toThrow(/Réservations clôturées/)
      await expect(db.exec(`
        insert into public.reservations (user_id, menu_id, status) values
          (auth.uid(), 'open-refused', 'reserved'),
          (auth.uid(), 'closed', 'cancelled')
        on conflict (user_id, menu_id) do update set status = excluded.status;
      `)).rejects.toThrow(/Réservations clôturées/)
    })
    const { rows } = await db.query("select status from public.reservations where menu_id = 'open-refused'")
    expect(rows[0].status).toBe('cancelled')
  })

  it('bloque une annulation directe et préserve le pointage ADU', async () => {
    await asClient('user', async () => {
      const { rows } = await db.query(`
        update public.reservations set status = 'cancelled' where menu_id = 'closed' returning id;
      `)
      expect(rows).toHaveLength(0)
    })
    await asClient('adu', async () => {
      await expect(db.exec(`
        update public.reservations set status = 'cancelled' where menu_id = 'closed';
      `)).rejects.toThrow(/Réservations clôturées/)
      await db.exec("update public.reservations set attended = true where menu_id = 'closed'")
    })
    const { rows } = await db.query(`
      select status, attended from public.reservations
      where menu_id = 'closed' and user_id = '00000000-0000-0000-0000-000000000001';
    `)
    expect(rows[0]).toEqual({ status: 'reserved', attended: true })
  })

  it('autorise le pointage ADU sans permettre de changer le statut d’un autre client', async () => {
    await asClient('adu', () => db.exec(`
      update public.reservations set status = 'cancelled', attended = true
      where menu_id = 'closed' and user_id <> auth.uid();
    `))
    const { rows } = await db.query(`
      select status, attended from public.reservations
      where menu_id = 'closed' and user_id = '00000000-0000-0000-0000-000000000002';
    `)
    expect(rows[0]).toEqual({ status: 'reserved', attended: true })
  })

  it('préserve les corrections administrateur', async () => {
    await asClient('admin', () => db.exec(`
      update public.reservations set status = 'cancelled' where menu_id = 'closed';
    `))
    const { rows } = await db.query("select status from public.reservations where menu_id = 'closed'")
    expect(rows[0].status).toBe('cancelled')
  })
})
