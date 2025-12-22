import type { ClientDeploymentBranding } from '../providers/DeploymentProvider.js';

type Matches = { id: string } | undefined | null;

/**
 * Extracts the site title from Remix matches, falling back to 'Curvenote'.
 * Made more defensive to handle race conditions during navigation.
 */
export function getBrandingFromMetaMatches<T extends Matches>(
  matches: T[],
): ClientDeploymentBranding & Required<Pick<ClientDeploymentBranding, 'title' | 'description'>> {
  // Defensive check for matches array
  if (!matches || !Array.isArray(matches)) {
    return {
      title: 'Curvenote',
      description: 'Curvenote is a platform for creating and managing your research.',
    };
  }

  const root = matches
    .filter((f) => f !== undefined && f !== null)
    .find(({ id }) => id === 'root') as {
    loaderData?: { clientSideConfig?: { branding?: ClientDeploymentBranding } };
  };

  // More defensive data access to prevent race conditions
  const branding = root?.loaderData?.clientSideConfig?.branding;

  return {
    title: 'Curvenote',
    description: 'Curvenote is a platform for creating and managing your research.',
    ...branding,
  };
}

/**
 * Joins page and site titles with ' · ', omitting the separator if any part is missing.
 */
export function joinPageTitle(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Creates a stable meta array with explicit keys to prevent DOM reconciliation issues.
 * This helps avoid "insertBefore" errors during navigation.
 */
export function createStableMeta(title: string, description?: string) {
  const meta: Array<
    { key: string; title: string } | { key: string; name: string; content: string }
  > = [{ key: 'title', title }];

  if (description) {
    meta.push({ key: 'description', name: 'description', content: description });
  }

  return meta;
}
