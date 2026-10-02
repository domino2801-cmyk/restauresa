// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let db
const existing = '00000000-0000-0000-0000-000000000001'
const newUser = '00000000-0000-0000-0000-000000000002'
const readMigration = (name) =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid;
    $$;
    grant usage on schema public, auth to authenticated;
  `)
  await db.exec(readMigration('20261001000000_init.sql'))
  await db.exec(`
    grant select, update on public.profiles to authenticated;
    insert into auth.users(id,email,email_confirmed_at) values
      ('${existing}','confirmed@example.test',now()),
      ('00000000-0000-0000-0000-000000000003','unconfirmed@example.test',null);
    update public.profiles set role='adu' where id='${existing}';
  `)
  await db.exec(readMigration('20261002020000_auto_validate_confirmed_accounts.sql'))
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`reset role; reset test.uid; delete from auth.users where id='${newUser}';`)
})

async function profile(id) {
  const { rows } = await db.query('select role,is_validated from public.profiles where id=$1', [id])
  return rows[0]
}

describe('activation automatique', () => {
  it('active uniquement les comptes existants confirmés, sans changer leur rôle', async () => {
    expect(await profile(existing)).toEqual({ role: 'adu', is_validated: true })
    expect(await profile('00000000-0000-0000-0000-000000000003'))
      .toEqual({ role: 'user', is_validated: false })
  })

  it('attend la confirmation et ignore les rôles ou validations dans les métadonnées', async () => {
    await db.query(`
      insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.test',
        '{"role":"admin","is_validated":true,"full_name":"Test"}');
    `, [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: false })
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: true })
  })

  it('active un compte créé avec un email déjà confirmé', async () => {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
      [newUser, 'already-confirmed@example.test'])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: true })
  })

  it('autorise l’activation par le trigger même en présence de l’identité du client', async () => {
    await db.query('insert into auth.users(id,email) values($1,$2)', [newUser, 'otp@example.test'])
    await db.query("select set_config('test.uid',$1,false)", [newUser])
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: true })
  })

  it('empêche le client de s’activer ou de devenir administrateur directement', async () => {
    await db.query('insert into auth.users(id,email) values($1,$2)', [newUser, 'unconfirmed-new@example.test'])
    await db.query("select set_config('test.uid',$1,false)", [newUser])
    await db.exec('set role authenticated')
    await db.query("update public.profiles set is_validated=true,role='admin' where id=$1", [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: false })
  })

  it('ne réactive pas un compte désactivé lors d’une modification de profil ou d’email déjà confirmé', async () => {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
      [newUser, 'disabled@example.test'])
    await db.query('update public.profiles set is_validated=false where id=$1', [newUser])
    await db.query("select set_config('test.uid',$1,false)", [newUser])
    await db.exec('set role authenticated')
    await db.query("update public.profiles set full_name='Nouveau nom',is_validated=true where id=$1", [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: false })
    await db.exec('reset role')
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [newUser])
    expect(await profile(newUser)).toEqual({ role: 'user', is_validated: false })
  })
})
