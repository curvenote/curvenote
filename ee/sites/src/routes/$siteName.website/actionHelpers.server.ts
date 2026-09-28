import { data as dataResponse } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import type { FooterLink, SocialLink } from '@curvenote/common';
import type { FontLicense, SiteThemeConfig, ThemeFontsConfig } from '../../themeConfig/types.js';
import {
  FontLicenseSchema,
  FontsSchema,
  fontLicenseError,
  fontsError,
} from '../../themeConfig/validate.js';
import { verificationInvalidated } from '../../themeConfig/license.js';
import { logSiteActivity } from '../../themeConfig/siteActivity.server.js';
import { ActivityType } from '@curvenote/scms-db';
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
  const fonts = formData.get('fonts') as string | null;
  const fontLicense = formData.get('fontLicense') as string | null;

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

  // Sent only when changed. Every slot removed (`{}`) clears the key, which the theme reads as
  // its defaults; anything else has to pass the same checks the editor showed.
  let parsedFonts: ThemeFontsConfig | undefined;
  if (fonts !== null) {
    let raw: unknown;
    try {
      raw = JSON.parse(fonts);
    } catch {
      return dataResponse({ error: 'Fonts are malformed' }, { status: 400 });
    }
    const result = FontsSchema.safeParse(raw);
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path?.length ? ` at ${issue.path.join('.')}` : '';
      return dataResponse({ error: `Fonts are malformed${where}` }, { status: 400 });
    }
    parsedFonts = result.data as ThemeFontsConfig;
    const problem = fontsError(parsedFonts);
    if (problem) return dataResponse({ error: problem }, { status: 400 });
  }

  let parsedLicense: FontLicense | undefined;
  if (fontLicense !== null) {
    let raw: unknown;
    try {
      raw = JSON.parse(fontLicense);
    } catch {
      return dataResponse({ error: 'Font license is malformed' }, { status: 400 });
    }
    const result = FontLicenseSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues[0]?.message;
      return dataResponse(
        { error: reason ? `Font license: ${reason}` : 'Font license is malformed' },
        { status: 400 },
      );
    }
    parsedLicense = { files: (result.data as FontLicense).files };
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

  // Uploaded fonts need their license on file. Check against what will be stored, so a save
  // that touches only one of the two is still held to it. `verified` is only ever set on the
  // Advanced page; here it is carried over — and dropped when what it covered has changed.
  let nextVerified: boolean | undefined;
  let verificationDropped = false;
  if (parsedFonts !== undefined || parsedLicense !== undefined) {
    const stored = coerceToObject(ctx.site.metadata) as Record<string, unknown>;
    const storedFonts = (stored.theme_config as SiteThemeConfig | undefined)?.fonts;
    const storedLicense = stored.font_license as FontLicense | undefined;
    const nextFonts = parsedFonts ?? storedFonts;
    const nextFiles = parsedLicense ?? storedLicense;
    const problem = fontLicenseError(nextFonts, nextFiles);
    if (problem) return dataResponse({ error: problem }, { status: 400 });
    const invalidated = verificationInvalidated(
      { fonts: storedFonts, license: storedLicense },
      { fonts: nextFonts, license: nextFiles },
    );
    nextVerified = invalidated ? undefined : storedLicense?.verified;
    verificationDropped = invalidated && !!storedLicense?.verified;
    if (parsedLicense === undefined && invalidated && storedLicense) {
      // Only fonts changed, but the license record still has to lose its verification
      parsedLicense = { files: storedLicense.files };
    }
    if (parsedLicense !== undefined) parsedLicense = { ...parsedLicense, verified: nextVerified };
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
    footerLinks !== null ||
    parsedFonts !== undefined ||
    parsedLicense !== undefined
  ) {
    await safeSiteMetadataUpdate(ctx.site.id, (metadata) => {
      const updatedMetadata = coerceToObject(metadata);
      const updatedThemeConfig = (updatedMetadata.theme_config as SiteThemeConfig) || {};
      if (parsedFonts !== undefined) {
        if (Object.keys(parsedFonts).length) updatedThemeConfig.fonts = parsedFonts;
        else delete updatedThemeConfig.fonts;
      }
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
      if (parsedLicense !== undefined) {
        if (parsedLicense.files?.length || parsedLicense.verified)
          updatedMetadata.font_license = parsedLicense;
        else delete updatedMetadata.font_license;
      }
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
  // Audit trail: which parts of the design changed, and the font/license change separately
  const designFields = (
    [
      ['title', title],
      ['description', description],
      ['logo', logoUrl],
      ['logo_dark', logoDarkUrl],
      ['favicon', faviconUrl],
      ['footer_logo', footerLogoUrl],
      ['footer_logo_dark', footerLogoDarkUrl],
      ['tagline', tagline],
      ['social_links', socialLinks],
      ['footer_links', footerLinks],
      ['color_primary', colorPrimary],
      ['color_secondary', colorSecondary],
    ] as const
  )
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([field]) => field);
  if (designFields.length) {
    await logSiteActivity(ctx, ActivityType.SITE_DESIGN_UPDATED, { fields: designFields });
  }
  if (parsedFonts !== undefined || parsedLicense !== undefined) {
    const slots = parsedFonts ? (Object.keys(parsedFonts) as (keyof ThemeFontsConfig)[]) : [];
    await logSiteActivity(ctx, ActivityType.SITE_FONTS_UPDATED, {
      fonts_changed: parsedFonts !== undefined,
      slots,
      sources: Object.fromEntries(
        slots.map((slot) => [
          slot,
          parsedFonts?.[slot]?.source ?? (parsedFonts?.[slot]?.faces?.length ? 'custom' : 'stack'),
        ]),
      ),
      license_changed: fontLicense !== null,
      license_files: parsedLicense?.files?.length ?? 0,
      verification_dropped: verificationDropped,
    });
  }

  if (parsedFonts !== undefined) {
    const slots = Object.keys(parsedFonts) as (keyof ThemeFontsConfig)[];
    await ctx.trackEvent(TrackEvent.SITE_FONTS_UPDATED, {
      slots_set: slots,
      sources: Object.fromEntries(
        slots.map((slot) => [
          slot,
          parsedFonts?.[slot]?.source ?? (parsedFonts?.[slot]?.faces?.length ? 'custom' : 'stack'),
        ]),
      ),
      display: parsedFonts.body?.display ?? 'swap',
    });
  }

  await ctx.analytics.flush();

  return { success: true };
}
