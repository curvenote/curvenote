import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';

let app: FirebaseApp;
export let auth: Auth;

export const initializeFirebase = (fbConfig: FirebaseOptions) => {
  if (!app) {
    app = initializeApp(fbConfig);
    auth = getAuth(app);

    // Let Remix handle the persistence via session cookies.
    setPersistence(auth, inMemoryPersistence);
  }
  return { app, auth };
};
