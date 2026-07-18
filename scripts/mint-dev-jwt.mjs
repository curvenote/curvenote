#!/usr/bin/env node
// Mint local-dev JWTs for the PostgREST Data API (docker-compose `postgrest`
// service). NOT for production — there, use the Supabase anon key.
//
//   node scripts/mint-dev-jwt.mjs [role] [secret]
//
// Defaults: role=anon, secret=the docker-compose dev secret. Note that against
// the local postgrest service no key is needed at all — requests without an
// Authorization header already run as anon.
import crypto from 'node:crypto';

const role = process.argv[2] || 'anon';
const secret =
  process.argv[3] ||
  process.env.PGRST_JWT_SECRET ||
  'super-secret-jwt-token-with-at-least-32-characters';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function mint(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);
const token = mint({
  role,
  iss: 'scms-local-dev',
  iat: now,
  exp: now + 10 * 365 * 24 * 60 * 60, // 10 years: local dev only
});

console.log(`# role=${role}`);
console.log(`# env-var form (e.g. for Data API consumers):`);
console.log(`SCMS_DATA_API_URL=http://localhost:3010`);
console.log(`SCMS_DATA_API_KEY=${token}`);
