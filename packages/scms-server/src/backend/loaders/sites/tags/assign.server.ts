import type { TagDTO } from '@curvenote/common';
import {
  isValidTagLabel,
  isValidTagName,
  toTagName,
  httpError,
  TAG_LABEL_MAX_LENGTH,
} from '@curvenote/scms-core';
import { ActivityType } from '@curvenote/scms-db';
import type { Prisma } from '@curvenote/scms-db';
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

/**
 * A tag change and whether it actually happened. `changed` is false when the
 * call was redundant (already assigned, already removed), so callers can skip
 * side effects — analytics in particular — that must mirror the activity log.
 */
export type TagChangeResult = { tag: TagDTO; changed: boolean };

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
  if (!submission) {
    throw httpError(404, 'submission not found on this site');
  }
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
    if (!tag) {
      throw httpError(404, 'tag not found on this site');
    }
    return tag;
  }

  const label = input.label.trim();
  if (!isValidTagLabel(label)) {
    throw httpError(400, `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`);
  }
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
    if (e?.code !== 'P2002') {
      throw e;
    }
    return prisma.tag.findFirstOrThrow({
      where: { name, site_id: siteId },
      select: TAG_SELECT,
    });
  }
}

async function recordTagActivity(
  tx: Prisma.TransactionClient,
  submissionId: string,
  userId: string,
  tag: TagRow,
  action: 'added' | 'removed',
) {
  const timestamp = new Date().toISOString();
  await tx.activity.create({
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

/**
 * Bump `Submission.date_modified`, mirroring what the kind and date-published
 * actions do, so anything ordering by it sees a tag change as recent activity.
 */
async function touchSubmission(
  tx: Prisma.TransactionClient,
  submissionId: string,
  timestamp: string,
) {
  await tx.submission.update({
    where: { id: submissionId },
    data: { date_modified: timestamp },
    select: { id: true },
  });
}

/**
 * Assign an existing tag, or create one from a label and assign it.
 *
 * The tag is resolved (found-or-created) before the transaction opens: its own
 * P2002 recovery reads the winning row, and that recovery cannot live inside the
 * transaction below, because a P2002 there would abort it.
 *
 * The join-row write and the activity write happen together in one transaction,
 * so a crash between them can never leave one without the other. The join
 * create is itself guarded against P2002: two concurrent assigns of the same
 * tag to the same submission both pass validation, but only one create can win
 * the compound-unique `[submission_id, tag_id]`; the loser's transaction is
 * rolled back and treated as "already assigned" rather than as a failure: no
 * second activity is written and the call reports `changed: false`.
 */
export async function assignTagToSubmission(params: AssignTagParams): Promise<TagChangeResult> {
  const { siteId, submissionId, userId, input } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, input);
  const prisma = await getPrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      const timestamp = new Date().toISOString();
      await tx.tagsInSubmissions.create({
        data: {
          id: uuidv7(),
          date_created: timestamp,
          tag: { connect: { id: tag.id } },
          submission: { connect: { id: submissionId } },
        },
        select: { id: true },
      });
      await recordTagActivity(tx, submissionId, userId, tag, 'added');
      await touchSubmission(tx, submissionId, timestamp);
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') {
      throw e;
    }
    // Already assigned by a concurrent call: nothing to create, no activity to add.
    return { tag: formatTagDTO(tag), changed: false };
  }

  return { tag: formatTagDTO(tag), changed: true };
}

/**
 * Remove one tag from a submission. The tag stays in the site catalog.
 *
 * The join-row delete and the activity write happen together in one
 * transaction. The activity is written only when a join row was actually
 * deleted, so a redundant remove (already removed by a concurrent call)
 * writes no activity and reports `changed: false`.
 */
export async function removeTagFromSubmission(params: RemoveTagParams): Promise<TagChangeResult> {
  const { siteId, submissionId, userId, tagId } = params;
  await assertSubmissionOnSite(siteId, submissionId);

  const tag = await resolveTag(siteId, { tagId });
  const prisma = await getPrismaClient();

  const changed = await prisma.$transaction(async (tx) => {
    const deleted = await tx.tagsInSubmissions.deleteMany({
      where: { submission_id: submissionId, tag_id: tagId },
    });
    if (deleted.count === 0) {
      return false;
    }
    const timestamp = new Date().toISOString();
    await recordTagActivity(tx, submissionId, userId, tag, 'removed');
    await touchSubmission(tx, submissionId, timestamp);
    return true;
  });

  return { tag: formatTagDTO(tag), changed };
}
