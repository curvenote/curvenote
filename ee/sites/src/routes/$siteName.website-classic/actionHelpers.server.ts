import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import type { JournalThemeConfig } from '@curvenote/common';
import { coerceToObject } from '@curvenote/scms-core';
import { getPrismaClient, safeSiteMetadataUpdate } from '@curvenote/scms-server';
import type { Intents } from './types.js';
import { INTENTS } from './types.js';

export async function $actionEditNavLinks(ctx: SiteContext, formData: FormData) {
  const intent = String(formData.get('intent')) as Intents;

  const metadata = coerceToObject(ctx.site.metadata);
  const themeConfig = metadata.theme_config as JournalThemeConfig;
  const nav = themeConfig?.manifest?.nav ?? [];

  if (intent === INTENTS.navAdd) {
    const title = formData.get('nav.new.title') as string;
    const url = formData.get('nav.new.url') as string;
    if (!title || !url) {
      return data({ error: 'Title and URL are required' }, { status: 400 });
    }
    nav.push({ title, url });
  } else {
    const oldUrl = formData.get('old_url') as string;
    const title = formData.get(`nav.${oldUrl}.title`) as string;
    const url = formData.get(`nav.${oldUrl}.url`) as string;
    if (!title || !url) {
      return data({ error: 'Title and URL are required' }, { status: 400 });
    }

    const index = nav.findIndex((n) => n.url === oldUrl);
    if (index === -1) {
      return data({ error: 'Could not find nav item' }, { status: 400 });
    }

    if (intent === INTENTS.navUpdate) {
      nav[index] = { title, url };
    } else if (intent === INTENTS.navDelete) {
      nav.splice(index, 1);
    } else if (intent === INTENTS.navMoveUp) {
      nav.splice(Math.max(0, index - 1), 0, nav.splice(index, 1)[0]);
    } else if (intent === INTENTS.navMoveDown) {
      nav.splice(index + 1, 0, nav.splice(index, 1)[0]);
    }
  }

  const prisma = await getPrismaClient();
  await prisma.site.update({
    where: { id: ctx.site.id },
    data: { metadata, date_modified: new Date().toISOString() },
  });

  return { metadata };
}

export interface CTA {
  url: string;
  label: string;
  icon?: string;
  classes?: string;
  openInNewTab?: boolean;
}

export async function $actionEditCTAs(ctx: SiteContext, formData: FormData) {
  const intent = String(formData.get('intent')) as Intents;

  const metadata = coerceToObject(ctx.site.metadata);
  const themeConfig = metadata.theme_config as JournalThemeConfig;
  let ctas = themeConfig?.landing?.hero?.cta ?? [];
  if (!Array.isArray(ctas)) ctas = [ctas];

  const idx = Number(formData.get('cta.idx'));

  const updated = metadata;

  if (intent === INTENTS.ctaRemove) {
    // pass
    updated.theme_config = {
      ...themeConfig,
      landing: {
        ...themeConfig.landing,
        hero: {
          ...themeConfig.landing?.hero,
          cta: ctas.filter((_, i) => i !== idx),
        },
      },
    };
  } else if (intent === INTENTS.ctaSave) {
    // validate
    const label = String(formData.get('cta.label'));
    const url = String(formData.get('cta.url'));
    const icon = String(formData.get('cta.icon'));
    const openInNewTab = formData.get('cta.openInNewTab') === 'true';

    const upsert = {
      label,
      url,
      icon: icon === 'none' ? undefined : (icon as any),
      openInNewTab,
    };

    ctas[idx] = {
      ...ctas[idx],
      ...upsert,
    };

    updated.theme_config = {
      ...themeConfig,
      landing: {
        ...themeConfig.landing,
        hero: {
          ...themeConfig.landing?.hero,
          cta: ctas,
        },
      },
    };
  }

  const prisma = await getPrismaClient();
  await prisma.site.update({
    where: { id: ctx.site.id },
    data: { metadata: updated, date_modified: new Date().toISOString() },
  });

  return null;
}

export async function $actionEditLogo(ctx: SiteContext, formData: FormData) {
  const intent = String(formData.get('intent')) as Intents;

  const updatedSite = await safeSiteMetadataUpdate(ctx.site.id, (metadata) => {
    const updatedMetadata = coerceToObject(metadata);
    if (intent === INTENTS.logoUpdate) {
      const logoPath = formData.get('logoPath') as string;
      const publicCdn = ctx.$config.api.knownBucketInfoMap.pub.cdn;
      updatedMetadata.logo = `${publicCdn}/${logoPath}`;
    } else if (intent === INTENTS.logoRemove) {
      delete updatedMetadata.logo;
    }
    return updatedMetadata;
  });
  return { logoUrl: coerceToObject(updatedSite.metadata)?.logo };
}

export async function $actionUpdateThemeColor(ctx: SiteContext, formData: FormData) {
  const color = formData.get('color') as string;
  const level = formData.get('level') as 'primary' | 'secondary';

  if (!color) {
    return data({ error: 'Primary color is required' }, { status: 400 });
  }

  const hexColorRegex = /^#[A-Fa-f0-9]{6}$/;
  if (!hexColorRegex.test(color)) {
    return data({ error: 'Invalid color format' }, { status: 400 });
  }

  await safeSiteMetadataUpdate(ctx.site.id, (metadata) => {
    const updatedMetadata = coerceToObject(metadata);
    const updatedThemeConfig = (updatedMetadata.theme_config as JournalThemeConfig) || {};
    updatedThemeConfig.colors = {
      ...(updatedThemeConfig.colors || {}),
      [level]: color,
    };

    updatedMetadata.theme_config = updatedThemeConfig;

    return updatedMetadata;
  });

  return { success: true, color, level };
}
