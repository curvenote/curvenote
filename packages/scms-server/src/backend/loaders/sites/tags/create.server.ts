import type { TagDTO } from '@curvenote/common';
import {
  TAG_LABEL_MAX_LENGTH,
  httpError,
  isValidTagLabel,
  isValidTagName,
  toTagName,
} from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatTagDTO } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;

export type CreateSiteTagParams = {
  siteId: string;
  label: string;
};

/**
 * Insert a catalog tag. Unlike assign-from-label, a duplicate derived name is
 * a 400 — this path is an explicit create, not an idempotent find-or-create.
 */
export async function createSiteTag(params: CreateSiteTagParams): Promise<TagDTO> {
  const label = params.label.trim();
  if (!isValidTagLabel(label)) {
    throw httpError(400, `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`);
  }
  const name = toTagName(label);
  if (!isValidTagName(name)) {
    throw httpError(400, `invalid tag name derived from label: "${label}"`);
  }

  const prisma = await getPrismaClient();
  try {
    const row = await prisma.tag.create({
      data: {
        id: uuidv7(),
        name,
        label,
        date_created: new Date().toISOString(),
        site: { connect: { id: params.siteId } },
      },
      select: TAG_SELECT,
    });
    return formatTagDTO(row);
  } catch (e: any) {
    if (e?.code !== 'P2002') {
      throw e;
    }
    throw httpError(400, 'a tag with this name already exists');
  }
}
