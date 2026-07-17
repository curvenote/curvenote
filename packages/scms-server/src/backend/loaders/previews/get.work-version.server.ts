import { type WorkDTO } from '@curvenote/common';
import { doi } from 'doi-utils';
import { error404 } from '@curvenote/scms-core';
import type { Context } from '../../context.server.js';
import type { WorkDBO, WorkVersionDBO } from '../../db.types.js';
import { getPrismaClient } from '../../prisma.server.js';
import { siteWorkWorkVersionWithWorkSelect } from '../../prisma.selects.server.js';
import { signPrivateUrls } from '../../sign.private.server.js';
import { formatWorkDTO } from '../works/get.server.js';

/**
 * Load a work version for web article preview (no submission/site).
 * Caller must validate preview token claims (aud, scope, scopeId === workVersionId).
 */
export default async function getWorkVersionPreview(
  ctx: Context,
  workVersionId: string,
): Promise<WorkDTO> {
  const prisma = await getPrismaClient();
  const dbo = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
    select: {
      ...siteWorkWorkVersionWithWorkSelect,
      work: { select: { id: true, doi: true, key: true, date_created: true } },
    },
  });
  if (!dbo) throw error404();
  if (!dbo.cdn?.trim() || !dbo.cdn_key?.trim()) throw error404('work version has no CDN site');

  const workDto = formatWorkDTO(ctx, dbo.work as WorkDBO, dbo as WorkVersionDBO);
  const resolvedDoi = dbo.doi ?? dbo.work.doi ?? undefined;
  const signed = signPrivateUrls(
    ctx,
    { cdn: dbo.cdn, key: dbo.cdn_key },
    ctx.asApiUrl(`/works/${dbo.work_id}/thumbnail`),
    ctx.asApiUrl(`/works/${dbo.work_id}/social`),
  );

  return {
    ...workDto,
    cdn: signed.host.cdn,
    cdn_key: dbo.cdn_key,
    cdn_query: signed.host.query,
    doi: resolvedDoi,
    links: {
      ...workDto.links,
      thumbnail: signed.thumbnail,
      social: signed.social,
      config: signed.config,
      doi: resolvedDoi ? doi.buildUrl(resolvedDoi) : undefined,
    },
  };
}
