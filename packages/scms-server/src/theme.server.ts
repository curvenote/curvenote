import { createCookieSessionStorage } from 'react-router';
import type { Theme } from '@curvenote/scms-core';
import { isTheme } from '@curvenote/scms-core';
import { getConfig } from './app-config.server.js';

type SessionData = {
  theme: Theme;
};

type SessionFlashData = {
  error: string;
};

let themeStorage: ReturnType<
  typeof createCookieSessionStorage<SessionData, SessionFlashData>
> | null = null;

async function getThemeSession(request: Request) {
  if (themeStorage == null) {
    const config = await getConfig();
    themeStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
      cookie: {
        name: 'theme',
        secure: true,
        secrets: [config.api.sessionSecret],
        sameSite: 'lax',
        path: '/',
        httpOnly: true,
      },
    });
  }

  const session = await themeStorage.getSession(request.headers.get('Cookie'));
  const storage = themeStorage;
  return {
    getTheme: () => {
      const themeValue = session.get('theme');
      return isTheme(themeValue) ? themeValue : null;
    },
    setTheme: (theme: Theme) => session.set('theme', theme),
    commit: () => storage.commitSession(session),
  };
}

export { getThemeSession };
