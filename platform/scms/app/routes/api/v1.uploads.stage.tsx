import type { Route } from './+types/v1.uploads.stage';
import {
  ensureJsonBodyFromMethod,
  UploadStagePostBodySchema,
  validate,
  withAPISecureContext,
  KnownBuckets,
  StorageBackend,
  stageFilesForUpload,
  assertUserDefined,
} from '@curvenote/scms-server';

export const config = { maxDuration: 300 };

export async function loader(args: Route.LoaderArgs) {
  await withAPISecureContext(args);
  return Response.json({
    message: '🏗 Upload Facility for Curvenote Sites 📚',
  });
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const data = validate(UploadStagePostBodySchema, body);
  assertUserDefined(ctx.user);

  const backend = new StorageBackend(ctx, [KnownBuckets.hashstore]);
  const result = await stageFilesForUpload(backend, data.files, ctx.user.id!);

  return Response.json(result);
}
