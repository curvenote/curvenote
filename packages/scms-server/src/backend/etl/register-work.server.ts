import { formatDate } from '@curvenote/common';
import { httpError, WorkContents } from '@curvenote/scms-core';
import { ActivityType, WorkRole } from '@curvenote/scms-db';
import type { Prisma } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';
import { getPrismaClient } from '../prisma.server.js';
import { authorizeEtlSite, verifyEtlBearerUserId, type EtlAuth } from './auth.server.js';
import { cdnKeyUnderArticle } from './register-work-cdn-key.js';
import {
  applySupersededToSubmissionMetadata,
  buildSubmissionMetadataWithSupersedes,
} from './register-work-lineage.js';

export type EtlRegisterWorkInput = {
  site: string;
  collection?: string;
  kind?: string;
  doi: string;
  version_tag?: string;
  allow_retagging?: boolean;
  article_cdn_prefix?: string;
  source?: string;
  cdn: string;
  cdn_key: string;
  contains?: string[];
  title: string;
  description?: string;
  authors?: string[];
  author_details?: Record<string, unknown>[];
  date?: string;
  myst_metadata?: Record<string, unknown>;
  work_metadata?: Record<string, unknown>;
  submission_metadata?: Record<string, unknown>;
};

export type EtlRegisterWorkResult = {
  status: 'skipped' | 'created';
};

export type EtlRegisterSkipReason =
  | 'cdn_key_already_registered'
  | 'retagging_not_allowed'
  | 'article_cdn_prefix_mismatch';

export type EtlRegisterDecision =
  | { action: 'skip'; reason: EtlRegisterSkipReason }
  | { action: 'create' };

/** Pure skip/create decision for ETL register-work */
export function resolveEtlRegisterDecision(input: {
  versionTag?: string;
  articleCdnPrefix?: string;
  taggedCdnKey?: string;
  allowRetagging?: boolean;
  workAlreadyHasIncomingCdnKey?: boolean;
}): EtlRegisterDecision {
  const versionTag = input.versionTag?.trim();
  const articleCdnPrefix = input.articleCdnPrefix?.trim();

  if (input.workAlreadyHasIncomingCdnKey) {
    return { action: 'skip', reason: 'cdn_key_already_registered' };
  }

  if (versionTag && input.taggedCdnKey !== undefined) {
    const tagged = input.taggedCdnKey.trim();
    if (!input.allowRetagging) {
      return { action: 'skip', reason: 'retagging_not_allowed' };
    }
    if (!articleCdnPrefix || !cdnKeyUnderArticle(articleCdnPrefix, tagged)) {
      return { action: 'skip', reason: 'article_cdn_prefix_mismatch' };
    }
  }

  return { action: 'create' };
}

function buildWorkVersionMetadata(
  input: EtlRegisterWorkInput,
): Record<string, unknown> | undefined {
  const myst = input.myst_metadata;
  const workMeta = input.work_metadata;
  if (!myst && !workMeta) return undefined;
  return {
    ...(myst ? { 'frontmatter.myst': myst } : {}),
    ...workMeta,
  };
}

function collectionConnect(siteId: string, name: string) {
  return {
    connect: {
      name_site_id: {
        name,
        site_id: siteId,
      },
    },
  };
}

function kindConnect(siteId: string, name: string) {
  return {
    connect: {
      name_site_id: {
        name,
        site_id: siteId,
      },
    },
  };
}

function laterPublishedDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

async function findOwnedWorkIdByDoi(userId: string, doi: string): Promise<string | undefined> {
  const prisma = await getPrismaClient();
  const ownerFilter = {
    work_users: {
      some: {
        user_id: userId,
        role: WorkRole.OWNER,
      },
    },
  };
  const match = await prisma.work.findFirst({
    where: { doi, ...ownerFilter },
    select: { id: true },
  });
  return match?.id;
}

type TaggedSubmissionVersion = {
  id: string;
  cdn_key: string | null;
};

async function workHasVersionWithCdnKey(workId: string, cdnKey: string): Promise<boolean> {
  const prisma = await getPrismaClient();
  const hit = await prisma.workVersion.findFirst({
    where: { work_id: workId, cdn_key: cdnKey },
    select: { id: true },
  });
  return !!hit;
}

async function findTaggedSubmissionVersion(
  siteId: string,
  workId: string,
  versionTag: string,
): Promise<TaggedSubmissionVersion | undefined> {
  const prisma = await getPrismaClient();
  const hit = await prisma.submissionVersion.findFirst({
    where: {
      submission: {
        site_id: siteId,
        work_id: workId,
      },
      tags: { has: versionTag },
    },
    select: {
      id: true,
      work_version: { select: { cdn_key: true } },
    },
  });
  if (!hit) return undefined;
  return { id: hit.id, cdn_key: hit.work_version.cdn_key };
}

async function findTaggedSubmissionVersionIds(
  tx: Prisma.TransactionClient,
  siteId: string,
  workId: string,
  versionTag: string,
): Promise<string[]> {
  const versions = await tx.submissionVersion.findMany({
    where: {
      submission: { site_id: siteId, work_id: workId },
      tags: { has: versionTag },
    },
    select: { id: true },
  });
  return versions.map((sv) => sv.id);
}

async function markSubmissionVersionsSuperseded(
  tx: Prisma.TransactionClient,
  supersededIds: string[],
  versionTag: string,
  newSubmissionVersionId: string,
  supersededAt: string,
  venueKey: string,
): Promise<void> {
  for (const id of supersededIds) {
    const sv = await tx.submissionVersion.findUnique({
      where: { id },
      select: { tags: true, metadata: true },
    });
    if (!sv) continue;
    const newTags = sv.tags.filter((tag) => tag !== versionTag);
    await tx.submissionVersion.update({
      where: { id },
      data: {
        tags: newTags,
        metadata: applySupersededToSubmissionMetadata(
          sv.metadata,
          venueKey,
          newSubmissionVersionId,
          supersededAt,
        ) as Prisma.InputJsonValue,
      },
    });
  }
}

type RegisterWorkInDbOptions = {
  /** Retag and link superseded submission versions in metadata. */
  allowRetagging?: boolean;
};

async function registerWorkInDb(
  auth: EtlAuth,
  siteId: string,
  collectionName: string,
  kindName: string,
  input: EtlRegisterWorkInput,
  ownedWorkId?: string,
  options?: RegisterWorkInDbOptions,
): Promise<void> {
  const prisma = await getPrismaClient();
  const date_created = formatDate();
  const versionTag = input.version_tag?.trim();
  const submissionTags = versionTag ? [versionTag] : [];
  const datePublished = input.date ?? null;
  const workVersionMetadata = buildWorkVersionMetadata(input);
  const venueKey = input.site.trim();
  const contains = input.contains?.length
    ? Array.from(new Set(input.contains))
    : input.source
      ? [input.source]
      : [WorkContents.MYST];
  const cdn = input.cdn.endsWith('/') ? input.cdn : `${input.cdn}/`;

  const existingWorkId = ownedWorkId ?? (await findOwnedWorkIdByDoi(auth.userId, input.doi));

  await prisma.$transaction(async (tx) => {
    const supersededSubmissionVersionIds =
      options?.allowRetagging && versionTag && existingWorkId
        ? await findTaggedSubmissionVersionIds(tx, siteId, existingWorkId, versionTag)
        : [];
    const supersedesSubmissionVersionId = supersededSubmissionVersionIds[0];
    const submissionMetadataForCreate = supersedesSubmissionVersionId
      ? buildSubmissionMetadataWithSupersedes(
          input.submission_metadata,
          venueKey,
          supersedesSubmissionVersionId,
        )
      : input.submission_metadata;

    let workId: string;
    let workVersionId: string;

    const versionData = {
      title: input.title,
      description: input.description ?? null,
      authors: input.authors ?? [],
      author_details: (input.author_details ?? []) as Prisma.InputJsonValue[],
      date: input.date ?? null,
      doi: input.doi,
      cdn,
      cdn_key: input.cdn_key,
      metadata: workVersionMetadata as Prisma.InputJsonValue | undefined,
    };

    if (existingWorkId) {
      workId = existingWorkId;
      workVersionId = uuid();
      await tx.work.update({
        where: { id: workId },
        data: {
          date_modified: date_created,
          doi: input.doi,
          contains: { set: contains },
          versions: {
            create: [
              {
                id: workVersionId,
                date_created,
                date_modified: date_created,
                ...versionData,
              },
            ],
          },
        },
        select: { id: true },
      });
      await tx.activity.create({
        data: {
          id: uuid(),
          date_created,
          date_modified: date_created,
          activity_type: ActivityType.WORK_VERSION_ADDED,
          activity_by: { connect: { id: auth.userId } },
          work: { connect: { id: workId } },
          work_version: { connect: { id: workVersionId } },
        },
        select: { id: true },
      });
    } else {
      workId = uuid();
      workVersionId = uuid();
      await tx.work.create({
        data: {
          id: workId,
          date_created,
          date_modified: date_created,
          contains,
          doi: input.doi,
          created_by: { connect: { id: auth.userId } },
          versions: {
            create: [
              {
                id: workVersionId,
                date_created,
                date_modified: date_created,
                ...versionData,
              },
            ],
          },
          work_users: {
            create: [
              {
                id: uuid(),
                date_created,
                date_modified: date_created,
                role: WorkRole.OWNER,
                user: { connect: { id: auth.userId } },
              },
            ],
          },
        },
        select: { id: true },
      });
      await tx.activity.create({
        data: {
          id: uuid(),
          date_created,
          date_modified: date_created,
          activity_type: ActivityType.NEW_WORK,
          activity_by: { connect: { id: auth.userId } },
          work: { connect: { id: workId } },
          work_version: { connect: { id: workVersionId } },
        },
        select: { id: true },
      });
    }

    const existingSubmission = await tx.submission.findFirst({
      where: {
        site_id: siteId,
        work_id: workId,
      },
      select: { id: true, date_published: true },
    });

    if (existingSubmission) {
      const svId = uuid();
      await tx.submissionVersion.create({
        data: {
          id: svId,
          date_created,
          date_modified: date_created,
          status: 'PUBLISHED',
          date_published: datePublished,
          tags: submissionTags,
          metadata: submissionMetadataForCreate as Prisma.InputJsonValue | undefined,
          submitted_by: { connect: { id: auth.userId } },
          work_version: { connect: { id: workVersionId } },
          submission: { connect: { id: existingSubmission.id } },
        },
        select: { id: true },
      });
      if (supersededSubmissionVersionIds.length > 0) {
        await markSubmissionVersionsSuperseded(
          tx,
          supersededSubmissionVersionIds,
          versionTag!,
          svId,
          date_created,
          venueKey,
        );
      }
      await tx.activity.create({
        data: {
          id: uuid(),
          date_created,
          date_modified: date_created,
          activity_type: ActivityType.SUBMISSION_VERSION_ADDED,
          activity_by: { connect: { id: auth.userId } },
          submission: { connect: { id: existingSubmission.id } },
          submission_version: { connect: { id: svId } },
          status: 'PUBLISHED',
          date_published: datePublished,
          work_version: { connect: { id: workVersionId } },
        },
        select: { id: true },
      });
      const submissionDatePublished = laterPublishedDate(
        existingSubmission.date_published,
        datePublished,
      );
      await tx.submission.update({
        where: { id: existingSubmission.id },
        data: {
          date_modified: date_created,
          ...(submissionDatePublished !== null &&
          submissionDatePublished !== existingSubmission.date_published
            ? { date_published: submissionDatePublished }
            : {}),
        },
        select: { id: true },
      });
    } else {
      const submissionId = uuid();
      const svId = uuid();
      await tx.submissionVersion.create({
        data: {
          id: svId,
          date_created,
          date_modified: date_created,
          status: 'PUBLISHED',
          date_published: datePublished,
          tags: submissionTags,
          metadata: submissionMetadataForCreate as Prisma.InputJsonValue | undefined,
          submitted_by: { connect: { id: auth.userId } },
          work_version: { connect: { id: workVersionId } },
          submission: {
            create: {
              id: submissionId,
              date_created,
              date_modified: date_created,
              date_published: datePublished,
              submitted_by: { connect: { id: auth.userId } },
              kind: kindConnect(siteId, kindName),
              collection: collectionConnect(siteId, collectionName),
              site: { connect: { id: siteId } },
              work: { connect: { id: workId } },
            },
          },
        },
        select: { id: true },
      });
      await tx.activity.create({
        data: {
          id: uuid(),
          date_created,
          date_modified: date_created,
          activity_type: ActivityType.NEW_SUBMISSION,
          activity_by: { connect: { id: auth.userId } },
          submission: { connect: { id: submissionId } },
          submission_version: { connect: { id: svId } },
          status: 'PUBLISHED',
          date_published: datePublished,
          work_version: { connect: { id: workVersionId } },
          kind: kindConnect(siteId, kindName),
        },
        select: { id: true },
      });
    }
  });
}

export async function etlRegisterWork(
  request: Request,
  input: EtlRegisterWorkInput,
): Promise<EtlRegisterWorkResult> {
  const { auth, site } = await authorizeEtlSite(request, input.site);

  const collectionName = input.collection?.trim() || 'articles';
  const kindName = input.kind?.trim() || 'article';

  const ownedWorkId = await findOwnedWorkIdByDoi(auth.userId, input.doi);
  const versionTag = input.version_tag?.trim();
  const articleCdnPrefix = input.article_cdn_prefix?.trim();

  const tagged =
    versionTag && ownedWorkId
      ? await findTaggedSubmissionVersion(site.id, ownedWorkId, versionTag)
      : undefined;
  const workAlreadyHasIncomingCdnKey = ownedWorkId
    ? await workHasVersionWithCdnKey(ownedWorkId, input.cdn_key.trim())
    : false;

  const decision = resolveEtlRegisterDecision({
    versionTag,
    articleCdnPrefix,
    taggedCdnKey: tagged?.cdn_key ?? undefined,
    allowRetagging: input.allow_retagging === true,
    workAlreadyHasIncomingCdnKey,
  });

  if (decision.action === 'skip') {
    return { status: 'skipped' };
  }

  await registerWorkInDb(auth, site.id, collectionName, kindName, input, ownedWorkId, {
    allowRetagging: input.allow_retagging === true,
  });
  return { status: 'created' };
}

export async function etlRegisterWorkFromRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') throw httpError(405, 'Method Not Allowed');
  // early token validation
  const userId = await verifyEtlBearerUserId(request);
  if (!userId) throw httpError(401, 'Unauthorized');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw httpError(400, 'Invalid JSON body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Expected JSON object body');
  }

  const raw = body as Record<string, unknown>;
  const site = typeof raw.site === 'string' ? raw.site.trim() : '';
  const doi = typeof raw.doi === 'string' ? raw.doi.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const cdn = typeof raw.cdn === 'string' ? raw.cdn.trim() : '';
  const cdn_key = typeof raw.cdn_key === 'string' ? raw.cdn_key.trim() : '';
  if (!site) throw httpError(400, 'site is required');
  if (!doi) throw httpError(400, 'doi is required');
  if (!title) throw httpError(400, 'title is required');
  if (!cdn || !cdn_key) throw httpError(400, 'cdn and cdn_key are required');

  const allowRetagging = raw.allow_retagging === true;
  const article_cdn_prefix =
    typeof raw.article_cdn_prefix === 'string' ? raw.article_cdn_prefix.trim() : '';
  if (allowRetagging && !article_cdn_prefix) {
    throw httpError(400, 'article_cdn_prefix is required when allow_retagging is true');
  }

  const input: EtlRegisterWorkInput = {
    site,
    doi,
    title,
    cdn,
    cdn_key,
    article_cdn_prefix: article_cdn_prefix || undefined,
    collection: typeof raw.collection === 'string' ? raw.collection : undefined,
    kind: typeof raw.kind === 'string' ? raw.kind : undefined,
    version_tag: typeof raw.version_tag === 'string' ? raw.version_tag : undefined,
    allow_retagging: allowRetagging,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    contains: Array.isArray(raw.contains)
      ? raw.contains.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    authors: Array.isArray(raw.authors)
      ? raw.authors.filter((a): a is string => typeof a === 'string')
      : undefined,
    author_details: Array.isArray(raw.author_details)
      ? (raw.author_details as Record<string, unknown>[])
      : undefined,
    date: typeof raw.date === 'string' ? raw.date : undefined,
    myst_metadata:
      raw.myst_metadata &&
      typeof raw.myst_metadata === 'object' &&
      !Array.isArray(raw.myst_metadata)
        ? (raw.myst_metadata as Record<string, unknown>)
        : undefined,
    work_metadata:
      raw.work_metadata &&
      typeof raw.work_metadata === 'object' &&
      !Array.isArray(raw.work_metadata)
        ? (raw.work_metadata as Record<string, unknown>)
        : undefined,
    submission_metadata:
      raw.submission_metadata &&
      typeof raw.submission_metadata === 'object' &&
      !Array.isArray(raw.submission_metadata)
        ? (raw.submission_metadata as Record<string, unknown>)
        : undefined,
  };

  const result = await etlRegisterWork(request, input);
  if (result.status === 'skipped') {
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 201 });
}
