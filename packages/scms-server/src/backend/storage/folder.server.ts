import { httpError } from '@curvenote/scms-core';
import { KnownBuckets } from './constants.server.js';
import type { StorageBackend } from './backend.server.js';
import { File } from './file.server.js';
import pLimit from 'p-limit';
import { createHash } from 'node:crypto';

export class Folder {
  backend: StorageBackend;

  id: string;

  bucket: KnownBuckets;

  constructor(backend: StorageBackend, id: string, bucket = KnownBuckets.tmp) {
    this.backend = backend;
    this.backend.ensureConnection(bucket);
    if (id == null) throw httpError(422, 'Folder not present at this storage location');
    this.id = id;
    this.bucket = bucket;
  }

  get $bucket() {
    return this.backend.buckets[this.bucket];
  }

  async exists(): Promise<boolean> {
    const [files] = await this.$bucket.getFiles({
      prefix: this.id,
      maxResults: 1,
    });
    return files.length > 0;
  }

  async isFolder(): Promise<boolean> {
    const [metadata] = await this.$bucket.file(this.id).getMetadata();
    return metadata.contentType === 'application/x-directory';
  }

  async contents(opts: { recursive: boolean } = { recursive: true }): Promise<string[]> {
    const [files] = await this.$bucket.getFiles({
      prefix: this.id,
      delimiter: opts?.recursive ? '' : '/',
    });

    return files.map((file) => file.name);
  }

  async listFiles(): Promise<File[]> {
    const [files] = await this.$bucket.getFiles({
      prefix: this.id,
      autoPaginate: false,
    });

    return files.map((googleFile) => new File(this.backend, googleFile.name, this.bucket));
  }

  async copy(to: { bucket: KnownBuckets; path?: string }): Promise<void> {
    this.backend.ensureConnection(to.bucket);
    const files = await this.listFiles();
    const root = (to.path ?? this.id).replace(/\/$/g, '');
    const limit = pLimit(this.backend.concurrency);
    await Promise.all(
      files.map(async (file) =>
        limit(async () => {
          const newPath = `${root}${file.relativePath(this.id.replace(/\/$/g, ''))}`;
          return file.copy(newPath, to.bucket);
        }),
      ),
    );
  }

  async move(to: { bucket: KnownBuckets; path?: string }): Promise<void> {
    this.backend.ensureConnection(to.bucket);
    const files = await this.listFiles();
    const root = (to.path ?? this.id).replace(/\/$/g, '');
    const limit = pLimit(this.backend.concurrency);
    await Promise.all(
      files.map((file) =>
        limit(async () => {
          const newPath = `${root}${file.relativePath(this.id.replace(/\/$/g, ''))}`;
          return file.move(newPath, to.bucket);
        }),
      ),
    );
  }

  async delete(): Promise<void> {
    const files = await this.listFiles();
    const limit = pLimit(this.backend.concurrency);
    await Promise.all(
      files.map((file) =>
        limit(async () => {
          return file.delete();
        }),
      ),
    );
  }

  async md5(): Promise<string> {
    const files = await this.listFiles();
    const limit = pLimit(this.backend.concurrency);
    const hashes = await Promise.all(
      files.map(async (file) =>
        limit(async () => {
          const metadata = await file.metadata();
          return metadata.md5Hash;
        }),
      ),
    );
    const hash = createHash('md5').update(hashes.join('')).digest('hex');
    return hash;
  }
}
