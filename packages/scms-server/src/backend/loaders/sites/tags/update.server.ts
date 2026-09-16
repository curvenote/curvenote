import type { TagDTO } from '@curvenote/common';
import { TAG_LABEL_MAX_LENGTH, httpError, isValidTagLabel } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatTagDTO } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;

export type UpdateSiteTagLabelParams = {
  siteId: string;
  tagId: string;
  label: string;
};

/** Rename the display label. `id` and `name` stay as they are. */
export async function updateSiteTagLabel(params: UpdateSiteTagLabelParams): Promise<TagDTO> {
  const label = params.label.trim();
  if (!isValidTagLabel(label)) {
    throw httpError(400, `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`);
  }

  const prisma = await getPrismaClient();
  const existing = await prisma.tag.findFirst({
    where: { id: params.tagId, site_id: params.siteId },
    select: { id: true },
  });
  if (!existing) {
    throw httpError(404, 'tag not found on this site');
  }

  const row = await prisma.tag.update({
    where: { id: existing.id },
    data: { label },
    select: TAG_SELECT,
  });
  return formatTagDTO(row);
}
