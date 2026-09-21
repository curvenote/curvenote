import { data as dataResponse } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { safeSiteMetadataUpdate } from '@curvenote/scms-server';
import { coerceToObject, TrackEvent } from '@curvenote/scms-core';
import type { SiteThemeConfig, ThemeRedirectsConfig } from '../../themeConfig/types.js';
import { RedirectsSchema, redirectsError } from '../../themeConfig/validate.js';
import { logSiteActivity } from '../../themeConfig/siteActivity.server.js';
import { ActivityType } from '@curvenote/scms-db';

/**
 * Save `theme_config.redirects`. The payload is the JSON the editor built; an empty/`null`
 * payload removes the key. Validation is the same `redirectsError` the client shows, so the
 * server never rejects something the form said was fine.
 */
export async function $actionUpdateRedirects(
  ctx: SiteContext,
  formData: FormData,
  hostnames: string[],
) {
  const raw = formData.get('redirects');
  if (typeof raw !== 'string') {
    return dataResponse({ error: 'Redirects are missing' }, { status: 400 });
  }
  let redirects: ThemeRedirectsConfig | undefined;
  if (raw.trim() && raw.trim() !== 'null') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return dataResponse({ error: 'Redirects are malformed' }, { status: 400 });
    }
    const result = RedirectsSchema.safeParse(parsed);
    if (!result.success) {
      return dataResponse({ error: 'Redirects are malformed' }, { status: 400 });
    }
    redirects = result.data as ThemeRedirectsConfig;
    const problem = redirectsError(redirects, hostnames);
    if (problem) return dataResponse({ error: problem }, { status: 400 });
  }

  await safeSiteMetadataUpdate(ctx.site.id, (metadata) => {
    const updated = coerceToObject(metadata);
    const themeConfig = (updated.theme_config as SiteThemeConfig) || {};
    if (redirects) themeConfig.redirects = redirects;
    else delete themeConfig.redirects;
    updated.theme_config = themeConfig;
    return updated;
  });

  const statuses: Record<string, number> = {};
  const count = (target: unknown) => {
    const status =
      typeof target === 'object' && target ? (target as { status?: number }).status : undefined;
    const key = String(status ?? 302);
    statuses[key] = (statuses[key] ?? 0) + 1;
  };
  redirects?.rules?.forEach(count);
  (['$landing', '$info', '$notFound'] as const).forEach((g) => {
    if (redirects?.[g] !== undefined) count(redirects[g]);
  });

  const summary = {
    rules: redirects?.rules?.length ?? 0,
    groups: (['$landing', '$info', '$notFound'] as const).filter(
      (g) => redirects?.[g] !== undefined,
    ),
    statuses,
  };
  await logSiteActivity(ctx, ActivityType.SITE_REDIRECTS_UPDATED, summary);
  await ctx.trackEvent(TrackEvent.SITE_REDIRECTS_UPDATED, summary);

  return { success: true };
}
