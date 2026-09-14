import type { TagDTO } from '@curvenote/common';
import { isValidTagName, toTagName, httpError } from '@curvenote/scms-core';
import { ActivityType } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatTagDTO, type TagRow } from './format.server.js';

const TAG_SELECT = { id: true, name: true, label: true } as const;

export type AssignTagInput = { tagId: string } | { label: string };

export type AssignTagParams = {
  siteId: string;
  submissionId: string;
  userId: string;
  input: AssignTagInput;
};

export type RemoveTagParams = {
  siteId: string;
  submissionId: string;
  userId: string;
  tagId: string;
};

async function assertSubmissionOnSite(siteId: string, submissionId: string) {
  const prisma = await getPrismaClient();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, site_id: siteId },
    select: { id: true },
  });
  if (!submission) throw httpError(404, 'submission not found on this site');
}

/**
 * Find the site tag for `tagId`, or create it from `label`.
 *
 * Creation is idempotent: the derived name is unique per site, so a concurrent
 * create raises P2002 and we read the winning row instead of failing.
 */
async function resolveTag(siteId: string, input: AssignTagInput): Promise<TagRow> {
  const prisma = await getPrismaClient();

  if ('tagId' in input) {
    const tag = await prisma.tag.findFirst({
      where: { id: input.tagId, site_id: siteId },
      select: TAG_SELECT,
    });
    if (!tag) throw httpError(404, 'tag not found on this site');
    return tag;
  }

  const label = input.label.trim();
  const name = toTagName(label);
  if (!isValidTagName(name)) {
    throw httpError(400, `invalid tag name derived from label: "${label}"`);
  }

  try {
    return await prisma.tag.create({
      data: {
        id: uuidv7(),
        name,
        label,
        date_created: new Date().toISOString(),
        site: { connect: { id: siteId } },
      },
      select: TAG_SELECT,
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e;
    return prisma.tag.findFirstOrThrow({
      where: { name, site_id: siteId },
      select: TAG_SELECT,
    });
  }
}

async function recordTagActivity(
  submissionId: string,
  userId: string,
  tag: TagRow,
  action: 'added' | 'removed',
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  await prisma.activity.create({
    data: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      activity_type: ActivityType.SUBMISSION_TAGS_CHANGE,
      activity_by: { connect: { id: userId } },
      submission: { connect: { id: submissionId } },
      data: { action, tag: { id: tag.id, name: tag.name, label: tag.label } },
    },
    select: { id: true },
  });
}

/** Assign an existing tag, or create one from a label and assign it. */
export async function assignTagToSubmission(params: AssignTagParams): Promise<TagDTO> {
  const { siteId, submissionId, userId, input } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, input);

  const prisma = await getPrismaClient();
  const existing = await prisma.tagsInSubmissions.findUnique({
    where: { submission_id_tag_id: { submission_id: submissionId, tag_id: tag.id } },
    select: { id: true },
  });

  if (!existing) {
    await prisma.tagsInSubmissions.create({
      data: {
        id: uuidv7(),
        date_created: new Date().toISOString(),
        tag: { connect: { id: tag.id } },
        submission: { connect: { id: submissionId } },
      },
      select: { id: true },
    });
    await recordTagActivity(submissionId, userId, tag, 'added');
  }

  return formatTagDTO(tag);
}

/** Remove one tag from a submission. The tag stays in the site catalog. */
export async function removeTagFromSubmission(params: RemoveTagParams): Promise<TagDTO> {
  const { siteId, submissionId, userId, tagId } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, { tagId });

  const prisma = await getPrismaClient();
  const deleted = await prisma.tagsInSubmissions.deleteMany({
    where: { submission_id: submissionId, tag_id: tagId },
  });

  if (deleted.count > 0) {
    await recordTagActivity(submissionId, userId, tag, 'removed');
  }

  return formatTagDTO(tag);
}
