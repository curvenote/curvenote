import type { Route } from './+types/v1.uploads.commit';
import { z } from 'zod';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  KnownBuckets,
  StorageBackend,
  File,
} from '@curvenote/scms-server';
import { httpError } from '@curvenote/scms-core';

const UploadCommitPostBodySchema = z.object({
  cdn: z.url(),
  cdnKey: z.uuid(),
  files: z.array(
    z.object({
      path: z.string(),
      content_type: z.string(),
      md5: z.string(),
      size: z.number(),
    }),
  ),
});
import pLimit from 'p-limit';

export const config = { maxDuration: 300 };

export async function loader(args: Route.LoaderArgs) {
  await withAPISecureContext(args);
  return Response.json({
    message: '🚀 Deployment Facility for Curvenote Sites 📚',
  });
}

function stripKey(id: string, path: string) {
  return path.replace(new RegExp(`^/?${id}/`), '').replace(/^\//, '');
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const data = validate(UploadCommitPostBodySchema, body);

  const backend = new StorageBackend(ctx, [KnownBuckets.hashstore]);

  // no rate limiting here, as we are just creating js objects, no calls
  const files = data.files.map((info) => {
    return {
      file: new File(backend, `${ctx.user?.id}/${info.md5}`, KnownBuckets.hashstore),
      info,
    };
  });

  console.info(`Committing ${files.length} files`);

  const limit = pLimit(backend.concurrency);
  const missing = (
    await Promise.all(
      files.map(async ({ file, info }) =>
        limit(async () => {
          let exists = false;
          try {
            exists = await file.exists();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_e) {
            exists = await file.exists();
          }
          if (!exists) return info; // return info on missing files
          return null;
        }),
      ),
    )
  ).filter((f) => f != null);

  if (missing.length > 0) {
    throw httpError(422, `Missing staged uploads: ${missing.map((f) => f?.path).join(', ')}`, {
      missing,
    });
  }

  const failed = (
    await Promise.all(
      files.map(async ({ file, info }) =>
        limit(async () => {
          const destination = `${data.cdnKey}/${stripKey(data.cdnKey, info.path)}`;
          try {
            await file.copy(destination, backend.knownBucketFromCDN(data.cdn));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_e) {
            try {
              await file.copy(destination, backend.knownBucketFromCDN(data.cdn));
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (__e) {
              return info;
            }
          }
          return null;
        }),
      ),
    )
  ).filter((f) => f != null);

  let message = `${files.length} files deployed to ${data.cdn}/${data.cdnKey}`;
  if (failed.length > 0) {
    console.error(`Failed to deploy ${failed.length} files`, { failed });
    message += `; ${failed.length} files failed to deploy.`;
  }

  return Response.json({ message });
}
