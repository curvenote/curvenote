import {
  baseSeedDraftMetadataFromSource,
  type SeedDraftMetadataFromSource,
} from '@curvenote/scms-server';
import { UPLOAD_ANALYSIS_METADATA_KEY } from '@curvenote/scms-core';

/** WorkVersion.metadata key for the durable generated-thumbnail listing. */
const METADATA_THUMBNAILS_KEY = 'thumbnails';

/**
 * Article create-new-version: inherit metadata and frontmatter, but start with an empty
 * manuscript dropzone (no files, upload analysis, or preview thumbnail listing).
 */
export const seedArticleDraftMetadataFromSource: SeedDraftMetadataFromSource = (sourceMetadata) => {
  const next = baseSeedDraftMetadataFromSource(sourceMetadata);
  delete next.files;
  delete next[UPLOAD_ANALYSIS_METADATA_KEY];
  delete next[METADATA_THUMBNAILS_KEY];
  return next;
};
