import {
  getPrismaClient,
  type WorkVersionDBO,
  formatAuthorDTO,
  signPrivateUrls,
  type Context,
} from '@curvenote/scms-server';
import { formatDate } from '@curvenote/common';
import { doi } from 'doi-utils';

/**
 * Get the latest work version for a work
 * Orders by date_created descending and returns the first result
 */
export async function dbGetLatestWorkVersion(workId: string) {
  const prisma = await getPrismaClient();
  const latestVersion = await prisma.workVersion.findFirst({
    where: { work_id: workId },
    orderBy: {
      date_created: 'desc',
    },
  });
  return latestVersion;
}

/**
 * Format a work version as a DTO
 */
export function formatWorkVersionDTO(
  ctx: Context,
  workId: string,
  version: WorkVersionDBO,
): {
  id: string;
  date_created: string;
  draft: boolean;
  cdn: string | null;
  cdn_key: string | null;
  title: string;
  description: string | null;
  authors: Array<{ name: string }>;
  date: string | null;
  doi: string | null;
  canonical: boolean | null;
  metadata: WorkVersionDBO['metadata'];
  links: {
    self: string;
    thumbnail?: string;
    doi?: string;
  };
} {
  let thumbnail: string | undefined;
  if (version.cdn && version.cdn_key) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn: version.cdn, key: version.cdn_key },
      ctx.asApiUrl(`/works/${workId}/thumbnail`),
      'no-social',
    );
    thumbnail = thumbnailUrl;
  }

  return {
    id: version.id,
    date_created: formatDate(version.date_created),
    draft: version.draft,
    cdn: version.cdn,
    cdn_key: version.cdn_key,
    title: version.title,
    description: version.description,
    authors: version.authors.map((a) => formatAuthorDTO(a)),
    date: version.date ? formatDate(version.date) : null,
    doi: version.doi,
    canonical: version.canonical,
    metadata: version.metadata,
    links: {
      self: ctx.asApiUrl(`/works/${workId}/versions/${version.id}`),
      ...(thumbnail && { thumbnail }),
      ...(version.doi && { doi: doi.buildUrl(version.doi) }),
    },
  };
}
