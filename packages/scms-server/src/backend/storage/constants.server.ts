export enum KnownBuckets {
  'staging' = 'staging', // Used to prepare a deploy to curve.space
  'hashstore' = 'hashstore', // Used to store files by hash
  'tmp' = 'tmp',
  'cdn' = 'cdn', // Used to serve curve.space
  'prv' = 'prv', // Used to store private files
  'pub' = 'pub', // Used to store published files
}
