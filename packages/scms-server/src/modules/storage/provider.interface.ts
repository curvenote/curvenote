import type { Readable } from 'stream';
import type { ProviderType, FileMetadata, SignedUploadResult } from './types.js';

/**
 * Normalised storage provider interface.
 *
 * Every cloud storage backend (GCS, Azure Blob, S3) implements this interface.
 * The File and Folder classes delegate all cloud-specific operations through it.
 */
export interface IStorageProvider {
  /** The provider type identifier */
  readonly type: ProviderType;

  // ── Connection ──────────────────────────────────────────────

  /**
   * Register a logical bucket name with the provider.
   *
   * For GCS: creates a Bucket client for the mapped URI.
   * For Azure: creates a ContainerClient.
   * For S3: validates the bucket exists (or lazy-initialises).
   */
  ensureBucket(logicalName: string): void;

  // ── File existence & metadata ──────────────────────────────

  /** Check if an object exists */
  exists(bucket: string, key: string): Promise<boolean>;

  /** Get object metadata */
  getMetadata(bucket: string, key: string): Promise<FileMetadata>;

  /**
   * Update object metadata.
   * Supports content type changes, custom time (for lifecycle rules),
   * and arbitrary key-value metadata.
   */
  setMetadata(
    bucket: string,
    key: string,
    meta: {
      contentType?: string;
      customTime?: string;
      metadata?: Record<string, string>;
    },
  ): Promise<FileMetadata>;

  // ── Signed URLs ────────────────────────────────────────────

  /**
   * Generate a time-limited read URL.
   *
   * GCS: signed URL.
   * Azure: SAS token URL with 'r' permission.
   * S3: presigned GET URL.
   */
  signReadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;

  /**
   * Generate a time-limited upload URL with protocol info.
   *
   * GCS: signed resumable upload URL (protocol: 'gcs-resumable').
   * Azure: SAS URL with 'cw' permissions (protocol: 'put').
   * S3: presigned PUT URL (protocol: 'put').
   */
  signUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<SignedUploadResult>;

  // ── Data transfer ──────────────────────────────────────────

  /** Download an object to a buffer */
  download(bucket: string, key: string): Promise<Buffer>;

  /** Create a readable stream for an object */
  createReadStream(bucket: string, key: string): Promise<Readable>;

  /** Write a readable stream to an object */
  writeStream(bucket: string, key: string, stream: Readable, contentType: string): Promise<void>;

  /** Write a buffer to an object */
  writeBuffer(bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void>;

  // ── Object operations ──────────────────────────────────────

  /**
   * Copy an object (same or cross-bucket within the same provider).
   * Both buckets are logical names that the provider resolves internally.
   */
  copy(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void>;

  /**
   * Move an object (copy + delete).
   * Both buckets are logical names that the provider resolves internally.
   */
  move(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void>;

  /** Delete an object */
  delete(bucket: string, key: string): Promise<void>;

  /** Make an object publicly readable */
  makePublic(bucket: string, key: string): Promise<void>;

  // ── Listing ────────────────────────────────────────────────

  /** List object keys under a prefix */
  listObjects(
    bucket: string,
    prefix: string,
    opts?: { delimiter?: string; maxResults?: number },
  ): Promise<string[]>;

  // ── Admin ──────────────────────────────────────────────────

  /**
   * Generate a web console URL for viewing an object in the cloud provider's UI.
   *
   * GCS: Google Cloud Console link.
   * Azure: Azure Portal link.
   * S3: AWS S3 Console link.
   */
  consoleUrl(bucketUri: string, key: string): string;
}
