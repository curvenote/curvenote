import { error404, documentPreviewCacheId, previewCandidateMd5s } from '@curvenote/scms-core';
import type { ActivityType, Prisma } from '@curvenote/scms-db';
import { formatDate } from '@curvenote/common';
import { uuidv7 } from 'uuidv7';
import {
  draftUploadVersionContains,
  mergeWorkContains,
} from '../../loaders/works/contains.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { KnownBuckets, StorageBackend } from '../../storage/index.js';
import type { SecureContext } from '../../context.server.js';
import type { WorkContext } from '../../context.work.server.js';

type CloneDraftWorkVersionContext = SecureContext | WorkContext;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Sanitize source work version metadata for a new draft clone.
 * Shallow-copies all top-level keys, then resets version-specific workflow state.
 */
export function seedDraftMetadataFromSource(sourceMetadata: unknown): Record<string, unknown> {
  const source = isPlainObject(sourceMetadata) ? { ...sourceMetadata } : {};

  const next: Record<string, unknown> = { ...source };

  next.checks = { enabled: [] };

  if (isPlainObject(source.pmc)) {
    next.pmc = {
      ...source.pmc,
      previewed: false,
      confirmed: false,
    };
  }

  return next;
}

export type SeedDocumentPreviewCacheArgs = {
  sourceWorkVersionId: string;
  targetWorkVersionId: string;
  metadata: unknown;
  createdById?: string;
};

/**
 * Best-effort copy of version-scoped document preview cache rows in the Object table.
 * Skips silently when metadata.files, md5, or source rows are absent.
 */
export async function seedDocumentPreviewCacheFromSource(
  tx: Prisma.TransactionClient,
  args: SeedDocumentPreviewCacheArgs,
): Promise<number> {
  const md5s = previewCandidateMd5s(args.metadata);
  if (md5s.length === 0) return 0;

  const now = formatDate();
  const rows: Prisma.ObjectCreateManyInput[] = [];

  for (const md5 of md5s) {
    const sourceId = documentPreviewCacheId(args.sourceWorkVersionId, md5);
    const targetId = documentPreviewCacheId(args.targetWorkVersionId, md5);

    const sourceRow = await tx.object.findUnique({
      where: { id: sourceId },
      select: { data: true },
    });
    if (sourceRow?.data == null) continue;

    rows.push({
      id: targetId,
      type: targetId,
      date_created: now,
      date_modified: now,
      data: sourceRow.data as Prisma.InputJsonValue,
      occ: 0,
      ...(args.createdById ? { created_by_id: args.createdById } : {}),
    });
  }

  if (rows.length === 0) return 0;

  const result = await tx.object.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return result.count;
}

export type CloneDraftWorkVersionFromSourceArgs = {
  workId: string;
  sourceWorkVersionId: string;
  source?: string;
  activityType?: ActivityType;
};

export type CloneDraftWorkVersionFromSourceResult = {
  workId: string;
  workVersionId: string;
};

/**
 * Create a new draft work version cloned from a source version: scalars, metadata, thumbnail,
 * reference-copied files, and best-effort preview cache seeding.
 */
export async function cloneDraftWorkVersionFromSource(
  ctx: CloneDraftWorkVersionContext,
  args: CloneDraftWorkVersionFromSourceArgs,
): Promise<CloneDraftWorkVersionFromSourceResult> {
  const prisma = await getPrismaClient();
  const date_created = new Date().toISOString();
  const workVersionId = uuidv7();
  const backend = new StorageBackend(ctx, [KnownBuckets.prv]);
  const cdnKey = uuidv7();
  const activityType = args.activityType ?? ('DRAFT_WORK_VERSION_STARTED' as ActivityType);

  return prisma.$transaction(async (tx) => {
    const source = await tx.workVersion.findFirst({
      where: { id: args.sourceWorkVersionId, work_id: args.workId },
    });
    if (!source) throw error404();

    const existing = await tx.work.findUnique({
      where: { id: args.workId },
      select: {
        contains: true,
        versions: {
          orderBy: { date_created: 'desc' },
          take: 1,
          select: { contains: true },
        },
      },
    });
    if (!existing) throw error404();

    const previousVersionContains = existing.versions[0]?.contains ?? source.contains ?? [];
    const versionContains = draftUploadVersionContains(previousVersionContains);
    const workContains = mergeWorkContains(existing.contains, versionContains);
    const versionMetadata = seedDraftMetadataFromSource(source.metadata);

    await tx.work.update({
      where: { id: args.workId },
      data: {
        date_modified: date_created,
        contains: { set: workContains },
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              cdn: source.cdn ?? backend.cdnFromKnownBucket(KnownBuckets.prv),
              cdn_key: cdnKey,
              title: source.title ?? '',
              description: source.description ?? '',
              authors: source.authors ?? [],
              author_details: (source.author_details ?? []).filter((a) => a != null),
              draft: true,
              contains: versionContains,
              metadata: versionMetadata as Prisma.InputJsonValue,
              thumbnail: source.thumbnail,
              doi: null,
            },
          ],
        },
      },
    });

    await seedDocumentPreviewCacheFromSource(tx, {
      sourceWorkVersionId: source.id,
      targetWorkVersionId: workVersionId,
      metadata: versionMetadata,
      createdById: ctx.user.id,
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created,
        date_modified: date_created,
        activity_by: { connect: { id: ctx.user.id } },
        activity_type: activityType,
        work: { connect: { id: args.workId } },
        work_version: { connect: { id: workVersionId } },
      },
      select: { id: true },
    });

    return { workId: args.workId, workVersionId };
  });
}
