import type { SiteContext } from '../../../context.site.server.js';
import {
  formatSiteWorkDTO,
  dbGetLatestPublishedSubmissionVersion,
} from '../submissions/published/get.server.js';
import { withApiBaseUrl } from '@curvenote/scms-core';

const OG_API = 'https://og.curvenote.com/';

function setKindThemeWithSideEffects(url: URL, kind: string) {
  if (kind === 'Retrospective') {
    // 'text-green-800'
    url.searchParams.set('theme', '#306339');
  } else if (kind === 'Letter') {
    // 'text-rose-800'
    url.searchParams.set('theme', '#92243B');
  } else if (kind === 'Review') {
    // 'text-blue-800'
    url.searchParams.set('theme', '#263FA9');
  } else if (kind === 'Original') {
    url.searchParams.set('theme', '#531078');
  } else if (kind === 'Book') {
    url.searchParams.set('theme', '#551111');
  } else {
    url.searchParams.set('theme', '#345E98');
  }
}

export default async function (ctx: SiteContext, workIdOrSlug: string, versionId?: string) {
  console.log('🎑 - Generating social image for', workIdOrSlug, versionId);

  // TODO get a specific work version when versionId is provided
  const dbo = await dbGetLatestPublishedSubmissionVersion(ctx.site.name, workIdOrSlug);
  if (!dbo) return;

  if (!dbo.work_version.cdn || !dbo.work_version.cdn_key) return;

  // TODO - remove this when we have a way to server a generic (no leaked private info) social image
  if (ctx.site.private && ctx.privateCdnUrls().has(dbo.work_version.cdn)) return;

  const kind = dbo.submission.kind.name;
  const wv = dbo.work_version;
  const siteDTO = ctx.siteDTO;

  const url = new URL(`${OG_API}api/journal`);

  if (siteDTO.logo) url.searchParams.set('logo', siteDTO.logo);
  url.searchParams.set('title', wv.title.replace(/<\/?[a-zA-Z0-9-]+>/g, ''));
  url.searchParams.set('authors', wv.authors.map((a) => a).join(', '));
  url.searchParams.set('subject', kind || ctx.site.title || '');
  setKindThemeWithSideEffects(url, kind);

  // TODO restore this when we get the kind

  let rewriteRequest = ctx.request;
  if (rewriteRequest.url.includes('localhost')) {
    rewriteRequest = new Request('https://journals.curvenote.dev');
    console.log('\n\n🎑 - Overriding with production URLs\n\n');
  }
  ctx.asApiUrl = withApiBaseUrl(rewriteRequest);
  const dto = formatSiteWorkDTO(ctx, dbo);
  url.searchParams.set('image', dto.links?.thumbnail || '');
  const dateString = (dto.date ? new Date(dto.date) : new Date()).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  url.searchParams.set('date', dateString);
  // 'https://og-pearl.vercel.app/api/physiome?title=Bond%20Graph%20Model%20of%20Cerebral%20Circulation%3A%20Toward%20Clinically%20Feasible%20Systemic%20Blood%20Flow%20Simulations&date=August%2021%2C%202020&image=https%3A%2F%2Fphysiome.curve.space%2Fstatic%2Fthumbnails%2FS000001.png&authors=Shan%20Su%2C%20Pablo%20J.%20Blanco%2C%20Lucas%20O.%20M%C3%BCller%2C%20Peter%20J.%20Hunter%2C%20Soroush%20Safaei&subject=Original%20Submission',
  const ogUrl = url.toString();
  const resp = await fetch(ogUrl);
  const buffer = await resp.arrayBuffer();
  return buffer;
}
