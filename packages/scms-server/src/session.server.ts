import { getConfig } from './app-config.server.js';
import { createCookieSessionStorage } from 'react-router'; // or cloudflare/deno

export type AuthenticatedUser = {
  userId: string;
  primaryProvider: string;
  provider: string;
  pending: boolean;
  ready_for_approval: boolean;
};

export type AuthenticatedUserWithProviderCookie = AuthenticatedUser & {
  providerSetCookie: string;
};

export type SessionData = {
  user: AuthenticatedUser;
  returnTo?: string;
};

type SessionFlashData = {
  error: string;
};

export const MAX_AGE = 60 * 60 * 24 * 7 * 4;

let sessionStorage: SessionStorage | null = null;

export async function sessionStorageFactory() {
  if (sessionStorage != null) return sessionStorage;
  const config = await getConfig();

  sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: '__session',
      secrets: [config.api.authCookieSecret],
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
      maxAge: MAX_AGE,
    },
  });

  return sessionStorage;
}

export type SessionStorage = ReturnType<
  typeof createCookieSessionStorage<SessionData, SessionFlashData>
>;

export type Session = Awaited<ReturnType<SessionStorage['getSession']>>;
