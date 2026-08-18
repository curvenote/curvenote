export type ProviderType = 'gcs' | 'azure' | 's3';

/**
 * Result from signUploadUrl — tells the client which protocol to use
 * for uploading to the signed URL.
 *
 * - 'gcs-resumable': GCS two-step flow (POST to init session, PUT to session URL)
 * - 'put': Single PUT to the URL (Azure SAS / S3 presigned)
 */
export type SignedUploadResult = {
  /** The URL the client uses to upload */
  url: string;
  /** The upload protocol the client should use */
  protocol: 'gcs-resumable' | 'put';
  /** Any additional headers the client needs to send */
  headers?: Record<string, string>;
};

/**
 * Normalised file metadata returned by all providers
 */
export type FileMetadata = {
  name: string;
  size: number;
  etag: string;
  md5Hash: string;
  contentType: string;
  bucket: string;
  metadata: Record<string, string>;
};

// ── Provider-specific config types ──────────────────────────

export type GcsStorageConfig = {
  secretKeyfile: string;
};

export type AzureStorageConfig = {
  accountName: string;
  accountKey?: string;
  connectionString?: string;
};

export type S3StorageConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Custom endpoint (e.g. MinIO `http://127.0.0.1:9000`). Omit for AWS S3. */
  endpoint?: string;
  /** Required for MinIO and most S3-compatible local stores. */
  forcePathStyle?: boolean;
};

export type StorageConfig = {
  provider: ProviderType;
  gcs?: GcsStorageConfig;
  azure?: AzureStorageConfig;
  s3?: S3StorageConfig;
};
