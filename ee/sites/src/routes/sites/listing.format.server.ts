import type { SiteConfig } from '@curvenote/common';
import { createSiteRootUrl } from '@curvenote/scms-server';
import type { SiteCardItem } from './types.js';

export type SiteCardRow = {
  id: string;
  name: string;
  title: string | null;
  external: boolean | null;
  metadata: unknown;
  domains: { default: boolean; hostname: string }[];
};

function logosFromMetadata(metadata: unknown): Pick<SiteCardItem, 'logo' | 'logo_dark'> {
  const config = metadata as SiteConfig | null;
  return {
    logo: config?.logo ?? '',
    logo_dark: config?.logo_dark,
  };
}

export function formatSiteCardItem(row: SiteCardRow): SiteCardItem {
  const { logo, logo_dark } = logosFromMetadata(row.metadata);
  return {
    id: row.id,
    name: row.name,
    title: row.title ?? row.name,
    url: createSiteRootUrl(row) ?? '',
    external: row.external ?? false,
    logo,
    logo_dark,
  };
}
