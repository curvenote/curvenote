import { data as dataResponse } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import type { FooterLink, JournalThemeConfig, SocialLink } from '@curvenote/common';
import { coerceToObject, TrackEvent } from '@curvenote/scms-core';
import { getPrismaClient, safeSiteMetadataUpdate } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

/** Mirrors MAX_FOOTER_LINK_COLUMNS on the client; the theme lays out at most this many. */
const MAX_FOOTER_LINK_COLUMNS = 3;

export async function $actionUpdateSiteDesign(ctx: SiteContext, formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const logoUrl = formData.get('logoUrl') as string;
  const logoDarkUrl = formData.get('logoDarkUrl') as string;
  const faviconUrl = formData.get('faviconUrl') as string;
  const footerLogoUrl = formData.get('footerLogoUrl') as string;
  const footerLogoDarkUrl = formData.get('footerLogoDarkUrl') as string;
  const tagline = formData.get('tagline') as string | null;
  const socialLinks = formData.get('socialLinks') as string | null;
  const footerLinks = formData.get('footerLinks') as string | null;
  const colorPrimary = formData.get('colorPrimary') as string;
  const colorSecondary = formData.get('colorSecondary') as string;

  const hexColorRegex = /^#[A-Fa-f0-9]{6}$/;
  if (
    (colorPrimary && !hexColorRegex.test(colorPrimary)) ||
    (colorSecondary && !hexColorRegex.test(colorSecondary))
  ) {
    return dataResponse({ error: 'Invalid color format' }, { status: 400 });
  }
  let parsedFooterLinks: FooterLink[][] | undefined;
  if (footerLinks !== null) {
    try {
      parsedFooterLinks = JSON.parse(footerLinks) as FooterLink[][];
    } catch {
      return dataResponse({ error: 'Footer links are malformed' }, { status: 400 });
    }
    if (!Array.isArray(parsedFooterLinks)) {
      return dataResponse({ error: 'Footer links are malformed' }, { status: 400 });
    }
    if (parsedFooterLinks.length > MAX_FOOTER_LINK_COLUMNS) {
      return dataResponse(
        { error: `Footer links can have at most ${MAX_FOOTER_LINK_COLUMNS} columns` },
        { status: 400 },
      );
    }
    if (
      parsedFooterLinks.some(
        (column) =>
          !Array.isArray(column) ||
          column.length === 0 ||
          column.some((link) => !link?.title?.trim() || !link?.url?.trim()),
      )
    ) {
      return dataResponse(
        {
          error:
            'Every footer link column needs at least one link, and every link needs a title and a link',
        },
        { status: 400 },
      );
    }
  }

  let parsedSocialLinks: SocialLink[] | undefined;
  if (socialLinks !== null) {
    try {
      parsedSocialLinks = JSON.parse(socialLinks) as SocialLink[];
    } catch {
      return dataResponse({ error: 'Social links are malformed' }, { status: 400 });
    }
    if (
      !Array.isArray(parsedSocialLinks) ||
      parsedSocialLinks.some((link) => !link?.kind?.trim() || !link?.url?.trim())
    ) {
      return dataResponse({ error: 'Every social link needs a link' }, { status: 400 });
    }
  }

  if (
    colorPrimary ||
    colorSecondary ||
    logoUrl ||
    logoDarkUrl ||
    faviconUrl ||
    footerLogoUrl ||
    footerLogoDarkUrl ||
    tagline !== null ||
    socialLinks !== null ||
    footerLinks !== null
  ) {
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
      if (faviconUrl) updatedMetadata.favicon = faviconUrl;
      if (footerLogoUrl) updatedMetadata.footer_logo = footerLogoUrl;
      if (footerLogoDarkUrl) updatedMetadata.footer_logo_dark = footerLogoDarkUrl;
      // Checked against null so an empty tagline clears it
      if (tagline !== null) updatedMetadata.tagline = tagline;
      if (parsedFooterLinks) {
        updatedMetadata.footer_links = parsedFooterLinks.map((column) =>
          column.map((link) => ({ title: link.title, url: link.url, external: link.external })),
        );
      }
      if (parsedSocialLinks) {
        updatedMetadata.social_links = parsedSocialLinks.map(({ kind, url }) => ({ kind, url }));
      }

      return updatedMetadata;
    });
  }
  if (title !== null || description !== null) {
    const data: Prisma.SiteUpdateInput = {};
    if (title) data.title = title;
    if (description) data.description = description;
    data.date_modified = new Date().toISOString();
    const prisma = await getPrismaClient();
    await prisma.site.update({ where: { id: ctx.site.id }, data, select: { id: true } });
  }

  await ctx.trackEvent(TrackEvent.SITE_DESIGN_UPDATED, {
    title,
    description,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
    footerLogoUrl,
    footerLogoDarkUrl,
    tagline,
    socialLinks,
    footerLinks,
    colorPrimary,
    colorSecondary,
  });

  await ctx.analytics.flush();

  return { success: true };
}
