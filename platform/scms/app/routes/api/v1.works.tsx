import type { Route } from './+types/v1.works';
import { z } from 'zod';
import { error401, error405, httpError, isMystCdnContentSource } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  works,
  getPrismaClient,
} from '@curvenote/scms-server';
import { formatDate, setTagsOnMetadata } from '@curvenote/common';
import { ActivityType, WorkRole } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';

export const CreateMystWorkPostBodySchema = z.object({
  cdn: z.url({
    error: (issue) => (issue.input === undefined ? 'cdn is required (url)' : undefined),
  }),
  cdn_key: z
    .string({
      error: (issue) => (issue.input === undefined ? 'cdn_key is required (string)' : undefined),
    })
    .min(1, { error: 'cdn_key must be a non-empty string' }),
  key: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'key is required ([a-zA-Z][a-zA-Z0-9_-])' : undefined,
    })
    .min(8, { error: 'key must be at least 8 characters' })
    .max(128, { error: 'key must be less than 128 characters' })
    .regex(/[a-zA-Z][a-zA-Z0-9_-]{7,127}/)
    .optional(),
});

export const CreateWorkPostBodySchema = z
  .object({
    cdn: z.url().optional(),
    cdn_key: z.string().min(1).optional(),
    key: z
      .string()
      .min(8, { error: 'key must be at least 8 characters' })
      .max(128, { error: 'key must be less than 128 characters' })
      .regex(/[a-zA-Z][a-zA-Z0-9_-]{7,127}/)
      .optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    authors: z.array(z.string()).optional(),
    author_details: z.array(z.record(z.string(), z.any())).optional(),
    date: z.string().optional(),
    doi: z.string().max(255).optional(),
    canonical: z.boolean().optional(),
    contains: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string().min(1).max(255)).max(64).optional(),
  })
  .superRefine((body, ctx) => {
    const hasCdnPair = !!body.cdn && !!body.cdn_key;
    const hasOnlyOneCdnField = (!!body.cdn && !body.cdn_key) || (!body.cdn && !!body.cdn_key);
    if (hasOnlyOneCdnField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cdn and cdn_key must be provided together',
      });
    }
    if (!hasCdnPair && !body.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'title is required when cdn/cdn_key are not provided',
      });
    }
  });

export async function loader() {
  throw error405();
}

async function dbCreateManualWorkAndVersion(
  userId: string,
  data: {
    title: string;
    description?: string;
    authors?: string[];
    author_details?: Record<string, any>[];
    date?: string;
    doi?: string;
    canonical?: boolean;
    cdn?: string;
    cdn_key?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  },
  key?: string,
  contains: string[] = [],
) {
  const date_created = formatDate();
  const workId = uuid();
  const workVersionId = uuid();
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const work = await tx.work.create({
      data: {
        id: workId,
        key,
        date_created,
        date_modified: date_created,
        contains,
        doi: data.doi ?? null,
        created_by: { connect: { id: userId } },
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              title: data.title,
              description: data.description ?? null,
              authors: data.authors ?? [],
              author_details: data.author_details,
              date: data.date ?? null,
              doi: data.doi ?? null,
              canonical: data.canonical ?? null,
              cdn: data.cdn ?? null,
              cdn_key: data.cdn_key ?? null,
              metadata: setTagsOnMetadata(data.metadata, data.tags) ?? undefined,
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
              user: { connect: { id: userId } },
            },
          ],
        },
      },
    });
    const version = await tx.workVersion.findUniqueOrThrow({ where: { id: workVersionId } });
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_type: ActivityType.NEW_WORK,
        activity_by: { connect: { id: userId } },
        work: { connect: { id: workId } },
        work_version: { connect: { id: workVersionId } },
      },
    });
    return { work, version };
  });
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);

  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const { cdn, cdn_key, key, contains, ...metadata } = validate(CreateWorkPostBodySchema, body);
  if (key) {
    const prisma = await getPrismaClient();
    const count = await prisma.work.count({ where: { key } });
    if (count !== 0) {
      throw httpError(400, `key is unavailable: ${key}`);
    }
  }
  let dto;
  const loadMystFromCdn = !!cdn && !!cdn_key && isMystCdnContentSource(contains);
  if (loadMystFromCdn) {
    dto = await works.create(ctx, cdn, cdn_key, key);
  } else {
    if (!ctx.user) throw error401();
    const work = await dbCreateManualWorkAndVersion(
      ctx.user.id,
      { ...metadata, title: metadata.title ?? 'Untitled', cdn, cdn_key },
      key,
      contains,
    );
    dto = works.formatWorkDTO(ctx, work.work, work.version);
  }
  return Response.json(dto, { status: 201 });
}
