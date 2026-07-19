import type { SiteRole } from '@curvenote/scms-db';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { SlackEventType } from '@curvenote/scms-server';
import { SiteTrackEvent } from '../../analytics/events.js';

function actorLabel(ctx: SiteContextWithUser) {
  return ctx.user.display_name || ctx.user.username || ctx.user.id;
}

/**
 * Site-extension Slack + analytics for service-account lifecycle.
 * Event type enums live in `@curvenote/scms-server`; message copy and metadata
 * shape for site SAs stay here.
 */
export async function notifySiteServiceAccountCreated(
  ctx: SiteContextWithUser,
  opts: { serviceUserId: string; role: SiteRole },
) {
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SITE_SERVICE_ACCOUNT_CREATED,
    message: `Site service account created on ${ctx.site.name} by ${actorLabel(ctx)}`,
    user: ctx.user,
    metadata: {
      site: ctx.site.name,
      serviceUserId: opts.serviceUserId,
      role: opts.role,
    },
  });

  await ctx.trackEvent(SiteTrackEvent.SITE_SERVICE_ACCOUNT_CREATED, {
    serviceUserId: opts.serviceUserId,
    role: opts.role,
  });
  await ctx.analytics.flush();
}

export async function notifySiteServiceAccountDeleted(
  ctx: SiteContextWithUser,
  opts: { serviceUserId: string },
) {
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SITE_SERVICE_ACCOUNT_DELETED,
    message: `Site service account deleted on ${ctx.site.name} by ${actorLabel(ctx)}`,
    user: ctx.user,
    metadata: {
      site: ctx.site.name,
      serviceUserId: opts.serviceUserId,
    },
  });

  await ctx.trackEvent(SiteTrackEvent.SITE_SERVICE_ACCOUNT_DELETED, {
    serviceUserId: opts.serviceUserId,
  });
  await ctx.analytics.flush();
}

export async function notifySiteServiceAccountTokenCreated(
  ctx: SiteContextWithUser,
  opts: {
    serviceUserId: string;
    tokenId: string;
    description: string;
    expiry: string;
    expiresAt?: string;
  },
) {
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SITE_SERVICE_ACCOUNT_TOKEN_CREATED,
    message: `Site service account token created on ${ctx.site.name} by ${actorLabel(ctx)}`,
    user: ctx.user,
    metadata: {
      site: ctx.site.name,
      serviceUserId: opts.serviceUserId,
      tokenId: opts.tokenId,
      expiry: opts.expiry,
      ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
    },
  });

  await ctx.trackEvent(SiteTrackEvent.SITE_SERVICE_ACCOUNT_TOKEN_CREATED, {
    serviceUserId: opts.serviceUserId,
    tokenId: opts.tokenId,
    description: opts.description,
    expiry: opts.expiry,
    expiresAt: opts.expiresAt,
  });
  await ctx.analytics.flush();
}

export async function notifySiteServiceAccountTokenDeleted(
  ctx: SiteContextWithUser,
  opts: { serviceUserId: string; tokenId: string },
) {
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SITE_SERVICE_ACCOUNT_TOKEN_DELETED,
    message: `Site service account token deleted on ${ctx.site.name} by ${actorLabel(ctx)}`,
    user: ctx.user,
    metadata: {
      site: ctx.site.name,
      serviceUserId: opts.serviceUserId,
      tokenId: opts.tokenId,
    },
  });

  await ctx.trackEvent(SiteTrackEvent.SITE_SERVICE_ACCOUNT_TOKEN_DELETED, {
    serviceUserId: opts.serviceUserId,
    tokenId: opts.tokenId,
  });
  await ctx.analytics.flush();
}
