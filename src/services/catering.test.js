// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchCateringOverview } from './catering'

let db
let historicalTime
const ids = Array.from({ length: 8 }, (_, index) => `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`)
const [catering, member, other, company1, company2, menu, admin, adu] = ids
const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid',true),'')::uuid;
    $$;
    grant usage on schema public,auth to authenticated;
  `)
  for (const name of [
    '20261001000000_init.sql',
    '20261002000000_reservation_deadline.sql',
    '20261002010000_adu_reservation_deadline.sql',
    '20261002020000_auto_validate_confirmed_accounts.sql',
    '20261002030000_reservations_without_published_meals.sql',
    '20261002040000_qr_attendance.sql',
    '20261002050000_rotate_establishment_qr.sql',
    '20261003000000_catering_role.sql',
  ]) await db.exec(migration(name))
  await db.exec(`
    grant select on public.profiles, public.menus, public.reservations to authenticated;
    grant update on public.reservations, public.profiles to authenticated;
    insert into auth.users(id,email,email_confirmed_at) values
      ('${catering}','catering@test.fr',now()),('${member}','member@test.fr',now()),
      ('${other}','other@test.fr',now()),('${admin}','admin@test.fr',now()),('${adu}','adu@test.fr',now());
    insert into public.regiments(id,name) values('${company1}','Test');
    insert into public.companies(id,regiment_id,name) values
      ('${company1}','${company1}','Company 1'),('${company2}','${company1}','Company 2');
    update public.profiles set regiment_id='${company1}',company_id='${company1}' where id in ('${member}','${adu}');
    update public.profiles set regiment_id='${company1}',company_id='${company2}' where id='${other}';
    update public.profiles set role='restauration' where id='${catering}';
    update public.profiles set role='admin' where id='${admin}';
    update public.profiles set role='adu' where id='${adu}';
    insert into public.menus(id,menu_date,service) values('${menu}','2026-10-01','dejeuner');
    insert into public.reservations(user_id,menu_id) values('${member}','${menu}');
    insert into public.reservation_checkins(reservation_id,checked_at)
      select id,'2026-10-01T10:29:59Z' from public.reservations;
  `)
  await db.exec(migration('20261003010000_catering_overview.sql'))
  await db.exec(migration('20261003020000_catering_quarter_hours.sql'))
  historicalTime = (await db.query('select attended_at from public.reservations')).rows[0].attended_at
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  rpc.mockReset()
  await db.exec(`
    reset role; reset test.uid;
    truncate public.reservations,public.menus cascade;
    update public.profiles set role='restauration',is_validated=true where id='${catering}';
    insert into public.menus(id,menu_date,service) values('${menu}','2026-10-01','dejeuner');
  `)
})
async function client(userId, action) {
  await db.query("select set_config('test.uid',$1,false)", [userId])
  await db.exec('set role authenticated')
  try { return await action() } finally { await db.exec('reset role; reset test.uid') }
}
async function overview(start = '2026-10-01', end = start) {
  const { rows } = await db.query('select public.get_catering_overview($1::date,$2::date) as result', [start, end])
  return rows[0].result
}
async function seed(userId, attended, time = null, status = 'reserved') {
  const { rows } = await db.query(
    'insert into public.reservations(user_id,menu_id,status,attended) values($1,$2,$3,$4) returning id',
    [userId, menu, status, attended],
  )
  // Seed historical timestamps as a privileged database migration would, not through the client.
  await db.exec('alter table public.reservations disable trigger reservations_passage_time')
  try { await db.query('update public.reservations set attended_at=$1 where id=$2', [time, rows[0].id]) }
  finally { await db.exec('alter table public.reservations enable trigger reservations_passage_time') }
  return rows[0].id
}

it('appelle uniquement la RPC agrégée et remonte les erreurs', async () => {
  rpc.mockResolvedValueOnce({ data: { services: [], half_hours: [], quarter_hours: [] }, error: null })
  expect(await fetchCateringOverview('2026-10-01', '2026-10-07')).toEqual({ services: [], half_hours: [], quarter_hours: [] })
  expect(rpc).toHaveBeenCalledWith('get_catering_overview', { from_date: '2026-10-01', to_date: '2026-10-07' })
  rpc.mockResolvedValueOnce({ error: new Error('Access denied') })
  await expect(fetchCateringOverview('2026-10-01', '2026-10-07')).rejects.toThrow('Access denied')
})

it('signale une migration manquante au lieu de présenter des zéros trompeurs', async () => {
  rpc.mockResolvedValueOnce({ data: { services: [], half_hours: [] }, error: null })
  await expect(fetchCateringOverview('2026-10-01', '2026-10-07')).rejects.toThrow('Appliquez la migration')
})

it('reprend les heures réelles des scans QR historiques', () => {
  expect(new Date(historicalTime).toISOString()).toBe('2026-10-01T10:29:59.000Z')
})

it('agrège toutes les compagnies sans exposer les personnes et sépare 12:29 et 12:30 à Paris', async () => {
  await seed(member, true, '2026-10-01T10:29:59Z')
  await seed(other, true, '2026-10-01T10:30:00Z')
  const result = await client(catering, () => overview())
  expect(result.services).toEqual([{
    day: '2026-10-01', service: 'dejeuner', reserved: 2, passed: 2, absent: 0,
    unchecked: 0, unknown_time: 0, other_day: 0,
  }])
  expect(result.half_hours).toEqual([
    { day: '2026-10-01', service: 'dejeuner', slot: '12:00', passed: 1 },
    { day: '2026-10-01', service: 'dejeuner', slot: '12:30', passed: 1 },
  ])
  expect(result.quarter_hours).toEqual([
    { day: '2026-10-01', service: 'dejeuner', slot: '12:15', passed: 1 },
    { day: '2026-10-01', service: 'dejeuner', slot: '12:30', passed: 1 },
  ])
  const raw = JSON.stringify(result)
  expect(raw).not.toContain(member)
  expect(raw).not.toContain('email')
  const { rows } = await client(catering, () => db.query('select * from public.reservations'))
  expect(rows).toEqual([])
  const profiles = await client(catering, () => db.query('select id from public.profiles'))
  expect(profiles.rows).toEqual([{ id: catering }])
})

it('sépare les horaires inconnus et tardifs, exclut les annulations et conserve les zéros', async () => {
  await seed(member, true)
  await seed(other, true, '2026-10-02T10:00:00Z')
  await seed(admin, false, null, 'cancelled')
  const result = await client(catering, () => overview())
  expect(result.services[0]).toMatchObject({ reserved: 2, passed: 2, unknown_time: 1, other_day: 1 })
  expect(result.half_hours).toEqual([])
  expect(result.quarter_hours).toEqual([])
  const next = await client(admin, () => overview('2026-10-02'))
  expect(next).toEqual({ services: [], half_hours: [], quarter_hours: [] })
})

it.each([
  ['petit_dejeuner', '06:44:59', '06:45:00', '06:30', '06:45'],
  ['dejeuner', '11:44:59', '11:45:00', '11:30', '11:45'],
  ['diner', '17:59:59', '18:00:00', '17:45', '18:00'],
])('sépare les quarts d’heure à Paris pour %s en été et en hiver', async (service, before, after, first, second) => {
  await db.query('update public.menus set service=$1 where id=$2', [service, menu])
  const firstId = await seed(member, true, `2026-10-01T${before}+02:00`)
  const secondId = await seed(other, true, `2026-10-01T${after}+02:00`)
  const expected = (day) => [
    { day, service, slot: first, passed: 1 },
    { day, service, slot: second, passed: 1 },
  ]
  expect((await client(catering, () => overview())).quarter_hours).toEqual(expected('2026-10-01'))
  await db.exec('alter table public.reservations disable trigger reservations_passage_time')
  try {
    await db.query("update public.menus set menu_date='2026-12-01' where id=$1", [menu])
    await db.query('update public.reservations set attended_at=$1 where id=$2', [`2026-12-01T${before}+01:00`, firstId])
    await db.query('update public.reservations set attended_at=$1 where id=$2', [`2026-12-01T${after}+01:00`, secondId])
  } finally {
    await db.exec('alter table public.reservations enable trigger reservations_passage_time')
  }
  expect((await client(catering, () => overview('2026-12-01'))).quarter_hours).toEqual(expected('2026-12-01'))
})

it.each(['user', 'adu', 'cdu'])('refuse les agrégats au rôle %s', async (role) => {
  await db.query('update public.profiles set role=$1 where id=$2', [role, catering])
  await expect(client(catering, () => overview())).rejects.toThrow('Accès réservé')
})

it('refuse les comptes non validés, anonymes et les périodes invalides', async () => {
  await db.query('update public.profiles set is_validated=false where id=$1', [catering])
  await expect(client(catering, () => overview())).rejects.toThrow('Accès réservé')
  await expect(client(null, () => overview())).rejects.toThrow('Accès réservé')
  await expect(client(admin, () => overview('2026-10-02', '2026-10-01'))).rejects.toThrow('La période')
  await expect(client(admin, () => overview('2026-10-01', '2026-12-01'))).rejects.toThrow('La période')
})

it('horodate le pointage ADU sans permettre de falsifier ou renouveler son heure', async () => {
  const id = await seed(member, null)
  await client(adu, () => db.query("update public.reservations set attended=true,attended_at='2000-01-01' where id=$1", [id]))
  const first = (await db.query('select attended_at from public.reservations where id=$1', [id])).rows[0].attended_at
  expect(new Date(first).getFullYear()).toBeGreaterThan(2000)
  await client(adu, () => db.query("update public.reservations set attended_at='2000-01-01' where id=$1", [id]))
  expect((await db.query('select attended_at from public.reservations where id=$1', [id])).rows[0].attended_at).toEqual(first)
  await client(adu, () => db.query('update public.reservations set attended=false where id=$1', [id]))
  expect((await db.query('select attended_at from public.reservations where id=$1', [id])).rows[0].attended_at).toBeNull()
})

it('horodate le scan QR et ne permet pas de modifier les réservations des autres compagnies', async () => {
  await db.query("update public.menus set menu_date=(statement_timestamp() at time zone 'Europe/Paris')::date where id=$1", [menu])
  const id = await seed(member, null)
  const token = (await db.query("select 'restauresa:attendance:' || token::text as qr from public.establishment_qr")).rows[0].qr
  await client(member, () => db.query("select public.check_in_meal($1,'dejeuner')", [token]))
  expect((await db.query('select attended,attended_at from public.reservations where id=$1', [id])).rows[0])
    .toMatchObject({ attended: true, attended_at: expect.any(Date) })
  const result = await client(catering, () => db.query('update public.reservations set attended=false where id=$1 returning id', [id]))
  expect(result.rows).toEqual([])
})
