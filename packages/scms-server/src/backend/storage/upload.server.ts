import { File } from './file.server.js';
import { KnownBuckets } from './constants.server.js';
import type { StorageBackend } from './backend.server.js';
import type { Context } from '../context.server.js';
import { httpError } from '@curvenote/scms-core';

export function splitUploadPathOrUrl(thePath: string) {
  const match = thePath.match(/.*(uploads)\/([A-Za-z0-9]+)\/([A-Za-z0-9-]+)/);
  if (match == null) return [];
  return match.slice(1);
}

export class Upload extends File {
  constructor(ctx: Context, backend: StorageBackend, id: string) {
    super(backend, id, KnownBuckets.staging);
    if (!ctx.user) throw httpError(401, 'Only authenticated users can upload files.');
    const [pathFolder, pathUser, pathId] = splitUploadPathOrUrl(id);
    const correctPath = pathUser === ctx.user?.id && pathId.length === 36;
    if (!correctPath)
      throw httpError(422, 'Path for upload is not correct, it must be in your folder.');
    this.id = `${pathFolder}/${pathUser}/${pathId}`;
  }

  async signAsWritable(contentType: string): Promise<string> {
    const [url] = await this.backend.buckets.main.file(this.id).getSignedUrl({
      action: 'write',
      expires: Date.now() + 1000 * this.backend.expiry.write,
      contentType,
    });
    return url;
  }
}
