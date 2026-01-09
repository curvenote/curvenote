import { data } from 'react-router';
import { uuidv7 as uuid } from 'uuidv7';
import type { SiteConfig } from '@curvenote/common';
import { getPrismaClient } from '../../prisma.server.js';
import type { Context } from '../../context.server.js';
import { SlackEventType } from '../../services/slack.server.js';
import { TrackEvent } from '@curvenote/scms-core';
import type { Check } from '@curvenote/check-definitions';

export type CollectionConfig = {
  name: string;
  slug: string;
  workflow: string;
  kinds: string[];
  content: {
    title: string;
    description: string;
  };
  open: boolean;
  default: boolean;
};

export type KindConfig = {
  name: string;
  title?: string;
  description?: string;
  default: boolean;
  checks: Check[];
};

export type CreateSiteData = {
  hostname?: string;
  siteConfig: Omit<SiteConfig, 'collections'> & Record<string, any>;
  collections?: CollectionConfig[];
  kinds?: KindConfig[];
};

export const DEFAULT_CHECKS: Check[] = [
  {
    id: 'abstract-exists',
  },
  {
    id: 'abstract-length',
  },
  {
    id: 'authors-exist',
  },
  {
    id: 'authors-corresponding',
  },
  {
    id: 'authors-have-affiliations',
  },
  {
    id: 'authors-have-orcid',
    optional: true,
  },
  {
    id: 'authors-have-credit-roles',
    optional: true,
  },
  {
    id: 'keywords-defined',
  },
  {
    id: 'keywords-length',
    max: 15,
  },
  {
    id: 'keywords-unique',
  },
  {
    id: 'links-resolve',
  },
  {
    id: 'doi-exists',
  },
];

function isValidDomain(domain: string) {
  // Regex to check for valid domain format
  const domainRegex = /^[a-zA-Z0-9-]{1,63}(\.[a-zA-Z0-9-]{1,63})+$/;
  return domainRegex.test(domain);
}

export async function dbCreateSite(ctx: Context, siteData: CreateSiteData) {
  const { hostname, kinds, collections, siteConfig } = siteData;

  // Only validate hostname for non-external sites
  let validated_hostname;
  if (!siteConfig.external) {
    if (typeof hostname !== 'string') {
      return data({ error: { hostname: 'Invalid form data - hostname' } }, { status: 400 });
    }

    try {
      if (!isValidDomain(hostname)) throw new Error('Invalid hostname');
      // test that it's a valid url, and then get to the hostname
      validated_hostname = new URL(
        /^(http:\/\/|https:\/\/).*/i.test(hostname) ? hostname : `https://${hostname}`,
      ).hostname;
    } catch {
      return data({ error: { hostname: 'Invalid hostname' } }, { status: 400 });
    }
  }

  siteConfig.default_workflow = siteConfig.private ? 'PRIVATE' : siteConfig.default_workflow;

  const kindsToCreate =
    kinds && kinds.length > 0
      ? kinds
      : [
          {
            name: 'article',
            title: 'Article',
            description: 'A research article',
            default: true,
            checks: DEFAULT_CHECKS,
          },
        ];

  const collectionsToCreate =
    collections && collections.length > 0
      ? collections
      : [
          {
            name: 'articles',
            slug: 'articles',
            workflow: siteConfig.default_workflow,
            kinds: [kindsToCreate[0].name],
            content: {
              title: 'Articles',
              description: 'A collection of research articles',
            },
            open: true,
            default: true,
          },
        ];

  siteConfig.theme_config = siteConfig.external
    ? undefined
    : {
        name: 'theme-one', // fallback
        ...siteConfig.theme_config,
        secure: siteConfig.private,
      };

  const prisma = await getPrismaClient();
  const site = await prisma.site.findUnique({ where: { name: siteConfig.name } });
  if (site) {
    return data(
      { error: { submit: 'Site already exists, new sites must have a unique name' } },
      { status: 400 },
    );
  }

  // Validate collections and kinds
  const kindNames = new Set(kindsToCreate.map((k) => k.name));
  collectionsToCreate.forEach((c) => {
    c.workflow = siteConfig.private ? 'PRIVATE' : c.workflow;
  });

  // Validate that all referenced kinds exist
  for (const collection of collectionsToCreate) {
    for (const kindName of collection.kinds) {
      if (!kindNames.has(kindName)) {
        return data(
          {
            error: {
              submit: `Collection "${collection.name}" references non-existent kind "${kindName}"`,
            },
          },
          { status: 400 },
        );
      }
    }
  }

  // Validate that each kind is referenced by at least one collection
  const referencedKinds = new Set(collectionsToCreate.flatMap((c) => c.kinds));
  for (const kind of kindsToCreate) {
    if (!referencedKinds.has(kind.name)) {
      return data(
        { error: { submit: `Kind "${kind.name}" is not referenced by any collection` } },
        { status: 400 },
      );
    }
  }

  // Validate that at least one collection is marked as default
  if (collectionsToCreate.length > 0 && !collectionsToCreate.some((c) => c.default)) {
    return data(
      { error: { submit: 'At least one collection must be marked as default' } },
      { status: 400 },
    );
  }

  const dateNow = new Date().toISOString();

  const row = {
    id: uuid(),
    date_created: dateNow,
    date_modified: dateNow,
    name: siteConfig.name,
    default_workflow: siteConfig.default_workflow,
    title: siteConfig.title,
    private: siteConfig.private,
    external: siteConfig.external,
    description: siteConfig.description,
    metadata: siteConfig as any,
    submissionKinds: {
      create: kindsToCreate.map((kind: KindConfig, index: number) => {
        // If there's only one kind, it must be default
        // If there are multiple kinds and no default is set, make the first one default
        const shouldBeDefault =
          kindsToCreate.length === 1 ||
          (index === 0 && !kindsToCreate.some((k: KindConfig) => k.default));

        return {
          id: uuid(),
          name: kind.name,
          date_created: dateNow,
          date_modified: dateNow,
          content: {
            title: kind.title ?? kind.name,
            description: kind.description,
          },
          default: shouldBeDefault || (kind.default ?? false),
          checks: kind.checks ?? [],
        };
      }),
    },
    // Only create domain for non-external sites
    ...(siteConfig.external || !validated_hostname
      ? {}
      : {
          domains: {
            create: [
              {
                id: uuid(),
                date_created: dateNow,
                date_modified: dateNow,
                hostname: validated_hostname,
              },
            ],
          },
        }),
  };

  console.log(`🚛 loaded site data`);
  console.log(`▹ name: ${row.name}`);
  console.log(`▹ title: ${row.title}`);
  console.log(`▹ private: ${row.private}`);
  console.log(`▹ external: ${row.external}`);
  console.log(`▹ description: ${row.description}`);
  console.log(`▹ metadata: ${JSON.stringify(row.metadata).slice(0, 50)}...`);
  console.log(
    `▹ metadata.theme_config: ${JSON.stringify(row.metadata.theme_config ?? {}).slice(0, 50)}...`,
  );
  console.log(
    `▹ submissionKinds: ${row.submissionKinds.create.map((k: any) => k.name).join(', ')}`,
  );
  if (!siteConfig.external && 'domains' in row && row.domains) {
    console.log(`▹ domains: ${row.domains.create.map((d: any) => d.hostname).join(', ')}`);
  }

  try {
    const createdSite = await prisma.$transaction(async (tx) => {
      const created = await tx.site.create({
        data: row,
        include: {
          submissionKinds: true,
          domains: true,
        },
      });

      // Create each collection
      for (const collection of collectionsToCreate) {
        await tx.collection.create({
          data: {
            id: uuid(),
            date_created: dateNow,
            date_modified: dateNow,
            name: collection.name,
            slug: collection.slug,
            workflow: collection.workflow ?? row.default_workflow,
            site: {
              connect: {
                id: created.id,
              },
            },
            open: collection.open,
            default: collection.default,
            content: collection.content,
            kindsInCollection: {
              create: collection.kinds.map((kindName) => ({
                id: uuid(),
                date_created: dateNow,
                date_modified: dateNow,
                kind: {
                  connect: {
                    id: created.submissionKinds.find((k) => k.name === kindName)!.id,
                  },
                },
              })),
            },
          },
        });
      }
      return created;
    });
    await ctx.sendSlackNotification({
      eventType: SlackEventType.SITE_CREATED,
      message: `New site: ${ctx.asBaseUrl(`/app/sites/${createdSite.name}`)}`,
      user: ctx.user,
      metadata: {
        name: createdSite.name,
        hostname: createdSite.domains[0]?.hostname,
      },
    });

    await ctx.trackEvent(TrackEvent.SITE_CREATED, {
      // These fields match default SiteContext tracked fields
      siteId: createdSite.id,
      siteTitle: createdSite.title,
      sitePrivate: createdSite.private,
      siteRestricted: createdSite.restricted,
      // These are additional fields
      external: createdSite.external,
      hostname: createdSite.domains[0]?.hostname,
      defaultWorkflow: createdSite.default_workflow,
      submissionKindsCount: createdSite.submissionKinds.length,
      collectionsCount: collectionsToCreate.length,
    });
    await ctx.analytics.flush();
  } catch (err: any) {
    return data(
      { error: { submit: `🤕 Failed to create site - ${err.message}` } },
      { status: 400 },
    );
  }

  return { success: true };
}
