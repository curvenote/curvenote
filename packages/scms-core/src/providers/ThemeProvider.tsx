import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useFetcher } from 'react-router';

export enum Theme {
  DARK = 'dark',
  LIGHT = 'light',
}
const themes: Array<Theme> = Object.values(Theme);

type ThemeContextType = [Theme | null, Dispatch<SetStateAction<Theme | null>>];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const prefersLightMQ = '(prefers-color-scheme: light)';

export const getPreferredTheme = () =>
  window.matchMedia(prefersLightMQ).matches ? Theme.LIGHT : Theme.DARK;

export function ThemeProvider({
  children,
  specifiedTheme,
}: {
  children: ReactNode;
  specifiedTheme: Theme | null;
}) {
  const [theme, setTheme] = useState<Theme | null>(() => {
    // On the server, if we don't have a specified theme then we should
    // return null and the clientThemeCode will set the theme for us
    // before hydration. Then (during hydration), this code will get the same
    // value that clientThemeCode got so hydration is happy.
    if (specifiedTheme) {
      if (themes.includes(specifiedTheme)) {
        return specifiedTheme;
      } else {
        return null;
      }
    }

    // there's no way for us to know what the theme should be in this context
    // the client will have to figure it out before hydration.
    if (typeof window !== 'object') {
      return null;
    }

    return getPreferredTheme();
  });

  const persistTheme = useFetcher();

  const mountRun = useRef(false);

  useEffect(() => {
    if (!mountRun.current) {
      mountRun.current = true;
      return;
    }
    if (!theme) {
      return;
    }
    persistTheme.submit({ theme }, { action: 'resources/set-theme', method: 'POST' });
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(prefersLightMQ);
    const handleChange = () => {
      setTheme(mediaQuery.matches ? Theme.LIGHT : Theme.DARK);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return <ThemeContext.Provider value={[theme, setTheme]}>{children}</ThemeContext.Provider>;
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && themes.includes(value as Theme);
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
