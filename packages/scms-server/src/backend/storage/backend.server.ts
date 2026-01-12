import type { Bucket } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import type { Context } from '@curvenote/scms-core';
import { KnownBuckets } from './constants.server.js';
import type { KeyFile, KnownBucketInfo } from './types.js';

export class StorageBackend {
  $keyfile: KeyFile;
  $bucketInfo: Record<KnownBuckets, KnownBucketInfo>;
  $buckets: Record<string, Bucket>;
  $knownBucketByCdn: Record<string, KnownBuckets>;
  concurrency: number;

  constructor(ctx: Context, connectTo: KnownBuckets[] = [KnownBuckets.tmp], concurrency = 50) {
    this.concurrency = concurrency;
    this.$keyfile = JSON.parse(ctx.$config.api.storageSASecretKeyfile);
    this.$bucketInfo = ctx.$config.api.knownBucketInfoMap;
    this.$knownBucketByCdn = Object.entries(this.$bucketInfo).reduce((acc, [name, { cdn }]) => {
      if (!cdn) return acc;
      return { ...acc, [cdn]: name };
    }, {});
    this.$buckets = connectTo.reduce((acc, name) => {
      return {
        ...acc,
        [name]: new Storage({
          credentials: this.$keyfile,
          projectId: this.$keyfile.project_id,
        }).bucket(this.$bucketInfo[name].uri),
      };
    }, {});
  }

  get cdns() {
    return Object.keys(this.$knownBucketByCdn);
  }

  summarise() {
    return {
      names: Object.keys(this.$bucketInfo),
      cdns: Object.keys(this.$knownBucketByCdn),
      info: this.$bucketInfo,
    };
  }

  ensureConnection(bucket: KnownBuckets) {
    if (!this.$buckets[bucket]) {
      this.$buckets[bucket] = new Storage({
        credentials: this.$keyfile,
        projectId: this.$keyfile.project_id,
      }).bucket(this.$bucketInfo[bucket].uri);
    }
  }

  get buckets() {
    return this.$buckets;
  }

  knownBucketFromCDN(cdnMaybeWithSlash: string) {
    const cdn = cdnMaybeWithSlash.replace(/\/$/, '');
    return this.$knownBucketByCdn[cdn] ?? this.$knownBucketByCdn[`${cdn}/`] ?? null;
  }

  cdnFromKnownBucket(bucket: KnownBuckets) {
    return this.$bucketInfo[bucket].cdn;
  }

  /**
   * Signed link expiry in seconds
   */
  get expiry() {
    return {
      read: 24 * 60 * 60, // 24 hours
      write: 30 * 60, // 1 hour
    };
  }
}
