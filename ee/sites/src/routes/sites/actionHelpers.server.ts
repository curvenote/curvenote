import { data } from 'react-router';
import type { SecureContext } from '@curvenote/scms-server';
import { createSiteRequestMessage } from '../../backend/messages.server.js';
import { SlackEventType, sites, withValidFormData } from '@curvenote/scms-server';
import { TrackEvent } from '@curvenote/scms-core';
import type { SiteConfig } from '@curvenote/common';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

const RequestSiteSchema = zfd.formData({
  name: zfd.text(z.string().min(1, 'Name is required')),
  email: zfd.text(z.string().email('Valid email is required').min(1, 'Email is required')),
  labWebsite: zfd
    .text(
      z
        .string()
        .transform((val) => (val === '' ? undefined : val))
        .pipe(z.union([z.string().url('Invalid URL format'), z.undefined()])),
    )
    .optional(),
  additionalInfo: zfd.text(z.string().optional()),
});

export async function actionRequestSite(ctx: SecureContext, formData: FormData) {
  return withValidFormData(RequestSiteSchema, formData, async (payload) => {
    try {
      const messageId = await createSiteRequestMessage(ctx, {
        name: payload.name,
        email: payload.email,
        labWebsite: payload.labWebsite || undefined,
        additionalInfo: payload.additionalInfo || undefined,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email || undefined,
      });

      await ctx.sendSlackNotification({
        eventType: SlackEventType.SITE_REQUEST_SENT,
        message: `New site request from ${payload.name} (${payload.email})`,
        user: ctx.user,
        metadata: {
          messageId,
          requesterName: payload.name,
          requesterEmail: payload.email,
          additionalInfo: payload.additionalInfo,
          labWebsite: payload.labWebsite,
        },
        color: 'good',
      });

      await ctx.trackEvent(TrackEvent.SITE_REQUEST_SENT, {
        messageId,
        requesterName: payload.name,
        requesterEmail: payload.email,
        hasLabWebsite: !!payload.labWebsite,
        hasAdditionalInfo: !!payload.additionalInfo,
      });

      await ctx.analytics.flush();

      return { success: true, messageId };
    } catch (error) {
      console.error('Error creating site request message:', error);
      return data({ error: 'Failed to submit request' }, { status: 500 });
    }
  });
}

export function minimalSiteConfig(
  name: string,
  title: string,
): Omit<SiteConfig, 'collections'> & Record<string, any> {
  const baseConfig: Omit<SiteConfig, 'collections'> = {
    name,
    default_workflow: 'SIMPLE',
    title,
    description: '',
    external: false,
    private: false,
    restricted: true,
    favicon: 'https://cdn.curvenote.com/static/site/curvenote/favicon.ico',
    tagline: '',
    logo: 'https://cdn.curvenote.com/static/site/curvenote/logo-icon-blue.svg',
    logo_dark: 'https://cdn.curvenote.com/static/site/curvenote/logo-icon-white.svg',
    footer_logo: 'https://cdn.curvenote.com/static/site/curvenote/logo-text-white.svg',
    footer_logo_dark: 'https://cdn.curvenote.com/static/site/curvenote/logo-text-blue.svg',
    footer_links: [
      [
        {
          url: '/',
          title: 'Home',
        },
        {
          url: '/articles',
          title: 'Latest Research',
        },
      ],
    ],
    social_links: [
      { kind: 'github', url: 'https://github.com/curvenote' },
      { kind: 'twitter', url: 'https://twitter.com/@curvenote' },
      { kind: 'website', url: 'https://curvenote.com/' },
    ],
    theme_config: {
      name: 'theme-one',
      colors: {
        primary: '#0154a4',
        secondary: '#616161',
      },
      styles: {
        footer: 'bg-primary dark:bg-stone-700 text-primary-contrast',
      },
      content: {
        tableOfContents: true,
        navigationBanner: false,
      },
      jupyter: {
        mecaBundle: true,
        binderUrlOverride: 'https://xhrtcvh6l53u.curvenote.dev/services/binder/',
      },
      landing: {
        grid: 'article-left-grid',
        hero: {
          title: '',
          tagline: '',
          description: '',
          backgroundImage: '',
          cta: [],
          layout: 'left',
          classes: {
            text: 'text-primary-contrast text-xl font-light',
            heading: 'text-primary-contrast text-5xl',
            tagline: 'text-2xl mt-0 font-extralight',
            description: undefined,
            background: 'bg-left',
            backgroundScreen: 'bg-black bg-opacity-50 lg:hidden',
          },
        },
        listing: 'list',
        numListingItems: 3,
        documentOutline: true,
        listingTitle: 'Latest Articles',
        listingActionText: 'See All Articles',
      },
      listing: {
        type: 'list',
        title: 'All Articles',
      },
      articles: {
        grid: 'article-left-grid',
        documentOutline: true,
        tableOfContents: false,
        supportingDocuments: true,
        jupyter: {
          launchBinder: true,
          figureCompute: true,
          notebookCompute: true,
        },
      },
      manifest: {
        nav: [{ title: 'Articles', url: '/articles' }],
      },
      submission: false,
    },
  };
  const additionalFields = {
    submission_cdn: 'https://prv.curvenote.dev/',
    content: 'curvenote-landing.curve.space/',
  };
  return { ...baseConfig, ...additionalFields };
}

const CreateSiteSchema = zfd.formData({
  name: zfd.text(
    z
      .string()
      .min(3, 'URL name must be at least 3 characters')
      .max(30, 'URL name must be at most 30 characters')
      .regex(/^[a-z0-9-]+$/, 'URL name must contain only lowercase letters, numbers, and hyphens'),
  ),
  title: zfd.text(z.string().min(1, 'Title is required')),
  hostname: zfd.text(z.string().min(1, 'Hostname is required')),
});

export async function actionCreateSite(ctx: SecureContext, formData: FormData) {
  return withValidFormData(CreateSiteSchema, formData, async (payload) => {
    const siteConfig = minimalSiteConfig(payload.name, payload.title);
    const result = await sites.dbCreateSite(ctx, { hostname: payload.hostname, siteConfig });

    // dbCreateSite returns a Response object on error, or { success: true } on success
    if (result instanceof Response) {
      return result;
    }

    return { success: true };
  });
}
