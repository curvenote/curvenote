import type { UserSitesDTO } from '@curvenote/common';
import { useMatches } from 'react-router';

/**
 * Access sites & scopes data from the app route
 */
export function useSites() {
  const matches = useMatches();
  const appRoute = matches.find(({ pathname }) => pathname === '/app');

  const data = appRoute?.data as {
    scopes: string[];
    sites: UserSitesDTO;
  };

  return { scopes: data?.scopes, sites: data?.sites };
}
