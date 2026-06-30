import type { WorkCreateOption } from '../extensions/types.js';
import {
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from './builtinArticleOption.js';

function metadataHasKey(metadata: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(metadata, key) && metadata[key] != null;
}

/**
 * Pick the create-work option that best matches an existing work version's metadata.
 * Extension options win when their metadata key is present; otherwise Article is the fallback.
 */
export function resolveWorkCreateOptionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  availableOptions: WorkCreateOption[],
): WorkCreateOption {
  const meta = metadata ?? {};
  const extensionOptions = availableOptions.filter(
    (option) => option.id !== BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
  );

  for (const option of extensionOptions) {
    if (metadataHasKey(meta, option.metadataKey)) {
      return option;
    }
  }

  return (
    availableOptions.find((option) => option.id === BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID) ??
    BUILTIN_ARTICLE_WORK_CREATE_OPTION
  );
}
