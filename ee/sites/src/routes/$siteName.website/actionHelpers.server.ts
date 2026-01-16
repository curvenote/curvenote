import { data as dataResponse } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import type { JournalThemeConfig } from '@curvenote/common';
import { coerceToObject, TrackEvent } from '@curvenote/scms-core';
import { getPrismaClient, safeSiteMetadataUpdate } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

export async function $actionUpdateSiteDesign(ctx: SiteContext, formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const logoUrl = formData.get('logoUrl') as string;
  const logoDarkUrl = formData.get('logoDarkUrl') as string;
  const colorPrimary = formData.get('colorPrimary') as string;
  const colorSecondary = formData.get('colorSecondary') as string;

  const hexColorRegex = /^#[A-Fa-f0-9]{6}$/;
  if (
    (colorPrimary && !hexColorRegex.test(colorPrimary)) ||
    (colorSecondary && !hexColorRegex.test(colorSecondary))
  ) {
    return dataResponse({ error: 'Invalid color format' }, { status: 400 });
  }
  if (colorPrimary || colorSecondary || logoUrl || logoDarkUrl) {
    await safeSiteMetadataUpdate(ctx.site.id, (metadata) => {
      const updatedMetadata = coerceToObject(metadata);
      const updatedThemeConfig = (updatedMetadata.theme_config as JournalThemeConfig) || {};
      if (colorPrimary) {
        updatedThemeConfig.colors = {
          ...(updatedThemeConfig.colors || {}),
          primary: colorPrimary,
        };
      }
      if (colorSecondary) {
        updatedThemeConfig.colors = {
          ...(updatedThemeConfig.colors || {}),
          secondary: colorSecondary,
        };
      }
      updatedMetadata.theme_config = updatedThemeConfig;
      if (logoUrl) updatedMetadata.logo = logoUrl;
      if (logoDarkUrl) updatedMetadata.logo_dark = logoDarkUrl;

      return updatedMetadata;
    });
  }
  if (title !== null || description !== null) {
    const data: Prisma.SiteUpdateInput = {};
    if (title) data.title = title;
    if (description) data.description = description;
    data.date_modified = new Date().toISOString();
    const prisma = await getPrismaClient();
    await prisma.site.update({ where: { id: ctx.site.id }, data });
  }

  await ctx.trackEvent(TrackEvent.SITE_DESIGN_UPDATED, {
    title,
    description,
    logoUrl,
    logoDarkUrl,
    colorPrimary,
    colorSecondary,
  });

  await ctx.analytics.flush();

  return { success: true };
}
