import type { SiteConfig } from '@curvenote/common';
import type { SiteContext } from '@curvenote/scms-server';
import { createSiteRootUrl } from '@curvenote/scms-server';

/** Fields required by site layout chrome (SecondaryNav) — not full SiteDTO / formatSiteDTO. */
export type SiteLayoutSite = {
  name: string;
  title: string;
  logo: string;
  logo_dark?: string;
  links: { html?: string };
};

export function formatSiteLayoutSite(ctx: SiteContext): SiteLayoutSite {
  const config = ctx.site.metadata as SiteConfig | null;
  return {
    name: ctx.site.name,
    title: ctx.site.title ?? ctx.site.name,
    logo: config?.logo ?? '',
    logo_dark: config?.logo_dark,
    links: { html: createSiteRootUrl(ctx.site) },
  };
}
