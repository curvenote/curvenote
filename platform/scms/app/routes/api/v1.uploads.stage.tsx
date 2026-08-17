import { z } from 'zod';
import type { Route } from './+types/v1.uploads.stage';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  KnownBuckets,
  StorageBackend,
  stageFilesForUpload,
  assertUserDefined,
} from '@curvenote/scms-server';

const UploadStagePostBodySchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content_type: z.string(),
      md5: z.string(),
      size: z.number(),
    }),
  ),
});

export const config = { maxDuration: 300 };

export async function loader(args: Route.LoaderArgs) {
  await withAPISecureContext(args);
  return Response.json({
    message: '🏗 Upload Facility for Curvenote Sites 📚',
  });
}

export async function action(args: Route.ActionArgs) {
  // Handshake auth is already validated by withAPISecureContext (signature, issuer,
  // audience present, expiry). Do not gate on specific job audiences here — that would
  // couple core uploads to known core job types and break extension workers. TODO:
  // replace with handshake scopes / resource checks when available.
  const ctx = await withAPISecureContext(args);
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const data = validate(UploadStagePostBodySchema, body);
  assertUserDefined(ctx.user);

  const backend = new StorageBackend(ctx, [KnownBuckets.hashstore]);
  const result = await stageFilesForUpload(backend, data.files, ctx.user.id!);

  return Response.json(result);
}
