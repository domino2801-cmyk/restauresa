// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let db
let fromDate
let toDate
const user = '00000000-0000-0000-0000-000000000001'
const member = '00000000-0000-0000-0000-000000000002'
const outsider = '00000000-0000-0000-0000-000000000003'
const company = '00000000-0000-0000-0000-000000000004'
const migrations = [
  '20261001000000_init.sql',
  '20261002000000_reservation_deadline.sql',
  '20261002010000_adu_reservation_deadline.sql',
  '20261002020000_auto_validate_confirmed_accounts.sql',
  '20261002030000_reservations_without_published_meals.sql',
  '20261002040000_qr_attendance.sql',
]

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
  for (const name of migrations) {
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
  await db.exec(`
    grant select on public.menus,public.profiles,public.meals to authenticated;
    grant select,insert,update on public.reservations to authenticated;
    insert into auth.users(id,email,email_confirmed_at) values('${user}','test@example.test',now());
    insert into auth.users(id,email,email_confirmed_at) values
      ('${member}','member@example.test',now()),('${outsider}','outsider@example.test',now());
    insert into public.regiments(id,name) values('${company}','Regiment test');
    insert into public.companies(id,regiment_id,name) values('${company}','${company}','Compagnie test');
    update public.profiles set regiment_id='${company}',company_id='${company}'
      where id in ('${user}','${member}');
  `)
  const { rows } = await db.query(`
    select to_char(current_date+21,'YYYY-MM-DD') as start,
      to_char(current_date+27,'YYYY-MM-DD') as finish;
  `)
  fromDate = rows[0].start
  toDate = rows[0].finish
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`
    reset role; reset test.uid;
    truncate public.reservations, public.headcount_validations, public.menus, public.meals cascade;
    update public.profiles set is_validated=true,role='user' where id='${user}';
  `)
})

async function asClient(action) {
  await db.query("select set_config('test.uid',$1,false)", [user])
  await db.exec('set role authenticated')
  try { return await action() } finally { await db.exec('reset role; reset test.uid;') }
}
const ensure = (start = fromDate, end = toDate) =>
  db.query('select public.ensure_meal_services($1::date,$2::date)', [start, end])

describe('réservation sans plat publié', () => {
  it('crée 21 services sans plat pour une semaine et reste idempotent', async () => {
    await asClient(async () => { await ensure(); await ensure() })
    const { rows } = await db.query('select count(*)::int as total,count(meal_id)::int as dishes from public.menus')
    expect(rows[0]).toEqual({ total: 21, dishes: 0 })
  })

  describe('passage par QR établissement', () => {
    async function seedToday(status = 'reserved') {
      const { rows } = await db.query(`
        insert into public.menus(menu_date,service)
        values((statement_timestamp() at time zone 'Europe/Paris')::date,'dejeuner') returning id
      `)
      await db.query('insert into public.reservations(user_id,menu_id,status) values($1,$2,$3)', [user, rows[0].id, status])
      const { rows: qr } = await db.query("select 'restauresa:attendance:' || token::text as content from public.establishment_qr")
      return qr[0].content
    }
    const checkin = (content, service = 'dejeuner') =>
      db.query('select public.check_in_meal($1,$2::public.meal_service)', [content, service])

    it('pointe une réservation du jour après clôture et refuse le double passage', async () => {
      const content = await seedToday()
      await asClient(async () => {
        await checkin(content)
        await expect(checkin(content)).rejects.toThrow(/déjà validé/)
      })
      const { rows } = await db.query('select status,attended from public.reservations')
      expect(rows).toEqual([{ status: 'reserved', attended: true }])
      const { rows: counts } = await db.query('select count(*)::int as total from public.reservation_checkins')
      expect(counts[0].total).toBe(1)
    })

    it('refuse un code incorrect, un autre service et un repas annulé', async () => {
      const content = await seedToday('cancelled')
      await asClient(async () => {
        await expect(checkin('wrong')).rejects.toThrow(/invalide/)
        await expect(checkin(content, 'diner')).rejects.toThrow(/Aucune réservation/)
        await expect(checkin(content)).rejects.toThrow(/Aucune réservation/)
      })
    })

    it('ne pointe pas une réservation future ou celle d’un autre compte', async () => {
      const content = await seedToday()
      await db.query('update public.reservations set user_id=$1', [member])
      await asClient(() => expect(checkin(content)).rejects.toThrow(/Aucune réservation/))
      await db.query('update public.reservations set user_id=$1', [user])
      await db.exec('update public.menus set menu_date=menu_date+1')
      await asClient(() => expect(checkin(content)).rejects.toThrow(/Aucune réservation/))
    })

    it('refuse le compte désactivé et protège le token et les pointages', async () => {
      const content = await seedToday()
      await db.query('update public.profiles set is_validated=false where id=$1', [user])
      await asClient(() => expect(checkin(content)).rejects.toThrow(/compte activé/))
      await db.query('update public.profiles set is_validated=true where id=$1', [user])
      await asClient(async () => {
        await expect(db.query('select public.get_establishment_qr()')).rejects.toThrow(/administrateurs/)
        await expect(db.query('select * from public.establishment_qr')).rejects.toThrow(/permission denied/)
        await expect(db.query('insert into public.reservation_checkins select id,now() from public.reservations')).rejects.toThrow(/permission denied/)
        await db.exec('update public.reservations set attended=true')
      })
      const { rows } = await db.query('select attended from public.reservations')
      expect(rows[0].attended).toBe(null)
      await db.query("update public.profiles set role='admin' where id=$1", [user])
      const { rows: qr } = await asClient(() => db.query('select public.get_establishment_qr() as content'))
      expect(qr[0].content).toBe(content)
    })

    it('conserve le pointage manuel ADU après la migration', async () => {
      await seedToday()
      await db.query("update public.profiles set role='adu' where id=$1", [user])
      await asClient(() => db.exec('update public.reservations set attended=true'))
      const { rows } = await db.query('select attended from public.reservations')
      expect(rows[0].attended).toBe(true)
    })
  })

  it('enregistre et annule une réservation sans plat tout en conservant la clôture client', async () => {
    await asClient(async () => {
      await ensure()
      await db.query(`
        insert into public.reservations(user_id,menu_id,status)
        select auth.uid(),id,'reserved' from public.menus where menu_date=$1 and service='dejeuner';
      `, [fromDate])
      await db.exec("update public.reservations set status='cancelled' where user_id=auth.uid()")
      const { rows } = await db.query('select status from public.reservations where user_id=auth.uid()')
      expect(rows[0].status).toBe('cancelled')
      await ensure('2020-01-06', '2020-01-06')
      await expect(db.exec(`
        insert into public.reservations(user_id,menu_id,status)
        select auth.uid(),id,'reserved' from public.menus where menu_date='2020-01-06' and service='dejeuner';
      `)).rejects.toThrow(/Réservations clôturées/)
    })
  })

  it('publier puis retirer un plat conserve le service, sa réservation et ses effectifs', async () => {
    await asClient(async () => {
      await ensure()
      await db.query(`
        insert into public.reservations(user_id,menu_id,status)
        select auth.uid(),id,'reserved' from public.menus where menu_date=$1 and service='dejeuner';
      `, [fromDate])
    })
    const { rows: before } = await db.query('select id,menu_id,status from public.reservations')
    await db.query(`
      insert into public.headcount_validations(company_id,menu_id,reserved_count,total_members)
      values($1,$2,1,2)
    `, [company, before[0].menu_id])
    const { rows: countsBefore } = await db.query('select * from public.headcount_validations')
    const { rows: meals } = await db.query("insert into public.meals(name) values('Plat publié') returning id")
    await db.query(`
      insert into public.menus(menu_date,service,meal_id) values($1,'dejeuner',$2)
      on conflict(menu_date,service) do update set meal_id=excluded.meal_id
    `, [fromDate, meals[0].id])
    await asClient(() => ensure())
    const { rows: published } = await db.query('select meal_id from public.menus where id=$1', [before[0].menu_id])
    expect(published[0].meal_id).toBe(meals[0].id)
    await db.query(`
      insert into public.menus(menu_date,service,meal_id) values($1,'dejeuner',null)
      on conflict(menu_date,service) do update set meal_id=excluded.meal_id
    `, [fromDate])
    const { rows: after } = await db.query('select id,menu_id,status from public.reservations')
    expect(after).toEqual(before)
    const { rows: countsAfter } = await db.query('select * from public.headcount_validations')
    expect(countsAfter).toEqual(countsBefore)
  })

  it('permet à l’ADU de modifier sans plat les membres de sa CIE avant J-2, sans contourner les contrôles', async () => {
    await db.query("update public.profiles set role='adu' where id=$1", [user])
    await asClient(async () => {
      await ensure()
      const { rows } = await db.query("select id from public.menus where menu_date=$1 and service='dejeuner'", [fromDate])
      const id = rows[0].id
      await db.query('select public.set_company_reservation($1,$2,true)', [member, id])
      await db.query('select public.set_company_reservation($1,$2,false)', [member, id])
      await expect(db.query('select public.set_company_reservation($1,$2,true)', [outsider, id]))
        .rejects.toThrow(/Accès réservé/)
      await ensure('2020-01-06', '2020-01-06')
      const { rows: closed } = await db.query("select id from public.menus where menu_date='2020-01-06' and service='dejeuner'")
      await expect(db.query('select public.set_company_reservation($1,$2,true)', [member, closed[0].id]))
        .rejects.toThrow(/J-2 à 14 h/)
    })
    const { rows } = await db.query('select user_id,status from public.reservations')
    expect(rows).toEqual([{ user_id: member, status: 'cancelled' }])
  })

  it('refuse un compte non activé et les périodes invalides ou excessives', async () => {
    await db.query('update public.profiles set is_validated=false where id=$1', [user])
    await asClient(() => expect(ensure()).rejects.toThrow(/compte activé/))
    await db.query('update public.profiles set is_validated=true where id=$1', [user])
    await asClient(async () => {
      await expect(ensure('2026-10-12', '2026-11-12')).rejects.toThrow(/31 jours/)
      await expect(ensure(toDate, fromDate)).rejects.toThrow(/31 jours/)
      await expect(ensure(null, toDate)).rejects.toThrow(/31 jours/)
    })
    const { rows } = await db.query("select has_function_privilege('anon','public.ensure_meal_services(date,date)','EXECUTE') as allowed")
    expect(rows[0].allowed).toBe(false)
  })
})
