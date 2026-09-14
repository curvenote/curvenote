import { getPrismaClient } from '../../prisma.server.js';
import type {
  CollectionSummaryDTO,
  Host,
  Site as SiteConfig,
  SiteDTO,
  SiteWithContentDTO,
} from '@curvenote/common';
import { formatFooterLinks, formatSocialLinks } from '../../format.server.js';
import { coerceToObject, error404 } from '@curvenote/scms-core';
import type { Collection, SiteRole } from '@curvenote/scms-db';
import type { Context } from '../../context.server.js';
import type { UserDBO } from '../../db.types.js';
import { createSiteRootUrl } from '../../domains.server.js';
import { formatTagDTO, type TagRow } from './tags/format.server.js';

export type SiteUserDBO = { site_id: string; user_id: string; role: SiteRole };
export type UserWithSiteRolesDBO = UserDBO & { site_roles: SiteUserDBO[] };

export async function dbGetSite(name: string) {
  const prisma = await getPrismaClient();
  return prisma.site.findUnique({
    where: { name },
    include: {
      submissionKinds: true,
      collections: {
        orderBy: { date_created: 'desc' },
      },
      domains: true,
      tags: {
        select: { id: true, name: true, label: true },
        orderBy: { label: 'asc' },
      },
    },
  });
}

// `tags` is typed as optional here (rather than inherited as-is from `dbGetSite`'s
// literal `include`) because `dbListMany` (see `list.server.ts`) accepts a
// caller-supplied `include` that may omit the tag catalog, and other queries
// across the codebase (e.g. `my/sites.server.ts`) build objects of this same
// `DBO` shape too. `formatSiteDTO` guards this with `dbo.tags ?? []`.
//
// Trade-off: this removes the compile-time tripwire a required field would give.
// Any new query whose result feeds `formatSiteDTO` MUST add a `tags` include
// (see `dbGetSite` above for the shape) or it will silently report an empty
// tag catalog instead of failing to compile.
export type DBO = Omit<NonNullable<Awaited<ReturnType<typeof dbGetSite>>>, 'tags'> & {
  tags?: TagRow[];
};

export async function dbGetSiteContent(site: DBO) {
  if (!site.content_id) {
    return;
  }
  const prisma = await getPrismaClient();
  const work = await prisma.work.findUnique({
    where: { id: site.content_id },
    include: {
      versions: {
        take: 1,
        orderBy: { date_created: 'desc' },
      },
    },
  });
  return work?.versions[0];
}

export type SiteContentDBO = NonNullable<Awaited<ReturnType<typeof dbGetSiteContent>>>;

export async function dbGetUserSiteRoles(userId: string, siteId: string) {
  const prisma = await getPrismaClient();
  const siteUsers = await prisma.siteUser.findMany({
    where: {
      user_id: userId,
      site_id: siteId,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });
  return siteUsers;
}

/** Fields read by {@link formatCollectionSummaryDTO}. */
export type CollectionSummaryInput = Pick<
  Collection,
  'id' | 'name' | 'slug' | 'workflow' | 'content' | 'open'
>;

export function formatCollectionSummaryDTO(dbo: CollectionSummaryInput): CollectionSummaryDTO {
  return {
    id: dbo.id,
    name: dbo.name,
    slug: dbo.slug,
    workflow: dbo.workflow,
    content: coerceToObject(dbo.content),
    open: dbo.open,
  };
}

export function formatSiteDTO(ctx: Context, dbo: DBO): SiteDTO {
  const site = dbo.metadata as unknown as SiteConfig;
  const siteRootUrl = createSiteRootUrl(dbo);

  return {
    id: dbo.id,
    name: dbo.name ?? '',
    default_workflow: dbo.default_workflow,
    title: dbo.title ?? '',
    private: dbo.private ?? false,
    url: siteRootUrl,
    restricted: dbo.restricted ?? false,
    external: dbo.external ?? false,
    description: dbo.description ?? '',
    favicon: site.favicon ?? undefined,
    tagline: site.tagline || undefined,
    logo: site.logo,
    logo_dark: site.logo_dark,
    footer_logo: site.footer_logo || undefined,
    footer_logo_dark: site.footer_logo_dark || undefined,
    footer_links: formatFooterLinks(site.footer_links),
    social_links: formatSocialLinks(site.social_links),
    theme_config: site.theme_config || undefined,
    collections: dbo.collections.map((c) => formatCollectionSummaryDTO(c)),
    tags: (dbo.tags ?? []).map((t) => formatTagDTO(t)),
    links: {
      self: ctx.asApiUrl(`/sites/${dbo.name}`),
      html: siteRootUrl,
      collections: ctx.asApiUrl(`/sites/${dbo.name}/collections`),
      works: ctx.asApiUrl(`/sites/${dbo.name}/works`),
    },
  };
}

export function formatSiteWithContentDTO(
  ctx: Context,
  dbo: DBO,
  contentVersion?: SiteContentDBO,
): SiteWithContentDTO {
  const site = dbo.metadata as unknown as { content: Host };
  const cdn = contentVersion?.cdn ?? ctx.$config.api.knownBucketInfoMap.cdn?.cdn;
  const key = contentVersion?.cdn_key;
  const content: Host = cdn && key ? { cdn, key } : site.content || '';

  const dto = formatSiteDTO(ctx, dbo);

  return { ...dto, content };
}

export default async function (ctx: Context, siteName: string) {
  const dbo = await dbGetSite(siteName);
  if (!dbo || !dbo.metadata) {
    throw error404();
  }
  return formatSiteDTO(ctx, dbo);
}
