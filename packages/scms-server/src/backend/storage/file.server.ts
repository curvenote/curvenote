/* eslint-disable max-classes-per-file */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-cycle */
import { Readable } from 'stream';
import { httpError } from '@curvenote/scms-core';
import type { StorageBackend } from './backend.server.js';
import { KnownBuckets } from './constants.server.js';
import type { FileMetadata, SignedUploadResult } from '../../modules/storage/types.js';

export type Metadata = FileMetadata;

export interface IFileObject {
  get id(): string;
  writeString(data: string, contentType: string): Promise<void>;
  writeBase64(data: string, contentType?: string): Promise<void>;
  setContentType(contentType: string): Promise<Metadata>;
  url(): Promise<string>;
  exists(): Promise<boolean>;
}

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

  /**
   *
   * @param prefix
   * @returns realtive path of the file, including a leading slash
   */
  relativePath(prefix: string) {
    return this.id.replace(new RegExp(`^${prefix}`), '');
  }

  async exists(): Promise<boolean> {
    return this.backend.provider.exists(this.bucket, this.id);
  }

  async assertExists(): Promise<void> {
    const exists = await this.exists();
    if (!exists) throw httpError(422, `File not present at this storage location: ${this.id}`);
  }

  async metadata(): Promise<Metadata> {
    await this.assertExists();
    return this.backend.provider.getMetadata(this.bucket, this.id);
  }

  async setContentType(contentType: string): Promise<Metadata> {
    return this.backend.provider.setMetadata(this.bucket, this.id, { contentType });
  }

  async copy(newPath: string, bucket?: KnownBuckets): Promise<File> {
    return this.move(newPath, bucket, { copy: true });
  }

  async move(newPath: string, bucket?: KnownBuckets, opts?: { copy?: boolean }): Promise<File> {
    const nextBucket = bucket ?? this.bucket;
    await this.assertExists();
    this.backend.ensureConnection(nextBucket);
    if (opts?.copy) {
      await this.backend.provider.copy(this.bucket, this.id, nextBucket, newPath);
    } else {
      await this.backend.provider.move(this.bucket, this.id, nextBucket, newPath);
    }
    const newFile = new File(this.backend, newPath, nextBucket);
    return newFile;
  }

  async url() {
    return this.sign();
  }

  async sign(): Promise<string> {
    await this.assertExists();
    return this.backend.provider.signReadUrl(this.bucket, this.id, this.backend.expiry.read);
  }

  /**
   * Generate a signed upload URL with protocol info.
   *
   * For GCS: returns a resumable upload URL (protocol: 'gcs-resumable')
   * For Azure: returns a SAS URL (protocol: 'put')
   * For S3: returns a presigned PUT URL (protocol: 'put')
   */
  async signUpload(data: { content_type: string }): Promise<SignedUploadResult> {
    return this.backend.provider.signUploadUrl(
      this.bucket,
      this.id,
      data.content_type,
      this.backend.expiry.write,
    );
  }

  /**
   * @deprecated Use signUpload() instead. Kept for backwards compatibility.
   * Returns just the URL string (loses protocol info).
   */
  async signResumableUpload(data: { content_type: string }): Promise<string> {
    const result = await this.signUpload(data);
    return result.url;
  }

  async download(): Promise<Buffer> {
    await this.assertExists();
    return this.backend.provider.download(this.bucket, this.id);
  }

  async readStream() {
    await this.assertExists();
    return this.backend.provider.createReadStream(this.bucket, this.id);
  }

  async writeString(fullData: string, contentType: string): Promise<void> {
    const stream = Readable.from([fullData]);
    await this.backend.provider.writeStream(this.bucket, this.id, stream, contentType);
  }

  async writeBase64(fullData: string, contentType?: string): Promise<void> {
    const [header, data] = fullData.split(';base64,');
    const buffer = Buffer.from(data, 'base64');
    const ct = header.replace('data:', '') ?? contentType;
    await this.backend.provider.writeBuffer(this.bucket, this.id, buffer, ct);
  }

  async writeStream(stream: Readable, contentType: string): Promise<void> {
    await this.backend.provider.writeStream(this.bucket, this.id, stream, contentType);
  }

  async writeArrayBuffer(buffer: ArrayBuffer, contentType: string) {
    await this.backend.provider.writeBuffer(this.bucket, this.id, Buffer.from(buffer), contentType);
  }

  async delete() {
    if (await this.exists()) {
      await this.backend.provider.delete(this.bucket, this.id);
    }
  }

  async makePublic() {
    await this.backend.provider.makePublic(this.bucket, this.id);
  }

  async setCustomTime(): Promise<Metadata> {
    return this.backend.provider.setMetadata(this.bucket, this.id, {
      customTime: new Date().toISOString(),
    });
  }
}
