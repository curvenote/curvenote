import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { updateSiteBackend, getSiteUsersWithBlueskySession } from './backend.server.js';

export async function actionUpdateBackend(ctx: SiteContext, formData: FormData) {
  const siteId = formData.get('siteId');
  const backendType = formData.get('backendType');
  const nominatedUserLinkedAccountIds = formData
    .getAll('nominatedUserLinkedAccountId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (typeof siteId !== 'string' || siteId !== ctx.site.id) {
    return data({ error: 'Invalid site' }, { status: 400 });
  }
  if (backendType !== 'curvenote-cdn' && backendType !== 'atproto') {
    return data({ error: 'Invalid backend type' }, { status: 400 });
  }

  if (backendType === 'curvenote-cdn') {
    await updateSiteBackend(siteId, { type: 'curvenote-cdn' });
    return { info: 'Backend set to Curvenote CDN' };
  }

  if (nominatedUserLinkedAccountIds.length !== 1) {
    return data(
      { error: 'Select exactly one nominated Bluesky user for AT Protocol publishing' },
      { status: 400 },
    );
  }
  const [linkedAccountId] = nominatedUserLinkedAccountIds;

  const siteUsersWithBluesky = await getSiteUsersWithBlueskySession(siteId);
  const valid = siteUsersWithBluesky.some((u) => u.linkedAccountId === linkedAccountId);
  if (!valid) {
    return data(
      { error: 'Selected user does not have an active Bluesky session for this site' },
      { status: 400 },
    );
  }

  await updateSiteBackend(siteId, {
    type: 'atproto',
    nominatedUserLinkedAccountId: linkedAccountId,
  });
  return { info: 'Backend set to AT Protocol' };
}
