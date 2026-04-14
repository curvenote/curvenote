/**
 * Server-side DOCX preview fetching for a work version.
 *
 * For the given work version: finds .docx files in metadata.files,
 * downloads each via signed URL, parses with officeparser, and returns
 * the first "page" of content (truncated AST) per file.
 */

import { findWorkByVersion, signFilesInMetadata } from '@curvenote/scms-server';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import { parseOffice } from 'officeparser';
import type { OfficeParserAST, OfficeContentNode } from 'officeparser';

/** Number of top-level content nodes to include for "first page" preview */
const FIRST_PAGE_CONTENT_LIMIT = 25;

function isDocxPath(path: string): boolean {
  return path.toLowerCase().endsWith('.docx');
}

/**
 * Truncate AST content to first N nodes (first "page").
 * Returns a serializable object (no toText method).
 */
function truncateAstToFirstPage(ast: OfficeParserAST): {
  type: OfficeParserAST['type'];
  metadata: OfficeParserAST['metadata'];
  content: OfficeContentNode[];
} {
  const content = (ast.content ?? []).slice(0, FIRST_PAGE_CONTENT_LIMIT);
  return {
    type: ast.type,
    metadata: ast.metadata,
    content,
  };
}

export interface DocxPreviewItem {
  /** File path (key in metadata.files) */
  path: string;
  /** File metadata (name, size, type, path, etc.) */
  data: FileMetadataSectionItem;
  /** First-page AST (type, metadata, content only) */
  ast: ReturnType<typeof truncateAstToFirstPage>;
}

export interface FetchPreviewsResult {
  previews: DocxPreviewItem[];
}

/**
 * Fetch previews for all .docx files in the work version's metadata.
 * Downloads each file via signed URL, parses with officeparser, and returns
 * file metadata plus truncated AST (first page of content).
 */
export async function fetchDocxPreviews(
  workVersionId: string,
  ctx: Context,
): Promise<FetchPreviewsResult> {
  const work = await findWorkByVersion(workVersionId);
  if (!work?.metadata) {
    return { previews: [] };
  }

  const rawMetadata = work.metadata as Record<string, unknown>;
  const files = rawMetadata?.files as Record<string, FileMetadataSectionItem> | undefined;
  if (!files || typeof files !== 'object') {
    return { previews: [] };
  }

  const signedMetadata = await signFilesInMetadata(
    { ...rawMetadata, files } as Parameters<typeof signFilesInMetadata>[0],
    work.cdn ?? '',
    ctx,
  );
  const signedFiles = signedMetadata.files ?? {};
  const docxEntries = Object.entries(signedFiles).filter(([, file]) =>
    isDocxPath(file.path ?? file.name ?? ''),
  );

  const previews: DocxPreviewItem[] = [];

  for (const [path, file] of docxEntries) {
    const signedUrl = file.signedUrl;
    if (!signedUrl || typeof signedUrl !== 'string') {
      console.warn('fetchDocxPreviews: no signedUrl for docx', path);
      continue;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        console.warn('fetchDocxPreviews: download failed', path, response.status);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const ast = await parseOffice(arrayBuffer, {
        extractAttachments: false,
        newlineDelimiter: '\n',
      });
      const { signedUrl: _drop, ...fileMeta } = file;
      previews.push({
        path,
        data: fileMeta as FileMetadataSectionItem,
        ast: truncateAstToFirstPage(ast),
      });
    } catch (err) {
      console.warn('fetchDocxPreviews: parse failed', path, err);
      // Skip this file; continue with others
    }
  }

  // Sort by file metadata order so display order matches upload order
  previews.sort((a, b) => {
    const orderA = a.data.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.data.order ?? Number.POSITIVE_INFINITY;
    return orderA - orderB;
  });

  return { previews };
}

/**
 * Single entry point for the fetch-previews intent.
 * Returns the payload to send to the client (previews array).
 * Use from the action as `return data(await handleFetchPreviewsIntent(...))`,
 * or from the loader by merging the result into loader data.
 * Throws if workVersionId is missing (caller can map to 400).
 */
export async function handleFetchPreviewsIntent(
  workVersionId: string | undefined,
  ctx: Context,
): Promise<{ previews: DocxPreviewItem[] }> {
  if (!workVersionId) {
    throw new Error('Work version ID is required');
  }
  const result = await fetchDocxPreviews(workVersionId, ctx);
  return { previews: result.previews };
}
