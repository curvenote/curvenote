import type { IStorageProvider } from './provider.interface.js';
import type { StorageConfig } from './types.js';
import { GcsStorageProvider } from './gcs/provider.server.js';
import { AzureStorageProvider } from './azure/provider.server.js';
import { S3StorageProvider } from './s3/provider.server.js';

/**
 * Resolve storage config from the API config.
 *
 * Supports:
 * 1. New style: api.storage.provider + api.storage.<provider>
 * 2. Legacy: api.storageSASecretKeyfile (auto-derives GCS config)
 *
 * Returns null if no storage is configured.
 */
export function resolveStorageConfig(apiConfig: {
  storage?: StorageConfig;
  storageSASecretKeyfile?: string;
}): StorageConfig | null {
  // New style
  if (apiConfig.storage?.provider) {
    return apiConfig.storage;
  }
  // Legacy GCS style
  if (apiConfig.storageSASecretKeyfile) {
    return {
      provider: 'gcs',
      gcs: { secretKeyfile: apiConfig.storageSASecretKeyfile },
    };
  }
  // No storage configured
  return null;
}

/**
 * Create a storage provider from config.
 *
 * @param config - The resolved storage config
 * @param bucketUriMap - Maps logical bucket names (KnownBuckets values) to
 *   provider-specific bucket/container identifiers (the `uri` field from knownBucketInfoMap)
 */
export function createStorageProvider(
  config: StorageConfig,
  bucketUriMap: Record<string, string>,
): IStorageProvider {
  switch (config.provider) {
    case 'gcs': {
      if (!config.gcs) throw new Error('GCS storage config missing gcs credentials');
      return new GcsStorageProvider(config.gcs, bucketUriMap);
    }
    case 'azure': {
      if (!config.azure) throw new Error('Azure storage config missing azure credentials');
      return new AzureStorageProvider(config.azure, bucketUriMap);
    }
    case 's3': {
      if (!config.s3) throw new Error('S3 storage config missing s3 credentials');
      return new S3StorageProvider(config.s3, bucketUriMap);
    }
    default:
      throw new Error(`Unknown storage provider: ${(config as any).provider}`);
  }
}
