import type { Route } from './+types/v1.works';
import { error405, httpError } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  CreateMystWorkPostBodySchema,
  validate,
  withAPISecureContext,
  works,
  getPrismaClient,
} from '@curvenote/scms-server';

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
