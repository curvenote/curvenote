import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { updateSiteBackend, getSiteUsersWithBlueskySession } from './backend.server.js';

export async function actionUpdateBackend(ctx: SiteContext, formData: FormData) {
  const siteId = formData.get('siteId');
  const backendType = formData.get('backendType');
  const nominatedUserLinkedAccountId = formData.get('nominatedUserLinkedAccountId');

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

  const linkedAccountId =
    typeof nominatedUserLinkedAccountId === 'string' ? nominatedUserLinkedAccountId.trim() : '';
  if (!linkedAccountId) {
    return data(
      { error: 'Please select a nominated user when using AT Protocol backend' },
      { status: 400 },
    );
  }

  const siteUsersWithBluesky = await getSiteUsersWithBlueskySession(siteId);
  const valid = siteUsersWithBluesky.some((u) => u.linkedAccountId === linkedAccountId);
  if (!valid) {
    return data({ error: 'Selected user does not have an active Bluesky session for this site' }, { status: 400 });
  }

  await updateSiteBackend(siteId, { type: 'atproto', nominatedUserLinkedAccountId: linkedAccountId });
  return { info: 'Backend set to AT Protocol' };
}
