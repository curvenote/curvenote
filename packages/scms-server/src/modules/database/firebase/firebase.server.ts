import type { App } from 'firebase-admin/app';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import { getConfig } from '../../../app-config.server.js';

let app: App | null = null;
let auth: Auth | null = null;

async function getServerAuth() {
  if (auth) return auth;

  const config = await getConfig();
  const credential = cert(JSON.parse(config.auth?.firebase?.secretKeyfile ?? 'invalid'));

  if (getApps().length === 0) {
    app = credential ? initializeApp({ credential }) : initializeApp();
    auth = getAuth(app);
  } else {
    app = getApp();
    auth = getAuth(app);
  }

  return auth;
}

export { getServerAuth };
