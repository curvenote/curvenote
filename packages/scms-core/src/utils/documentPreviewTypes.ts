import type { FileMetadataSectionItem } from '../backend/uploads/schema.js';

/** A candidate thumbnail figure, referenced by storage key (never base64). */
export interface PreviewFigure {
  key: string;
  name?: string;
  altText?: string;
  signedUrl?: string;
}

/**
 * Client-safe first-page AST shape.
 * Server code may use a richer `content` element type (e.g. officeparser nodes);
 * that remains structurally assignable to this interface.
 */
export interface PreviewAstData {
  type: string;
  metadata: Record<string, unknown>;
  content: unknown[];
  wasTruncated: boolean;
}

export interface DocumentPreviewItem {
  path: string;
  data: FileMetadataSectionItem;
  ast: PreviewAstData;
  figures: PreviewFigure[];
  previewUnavailable?: boolean;
  figuresExtractionSkipped?: boolean;
  /** True when phase-B figure extraction is still pending for this preview. */
  figuresPending?: boolean;
}
