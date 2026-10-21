// ตัวช่วยทดสอบ SQL: Postgres จริง (PGlite) + ตัวแทน schema/role ของ Supabase เพื่อให้ RLS ทำงานจริง ใช้โดย rls.test.js
// Throwaway harness: real Postgres (PGlite) + minimal stand-ins for Supabase's auth schema/roles, so RLS can be tested for real.
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const fs = require('node:fs');

const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, is_anonymous boolean default false);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function makeDb(migrationFiles) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  for (const f of migrationFiles) await db.exec(fs.readFileSync(f, 'utf8'));
  return db;
}

// เพิ่มผู้ใช้ผ่าน auth.users (ทำให้ trigger สร้าง profile เหมือน Supabase signUp จริง)
async function signUp(db, { email, meta = {}, anonymous = false }) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data, is_anonymous) values ($1, $2::jsonb, $3) returning id`, [email, JSON.stringify(meta), anonymous]);
  return r.rows[0].id;
}

// รันคำสั่งในฐานะผู้ใช้ (บทบาท authenticated/anon ที่ถูกบังคับ RLS) แล้วคืนบทบาทเดิม
async function as(db, user, fn) {
  const role = user ? 'authenticated' : 'anon';
  const claims = user ? { sub: user.id, role: 'authenticated', is_anonymous: !!user.anonymous } : { role: 'anon' };
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false), set_config('request.jwt.claim.sub', '${user ? user.id : ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}

async function attempt(promiseFn) {
  try { return { ok: true, value: await promiseFn() }; } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { makeDb, signUp, as, attempt };

