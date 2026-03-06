import { getConfig } from './app-config.server.js';
import { createCookieSessionStorage } from 'react-router'; // or cloudflare/deno
import {
  getInvalidateOAuth2Cookies,
  getInvalidateProviderCookie,
  MAX_AGE,
} from './cookies.server.js';

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

/**
 * Creates logout headers by destroying the session and invalidating provider cookies.
 * This centralizes the logout logic used in logout routes and error scenarios.
 * When request is provided, also clears remix-auth-oauth2 cookies (oauth2:<uid>) used during OAuth flows.
 *
 * @param storage - The session storage instance
 * @param session - The current session
 * @param request - Optional request; when provided, oauth2:* cookies are cleared
 * @returns Headers with Set-Cookie directives for session destruction and provider/oauth2 invalidation
 */
export async function createLogoutHeaders(
  storage: SessionStorage,
  session: Session,
  request?: Request,
): Promise<Headers> {
  const headers = new Headers();
  headers.append('Set-Cookie', await storage.destroySession(session));
  const user = session.get('user');
  if (user?.provider) {
    headers.append('Set-Cookie', getInvalidateProviderCookie(user.provider));
  }
  if (request) {
    for (const setCookie of getInvalidateOAuth2Cookies(request.headers.get('Cookie'))) {
      headers.append('Set-Cookie', setCookie);
    }
  }
  return headers;
}
