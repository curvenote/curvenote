import type { App } from 'firebase-admin/app';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getConfig } from '../../../app-config.server.js';

let app: App | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

async function getServerApp() {
  if (app) return app;

  const config = await getConfig();
  const credential = cert(JSON.parse(config.auth?.firebase?.secretKeyfile ?? 'invalid'));

  if (getApps().length === 0) {
    app = credential ? initializeApp({ credential }) : initializeApp();
  } else {
    app = getApp();
  }

  return app;
}

async function getServerAuth() {
  if (auth) return auth;
  const serverApp = await getServerApp();
  auth = getAuth(serverApp);
  return auth;
}

async function getServerFirestore() {
  if (firestore) return firestore;
  const serverApp = await getServerApp();
  firestore = getFirestore(serverApp);
  return firestore;
}

export { getServerAuth, getServerFirestore, FieldValue };
