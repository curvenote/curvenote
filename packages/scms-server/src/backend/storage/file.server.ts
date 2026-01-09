/* eslint-disable max-classes-per-file */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-cycle */
import { Readable } from 'stream';
import { httpError } from '@curvenote/scms-core';
import type { StorageBackend } from './backend.server.js';
import { KnownBuckets } from './constants.server.js';

export interface IFileObject {
  get id(): string;
  writeString(data: string, contentType: string): Promise<void>;
  writeBase64(data: string, contentType?: string): Promise<void>;
  setContentType(contentType: string): Promise<Metadata>;
  url(): Promise<string>;
  exists(): Promise<boolean>;
}

export type Metadata = {
  name: string;
  size: number; // This is transformed on the response
  etag: string;
  md5Hash: string;
  contentType: string;
  bucket: string;
  metadata: Record<string, string>;
};

export class File implements IFileObject {
  backend: StorageBackend;
  id: string;
  bucket: KnownBuckets;

  static new(backend: StorageBackend, id: string, bucket = KnownBuckets.tmp) {
    return new File(backend, id, bucket);
  }

  constructor(backend: StorageBackend, id: string, bucket = KnownBuckets.tmp) {
    this.backend = backend;
    this.backend.ensureConnection(bucket);
    this.id = id;
    this.bucket = bucket;
  }

  get $bucket() {
    return this.backend.buckets[this.bucket];
  }

  /**
   *
   * @param prefix
   * @returns realtive path of the file, including a leading slash
   */
  relativePath(prefix: string) {
    return this.id.replace(new RegExp(`^${prefix}`), '');
  }

  async exists(): Promise<boolean> {
    const [exists] = await this.$bucket.file(this.id).exists();
    return exists;
  }

  async assertExists(): Promise<void> {
    const exists = await this.exists();
    if (!exists) throw httpError(422, `File not present at this storage location: ${this.id}`);
  }

  private normalizeMetadata(metadata: any): Metadata {
    metadata.size = Number.parseInt(String(metadata.size ?? '0'), 10);
    if (!metadata.name) metadata.name = this.id;
    return metadata as Metadata;
  }

  async metadata(): Promise<Metadata> {
    await this.assertExists();
    const [metadata] = await this.$bucket.file(this.id).getMetadata();
    return this.normalizeMetadata(metadata);
  }

  async setContentType(contentType: string): Promise<Metadata> {
    const [metadata] = await this.$bucket.file(this.id).setMetadata({
      contentType,
    });
    return this.normalizeMetadata(metadata);
  }

  async copy(newPath: string, bucket?: KnownBuckets): Promise<File> {
    return this.move(newPath, bucket, { copy: true });
  }

  async move(newPath: string, bucket?: KnownBuckets, opts?: { copy?: boolean }): Promise<File> {
    const nextBucket = bucket ?? this.bucket;
    await this.assertExists();
    this.backend.ensureConnection(nextBucket);
    const next = new File(this.backend, newPath, nextBucket);
    const from = this.$bucket.file(this.id);
    const to = next.$bucket.file(next.id);
    if (opts?.copy) await from.copy(to);
    else await from.move(to);
    const newFile = new File(this.backend, newPath, nextBucket);
    return newFile;
  }

  async url() {
    return this.sign();
  }

  async sign(): Promise<string> {
    await this.assertExists();
    const [url] = await this.$bucket.file(this.id).getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * this.backend.expiry.read,
    });
    return url;
  }

  async signResumableUpload(data: { content_type: string }): Promise<string> {
    const [url] = await this.$bucket.file(this.id).getSignedUrl({
      version: 'v4',
      action: 'resumable',
      contentType: data.content_type,
      expires: Date.now() + 1000 * this.backend.expiry.write, // 30 mins
    });
    return url;
  }

  async download(): Promise<Buffer> {
    await this.assertExists();
    const file = this.$bucket.file(this.id);
    const [buffer] = await file.download();
    return buffer;
  }

  async readStream() {
    await this.assertExists();
    const file = this.$bucket.file(this.id);
    return file.createReadStream();
  }

  async writeString(fullData: string, contentType: string): Promise<void> {
    const stream = Readable.from([fullData]);
    await this._asPromised(stream, contentType);
  }

  async writeBase64(fullData: string, contentType?: string): Promise<void> {
    const [header, data] = fullData.split(';base64,');
    const buffer = Buffer.from(data, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    await this._asPromised(stream, header.replace('data:', '') ?? contentType);
  }

  async writeStream(stream: Readable, contentType: string): Promise<void> {
    await this._asPromised(stream, contentType);
  }

  async writeArrayBuffer(buffer: ArrayBuffer, contentType: string) {
    const file = this.$bucket.file(this.id);
    await file.save(Buffer.from(buffer), { contentType });
  }

  async _asPromised(stream: Readable, contentType: string) {
    return new Promise((resolve, reject) => {
      const file = this.$bucket.file(this.id);
      stream
        .pipe(
          file.createWriteStream({
            metadata: { contentType },
          }),
        )
        .on('error', (err) => reject(err))
        .on('finish', () => resolve(undefined));
    });
  }

  async delete() {
    const file = this.$bucket.file(this.id);
    if (await this.exists()) await file.delete();
  }

  async makePublic() {
    await this.$bucket.file(this.id).makePublic();
  }

  async setCustomTime(): Promise<Metadata> {
    const [metadata] = await this.$bucket.file(this.id).setMetadata({
      customTime: new Date().toISOString(),
    });
    return this.normalizeMetadata(metadata);
  }
}
