import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectAclCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type { IStorageProvider } from '../provider.interface.js';
import type { FileMetadata, S3StorageConfig, SignedUploadResult } from '../types.js';

export class S3StorageProvider implements IStorageProvider {
  readonly type = 's3' as const;

  private client: S3Client;
  private region: string;
  private bucketUriMap: Record<string, string>;

  constructor(config: S3StorageConfig, bucketUriMap: Record<string, string>) {
    this.region = config.region;
    this.bucketUriMap = bucketUriMap;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private getBucketName(logicalName: string): string {
    return this.bucketUriMap[logicalName] ?? logicalName;
  }

  ensureBucket(logicalName: string): void {
    // S3 doesn't need pre-initialization — buckets are accessed by name.
    // The bucket URI map is already populated at construction time.
  }

  // ── File existence & metadata ──────────────────────────────

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.getBucketName(bucket),
          Key: key,
        }),
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getMetadata(bucket: string, key: string): Promise<FileMetadata> {
    const resp = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );
    return {
      name: key,
      size: resp.ContentLength ?? 0,
      etag: resp.ETag ?? '',
      md5Hash: resp.ETag ? resp.ETag.replace(/"/g, '') : '', // S3 ETag is often MD5 for non-multipart
      contentType: resp.ContentType ?? '',
      bucket: this.getBucketName(bucket),
      metadata: resp.Metadata ?? {},
    };
  }

  async setMetadata(
    bucket: string,
    key: string,
    meta: { contentType?: string; customTime?: string; metadata?: Record<string, string> },
  ): Promise<FileMetadata> {
    // S3 doesn't support updating metadata in-place — requires copy-to-self
    const bucketName = this.getBucketName(bucket);
    const existing = await this.getMetadata(bucket, key);

    const newMetadata: Record<string, string> = {
      ...existing.metadata,
      ...(meta.metadata ?? {}),
    };
    if (meta.customTime) {
      newMetadata['custom-time'] = meta.customTime;
    }

    await this.client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        Key: key,
        CopySource: `${bucketName}/${key}`,
        ContentType: meta.contentType ?? existing.contentType,
        Metadata: newMetadata,
        MetadataDirective: 'REPLACE',
      }),
    );

    return this.getMetadata(bucket, key);
  }

  // ── Signed URLs ────────────────────────────────────────────

  async signReadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async signUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      protocol: 'put',
      headers: { 'Content-Type': contentType },
    };
  }

  // ── Data transfer ──────────────────────────────────────────

  async download(bucket: string, key: string): Promise<Buffer> {
    const resp = await this.client.send(
      new GetObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );
    if (!resp.Body) throw new Error(`Failed to download object: ${bucket}/${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of resp.Body as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async createReadStream(bucket: string, key: string): Promise<Readable> {
    const resp = await this.client.send(
      new GetObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );
    if (!resp.Body) throw new Error(`Failed to create read stream: ${bucket}/${key}`);
    return resp.Body as unknown as Readable;
  }

  async writeStream(
    bucket: string,
    key: string,
    stream: Readable,
    contentType: string,
  ): Promise<void> {
    // Collect stream into buffer for S3 PutObject
    // For large files, S3 multipart upload would be better (deferred)
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    await this.writeBuffer(bucket, key, buffer, contentType);
  }

  async writeBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  // ── Object operations ──────────────────────────────────────

  async copy(
    fromBucket: string,
    fromKey: string,
    toBucket: string,
    toKey: string,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.getBucketName(toBucket),
        Key: toKey,
        CopySource: `${this.getBucketName(fromBucket)}/${fromKey}`,
      }),
    );
  }

  async move(
    fromBucket: string,
    fromKey: string,
    toBucket: string,
    toKey: string,
  ): Promise<void> {
    await this.copy(fromBucket, fromKey, toBucket, toKey);
    await this.delete(fromBucket, fromKey);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );
  }

  async makePublic(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectAclCommand({
          Bucket: this.getBucketName(bucket),
          Key: key,
          ACL: 'public-read',
        }),
      );
    } catch (err: any) {
      // Many S3 configurations block public ACLs.
      // If this fails, public access should be managed via bucket policy or CloudFront.
      if (err.name === 'AccessControlListNotSupported') {
        // Silently ignore — public access is managed at bucket/CDN level
        return;
      }
      throw err;
    }
  }

  // ── Listing ────────────────────────────────────────────────

  async listObjects(
    bucket: string,
    prefix: string,
    opts?: { delimiter?: string; maxResults?: number },
  ): Promise<string[]> {
    const resp = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.getBucketName(bucket),
        Prefix: prefix,
        Delimiter: opts?.delimiter || undefined,
        MaxKeys: opts?.maxResults,
      }),
    );
    return (resp.Contents ?? []).map((obj) => obj.Key!).filter(Boolean);
  }

  // ── Admin ──────────────────────────────────────────────────

  consoleUrl(bucketUri: string, key: string): string {
    return `https://s3.console.aws.amazon.com/s3/object/${bucketUri}?region=${this.region}&prefix=${encodeURIComponent(key)}`;
  }
}
