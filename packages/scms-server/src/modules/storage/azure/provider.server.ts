import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  type ContainerClient,
  type BlockBlobClient,
} from '@azure/storage-blob';
import type { Readable } from 'stream';
import type { IStorageProvider } from '../provider.interface.js';
import type { AzureStorageConfig, FileMetadata, SignedUploadResult } from '../types.js';

export class AzureStorageProvider implements IStorageProvider {
  readonly type = 'azure' as const;

  private serviceClient: BlobServiceClient;
  private credential: StorageSharedKeyCredential;
  private accountName: string;
  private containers: Map<string, ContainerClient> = new Map();
  private bucketUriMap: Record<string, string>;

  constructor(config: AzureStorageConfig, bucketUriMap: Record<string, string>) {
    this.bucketUriMap = bucketUriMap;

    if (config.connectionString) {
      this.serviceClient = BlobServiceClient.fromConnectionString(config.connectionString);
      // Extract account name and key from connection string for SAS generation
      const match = config.connectionString.match(/AccountName=([^;]+)/);
      const keyMatch = config.connectionString.match(/AccountKey=([^;]+)/);
      if (!match || !keyMatch) {
        throw new Error('Azure connection string must contain AccountName and AccountKey');
      }
      this.accountName = match[1];
      this.credential = new StorageSharedKeyCredential(match[1], keyMatch[1]);
    } else if (config.accountName && config.accountKey) {
      this.accountName = config.accountName;
      this.credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
      this.serviceClient = new BlobServiceClient(
        `https://${config.accountName}.blob.core.windows.net`,
        this.credential,
      );
    } else {
      throw new Error(
        'Azure storage config requires either connectionString or accountName + accountKey',
      );
    }
  }

  private getContainerName(logicalName: string): string {
    return this.bucketUriMap[logicalName] ?? logicalName;
  }

  private getContainer(logicalName: string): ContainerClient {
    const client = this.containers.get(logicalName);
    if (!client) {
      throw new Error(`Bucket not initialized: ${logicalName}. Call ensureBucket() first.`);
    }
    return client;
  }

  private getBlob(bucket: string, key: string): BlockBlobClient {
    return this.getContainer(bucket).getBlockBlobClient(key);
  }

  ensureBucket(logicalName: string): void {
    if (!this.containers.has(logicalName)) {
      const containerName = this.getContainerName(logicalName);
      this.containers.set(logicalName, this.serviceClient.getContainerClient(containerName));
    }
  }

  // ── File existence & metadata ──────────────────────────────

  async exists(bucket: string, key: string): Promise<boolean> {
    return this.getBlob(bucket, key).exists();
  }

  async getMetadata(bucket: string, key: string): Promise<FileMetadata> {
    const blob = this.getBlob(bucket, key);
    const props = await blob.getProperties();
    return this.normalizeMetadata(props, key, bucket);
  }

  async setMetadata(
    bucket: string,
    key: string,
    meta: { contentType?: string; customTime?: string; metadata?: Record<string, string> },
  ): Promise<FileMetadata> {
    const blob = this.getBlob(bucket, key);

    if (meta.contentType) {
      await blob.setHTTPHeaders({ blobContentType: meta.contentType });
    }

    const azureMeta: Record<string, string> = { ...(meta.metadata ?? {}) };
    if (meta.customTime) {
      azureMeta['customtime'] = meta.customTime;
    }
    if (Object.keys(azureMeta).length > 0) {
      await blob.setMetadata(azureMeta);
    }

    return this.getMetadata(bucket, key);
  }

  // ── Signed URLs ────────────────────────────────────────────

  async signReadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const containerName = this.getContainerName(bucket);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 15 * 60 * 1000), // 15 min in past for clock skew
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
        protocol: SASProtocol.Https,
      },
      this.credential,
    ).toString();
    return `${this.getBlob(bucket, key).url}?${sasToken}`;
  }

  async signUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadResult> {
    const containerName = this.getContainerName(bucket);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('cw'),
        startsOn: new Date(Date.now() - 15 * 60 * 1000),
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
        protocol: SASProtocol.Https,
      },
      this.credential,
    ).toString();
    return {
      url: `${this.getBlob(bucket, key).url}?${sasToken}`,
      protocol: 'put',
      headers: {
        'Content-Type': contentType,
        'x-ms-blob-type': 'BlockBlob',
      },
    };
  }

  // ── Data transfer ──────────────────────────────────────────

  async download(bucket: string, key: string): Promise<Buffer> {
    const blob = this.getBlob(bucket, key);
    const response = await blob.download(0);
    const body = response.readableStreamBody;
    if (!body) throw new Error(`Failed to download blob: ${bucket}/${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async createReadStream(bucket: string, key: string): Promise<Readable> {
    const blob = this.getBlob(bucket, key);
    const response = await blob.download(0);
    const body = response.readableStreamBody;
    if (!body) throw new Error(`Failed to create read stream: ${bucket}/${key}`);
    // Azure returns a NodeJS.ReadableStream, wrap as Readable if needed
    return body as unknown as Readable;
  }

  async writeStream(
    bucket: string,
    key: string,
    stream: Readable,
    contentType: string,
  ): Promise<void> {
    const blob = this.getBlob(bucket, key);
    await blob.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  async writeBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const blob = this.getBlob(bucket, key);
    await blob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  // ── Object operations ──────────────────────────────────────

  async copy(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void> {
    const sourceBlob = this.getBlob(fromBucket, fromKey);
    const destBlob = this.getBlob(toBucket, toKey);
    const poller = await destBlob.beginCopyFromURL(sourceBlob.url);
    await poller.pollUntilDone();
  }

  async move(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void> {
    await this.copy(fromBucket, fromKey, toBucket, toKey);
    await this.delete(fromBucket, fromKey);
  }

  async delete(bucket: string, key: string): Promise<void> {
    const blob = this.getBlob(bucket, key);
    await blob.deleteIfExists();
  }

  async makePublic(bucket: string, key: string): Promise<void> {
    // Azure doesn't have per-blob public access like GCS.
    // Public access is controlled at the container level.
    // For our use case, public content is served via CDN (Azure Front Door),
    // so this is a no-op. The container's access level should be configured
    // at infrastructure setup time.
    //
    // If container-level public access is needed, it should be set when
    // creating the container, not per-blob.
  }

  // ── Listing ────────────────────────────────────────────────

  async listObjects(
    bucket: string,
    prefix: string,
    opts?: { delimiter?: string; maxResults?: number },
  ): Promise<string[]> {
    const container = this.getContainer(bucket);
    const names: string[] = [];
    const listOptions: {
      prefix: string;
      includeMetadata?: boolean;
    } = { prefix };

    let count = 0;
    for await (const blob of container.listBlobsFlat(listOptions)) {
      names.push(blob.name);
      count++;
      if (opts?.maxResults && count >= opts.maxResults) break;
    }
    return names;
  }

  // ── Admin ──────────────────────────────────────────────────

  consoleUrl(bucketUri: string, key: string): string {
    // Azure Portal storage explorer link
    return `https://portal.azure.com/#view/Microsoft_Azure_Storage/BlobPropertiesBladeV2/storageAccountId/~2Fsubscriptions~2F...~2FstorageAccounts~2F${this.accountName}/containerName/${bucketUri}/blobName/${encodeURIComponent(key)}`;
  }

  // ── Helpers ────────────────────────────────────────────────

  private normalizeMetadata(props: any, key: string, bucket: string): FileMetadata {
    return {
      name: key,
      size: props.contentLength ?? 0,
      etag: props.etag ?? '',
      md5Hash: props.contentMD5 ? Buffer.from(props.contentMD5).toString('base64') : '',
      contentType: props.contentType ?? '',
      bucket,
      metadata: props.metadata ?? {},
    };
  }
}
