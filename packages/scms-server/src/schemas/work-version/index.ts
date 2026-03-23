import type { FileMetadataSection } from '../files.js';
import type { ChecksMetadata } from './checks.js';

// Re-export everything from sub-modules
export * from './checks.js';

export type WorkVersionMetadata = {
  [key: string]: any;
} & FileMetadataSection &
  ChecksMetadata;

export function makeDefaultWorkVersionMetadata(): WorkVersionMetadata {
  return {};
}
