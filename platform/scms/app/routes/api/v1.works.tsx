import type { Route } from './+types/v1.works';
import { z } from 'zod';
import { error405, httpError } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  works,
  getPrismaClient,
} from '@curvenote/scms-server';

export const CreateMystWorkPostBodySchema = z.object({
  cdn: z.url({
    error: (issue) => (issue.input === undefined ? 'cdn is required (url)' : undefined),
  }),
  cdn_key: z.uuid({
    error: (issue) => (issue.input === undefined ? 'cdn_key is required (uuid)' : undefined),
  }),
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

export async function loader() {
  throw error405();
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);

  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const { cdn, cdn_key, key } = validate(CreateMystWorkPostBodySchema, body);
  if (key) {
    const prisma = await getPrismaClient();
    const count = await prisma.work.count({ where: { key } });
    if (count !== 0) {
      throw httpError(400, `key is unavailable: ${key}`);
    }
  }
  const dto = await works.create(ctx, cdn, cdn_key, key);
  return Response.json(dto, { status: 201 });
}
