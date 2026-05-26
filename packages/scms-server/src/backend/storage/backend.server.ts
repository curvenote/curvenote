import type { Context } from '@curvenote/scms-core';
import type { IStorageProvider } from '../../modules/storage/provider.interface.js';
import {
  resolveStorageConfig,
  createStorageProvider,
} from '../../modules/storage/factory.server.js';
import { KnownBuckets } from './constants.server.js';
import type { KnownBucketInfo } from './types.js';

export class StorageBackend {
  provider: IStorageProvider;
  $bucketInfo: Record<KnownBuckets, KnownBucketInfo>;
  $knownBucketByCdn: Record<string, KnownBuckets>;
  concurrency: number;

  constructor(ctx: Context, connectTo: KnownBuckets[] = [KnownBuckets.tmp], concurrency = 50) {
    this.concurrency = concurrency;
    this.$bucketInfo = ctx.$config.api.knownBucketInfoMap;
    this.$knownBucketByCdn = Object.values(KnownBuckets).reduce(
      (acc, name) => {
        const { cdn } = this.$bucketInfo[name];
        if (!cdn) return acc;
        return { ...acc, [cdn]: name };
      },
      {} as Record<string, KnownBuckets>,
    );

    // Resolve storage config (new style or legacy)
    const storageConfig = resolveStorageConfig(ctx.$config.api);
    if (!storageConfig) {
      throw new Error(
        'No storage provider configured. Set api.storage or api.storageSASecretKeyfile in app config.',
      );
    }

    // Build bucket URI map from knownBucketInfoMap
    const bucketUriMap = Object.values(KnownBuckets).reduce(
      (acc, name) => {
        return { ...acc, [name]: this.$bucketInfo[name].uri };
      },
      {} as Record<string, string>,
    );

    // Create the provider
    this.provider = createStorageProvider(storageConfig, bucketUriMap);

    // Connect to requested buckets
    for (const name of connectTo) {
      this.provider.ensureBucket(name);
    }
  }

  get cdns() {
    return Object.keys(this.$knownBucketByCdn);
  }

  summarise() {
    return {
      providerType: this.provider.type,
      names: Object.keys(this.$bucketInfo),
      cdns: Object.keys(this.$knownBucketByCdn),
      info: this.$bucketInfo,
    };
  }

  ensureConnection(bucket: KnownBuckets) {
    this.provider.ensureBucket(bucket);
  }

  knownBucketFromCDN(cdnMaybeWithSlash: string) {
    const cdn = cdnMaybeWithSlash.replace(/\/$/, '');
    return this.$knownBucketByCdn[cdn] ?? this.$knownBucketByCdn[`${cdn}/`] ?? null;
  }

  cdnFromKnownBucket(bucket: KnownBuckets) {
    return this.$bucketInfo[bucket].cdn;
  }

  /**
   * Generate a web console URL for a bucket + key
   */
  consoleUrl(bucket: KnownBuckets, key: string): string {
    const uri = this.$bucketInfo[bucket]?.uri ?? bucket;
    return this.provider.consoleUrl(uri, key);
  }

  /**
   * Signed link expiry in seconds
   */
  get expiry() {
    return {
      read: 24 * 60 * 60, // 24 hours
      write: 30 * 60, // 30 mins
    };
  }
}
