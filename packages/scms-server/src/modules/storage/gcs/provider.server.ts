import type { Bucket } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import type { Readable } from 'stream';
import type { IStorageProvider } from '../provider.interface.js';
import type { FileMetadata, GcsStorageConfig, SignedUploadResult } from '../types.js';

type GcsKeyFile = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
};

export class GcsStorageProvider implements IStorageProvider {
  readonly type = 'gcs' as const;

  private keyfile: GcsKeyFile;
  private buckets: Map<string, Bucket> = new Map();
  private bucketUriMap: Record<string, string>;

  constructor(config: GcsStorageConfig, bucketUriMap: Record<string, string>) {
    this.keyfile = JSON.parse(config.secretKeyfile);
    this.bucketUriMap = bucketUriMap;
  }

  private getBucketUri(logicalName: string): string {
    return this.bucketUriMap[logicalName] ?? logicalName;
  }

  private getBucket(logicalName: string): Bucket {
    const bucket = this.buckets.get(logicalName);
    if (!bucket) {
      throw new Error(`Bucket not initialized: ${logicalName}. Call ensureBucket() first.`);
    }
    return bucket;
  }

  ensureBucket(logicalName: string): void {
    if (!this.buckets.has(logicalName)) {
      const uri = this.getBucketUri(logicalName);
      const storage = new Storage({
        credentials: this.keyfile,
        projectId: this.keyfile.project_id,
      });
      this.buckets.set(logicalName, storage.bucket(uri));
    }
  }

  // ── File existence & metadata ──────────────────────────────

  async exists(bucket: string, key: string): Promise<boolean> {
    const [exists] = await this.getBucket(bucket).file(key).exists();
    return exists;
  }

  async getMetadata(bucket: string, key: string): Promise<FileMetadata> {
    const [metadata] = await this.getBucket(bucket).file(key).getMetadata();
    return this.normalizeMetadata(metadata, key);
  }

  async setMetadata(
    bucket: string,
    key: string,
    meta: { contentType?: string; customTime?: string; metadata?: Record<string, string> },
  ): Promise<FileMetadata> {
    const gcsMeta: Record<string, any> = {};
    if (meta.contentType) gcsMeta.contentType = meta.contentType;
    if (meta.customTime) gcsMeta.customTime = meta.customTime;
    if (meta.metadata) gcsMeta.metadata = meta.metadata;
    const [metadata] = await this.getBucket(bucket).file(key).setMetadata(gcsMeta);
    return this.normalizeMetadata(metadata, key);
  }

  // ── Signed URLs ────────────────────────────────────────────

  async signReadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const [url] = await this.getBucket(bucket)
      .file(key)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * expiresInSeconds,
      });
    return url;
  }

  async signUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadResult> {
    const [url] = await this.getBucket(bucket)
      .file(key)
      .getSignedUrl({
        version: 'v4',
        action: 'resumable',
        contentType,
        expires: Date.now() + 1000 * expiresInSeconds,
      });
    return {
      url,
      protocol: 'gcs-resumable',
    };
  }

  // ── Data transfer ──────────────────────────────────────────

  async download(bucket: string, key: string): Promise<Buffer> {
    const [buffer] = await this.getBucket(bucket).file(key).download();
    return buffer;
  }

  async createReadStream(bucket: string, key: string): Promise<Readable> {
    return this.getBucket(bucket).file(key).createReadStream();
  }

  async writeStream(
    bucket: string,
    key: string,
    stream: Readable,
    contentType: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = this.getBucket(bucket).file(key);
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

  async writeBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const file = this.getBucket(bucket).file(key);
    await file.save(buffer, { contentType });
  }

  // ── Object operations ──────────────────────────────────────

  async copy(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void> {
    const from = this.getBucket(fromBucket).file(fromKey);
    const to = this.getBucket(toBucket).file(toKey);
    await from.copy(to);
  }

  async move(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void> {
    const from = this.getBucket(fromBucket).file(fromKey);
    const to = this.getBucket(toBucket).file(toKey);
    await from.move(to);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.getBucket(bucket).file(key).delete();
  }

  async makePublic(bucket: string, key: string): Promise<void> {
    await this.getBucket(bucket).file(key).makePublic();
  }

  // ── Listing ────────────────────────────────────────────────

  async listObjects(
    bucket: string,
    prefix: string,
    opts?: { delimiter?: string; maxResults?: number },
  ): Promise<string[]> {
    const [files] = await this.getBucket(bucket).getFiles({
      prefix,
      delimiter: opts?.delimiter,
      maxResults: opts?.maxResults,
      autoPaginate: false,
    });
    return files.map((file) => file.name);
  }

  // ── Admin ──────────────────────────────────────────────────

  consoleUrl(bucketUri: string, key: string): string {
    return `https://console.cloud.google.com/storage/browser/${bucketUri}/${key}`;
  }

  // ── Helpers ────────────────────────────────────────────────

  private normalizeMetadata(metadata: any, key: string): FileMetadata {
    return {
      name: metadata.name ?? key,
      size: Number.parseInt(String(metadata.size ?? '0'), 10),
      etag: metadata.etag ?? '',
      md5Hash: metadata.md5Hash ?? '',
      contentType: metadata.contentType ?? '',
      bucket: metadata.bucket ?? '',
      metadata: metadata.metadata ?? {},
    };
  }
}
