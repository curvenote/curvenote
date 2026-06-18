/**
 * Server-side document preview fetching for a work version.
 *
 * For the given work version: finds preview-candidate files in metadata.files
 * (the intersection of officeparser-supported formats and the manuscript dropzone
 * MIME types — see isPreviewCandidate; today {docx, pdf}), downloads each via
 * signed URL, parses with officeparser, and returns the first "page" of content
 * (truncated AST) per file.
 *
 * Parsed first-page AST is cached in the Object table as
 * type/id "docx:preview:${file.md5}" so repeated loads skip re-parsing.
 */

import { findWorkByVersion, getPrismaClient, signFilesInMetadata } from '@curvenote/scms-server';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import { formatDate } from '@curvenote/common';
import type { OfficeParserAST, OfficeContentNode, OfficeAttachment } from 'officeparser';
import { isPreviewCandidate } from './previewGuards';

/** Number of top-level content nodes to include for "first page" preview */
const FIRST_PAGE_CONTENT_LIMIT = 10;

/** A first page with this much text is enough for metadata extraction on its own. */
const FIRST_PAGE_MIN_TEXT_LENGTH = 500;

/** Page two must be this much larger than a sparse first page before we include it. */
const SECOND_PAGE_SIGNIFICANTLY_LARGER_RATIO = 1.5;

/** Object table type/id prefix for DOCX preview cache entries */
const DOCX_PREVIEW_CACHE_PREFIX = 'docx:preview:';

function docxPreviewCacheId(md5: string): string {
  return `${DOCX_PREVIEW_CACHE_PREFIX}${md5}`;
}

/** Shape of cached AST stored in Object.data (must match truncateAstToFirstPage return) */
function isCachedAst(data: unknown): data is {
  type: string;
  metadata: unknown;
  content: unknown[];
  attachments: unknown[];
  wasTruncated?: boolean;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'content' in data &&
    Array.isArray((data as { content: unknown }).content)
  );
}

/**
 * Recursively extract plain text from AST content nodes for sending to LLM.
 * Skips image/attachment content (no binary); uses placeholder for images.
 */
function nodeToPlainText(node: OfficeContentNode): string {
  if (node.type === 'text') {
    return (node as { text?: string }).text ?? '';
  }
  if (node.type === 'image' || node.type === 'chart' || node.type === 'drawing') {
    return '';
  }
  const children = (node as { children?: OfficeContentNode[] }).children;
  if (!children?.length) {
    const direct = (node as { text?: string }).text;
    return direct != null ? String(direct) : '';
  }
  return children.map(nodeToPlainText).join('');
}

function extractableTextLength(nodes: OfficeContentNode[]): number {
  return astContentToPlainText(nodes).length;
}

function isPageNode(node: OfficeContentNode): boolean {
  return node.type === 'page';
}

function shouldIncludeSecondPage(
  firstPage: OfficeContentNode,
  secondPage?: OfficeContentNode,
): boolean {
  if (!secondPage) return false;
  const firstPageLength = extractableTextLength([firstPage]);
  if (firstPageLength >= FIRST_PAGE_MIN_TEXT_LENGTH) return false;
  const secondPageLength = extractableTextLength([secondPage]);
  if (secondPageLength === 0) return false;
  return (
    secondPageLength >=
    Math.max(FIRST_PAGE_MIN_TEXT_LENGTH, firstPageLength * SECOND_PAGE_SIGNIFICANTLY_LARGER_RATIO)
  );
}

/**
 * Truncate AST content to the first page when officeparser exposes page nodes.
 *
 * Some formats (notably PDF) parse into page nodes, where a single top-level
 * node can contain a full page. Others (notably DOCX) parse into paragraph-like
 * nodes, so we keep the historical node-count fallback for non-paged ASTs.
 * Returns a serializable object (no toText method).
 * Includes attachments so image nodes in the truncated content can be resolved.
 */
export function truncateAstToFirstPage(ast: OfficeParserAST): {
  type: OfficeParserAST['type'];
  metadata: OfficeParserAST['metadata'];
  content: OfficeContentNode[];
  attachments: OfficeAttachment[];
  wasTruncated: boolean;
} {
  const fullContent = ast.content ?? [];
  const pageNodes = fullContent.filter(isPageNode);
  const content =
    pageNodes.length > 0
      ? pageNodes.slice(0, shouldIncludeSecondPage(pageNodes[0], pageNodes[1]) ? 2 : 1)
      : fullContent.slice(0, FIRST_PAGE_CONTENT_LIMIT);
  const wasTruncated =
    pageNodes.length > 0
      ? content.length < pageNodes.length
      : fullContent.length > FIRST_PAGE_CONTENT_LIMIT;
  return {
    type: ast.type,
    metadata: ast.metadata,
    content,
    attachments: ast.attachments ?? [],
    wasTruncated,
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
 * Convert first-page AST content to a single plain text string (no attachments).
 * Used as the document body for the Anthropic fast-find-metadata call.
 */
export function astContentToPlainText(content: OfficeContentNode[]): string {
  const parts = content.map((node) => {
    const text = nodeToPlainText(node);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'list') {
      return text ? `${text}\n` : '\n';
    }
    if (node.type === 'table') {
      const children = (node as { children?: OfficeContentNode[] }).children ?? [];
      const rowTexts = children
        .filter((c) => (c as { type?: string }).type === 'row')
        .map((row) => {
          const cells = (row as { children?: OfficeContentNode[] }).children ?? [];
          return cells
            .map((c) => nodeToPlainText(c as OfficeContentNode))
            .filter(Boolean)
            .join('\t');
        });
      return rowTexts.join('\n') + '\n';
    }
    return text;
  });
  return parts.join('').trim();
}

/**
 * Fetch previews for all preview-candidate files in the work version's metadata
 * (see isPreviewCandidate). Downloads each file via signed URL, parses with
 * officeparser, and returns file metadata plus truncated AST (first page of content).
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
  const previewEntries = Object.entries(signedFiles).filter(([, file]) => isPreviewCandidate(file));

  const previews: DocxPreviewItem[] = [];
  const prisma = await getPrismaClient();

  for (const [path, file] of previewEntries) {
    const signedUrl = file.signedUrl;
    if (!signedUrl || typeof signedUrl !== 'string') {
      console.warn('fetchDocxPreviews: no signedUrl for docx', path);
      continue;
    }

    const md5 = file.md5;
    const cacheId = typeof md5 === 'string' && md5 ? docxPreviewCacheId(md5) : null;

    let ast: ReturnType<typeof truncateAstToFirstPage> | null = null;

    if (cacheId) {
      const cached = await prisma.object.findUnique({
        where: { id: cacheId },
        select: { data: true },
      });
      if (cached?.data != null && isCachedAst(cached.data)) {
        ast = cached.data as ReturnType<typeof truncateAstToFirstPage>;
      }
    }

    if (!ast) {
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) {
          console.warn('fetchDocxPreviews: download failed', path, response.status);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        // Defer loading officeparser (and its heavy transitive deps: tesseract.js,
        // pdfjs-dist) until a DOCX actually needs parsing, keeping the route's
        // server module light on cold start.
        const { parseOffice } = await import('officeparser');
        const fullAst = await parseOffice(arrayBuffer, {
          extractAttachments: true,
          newlineDelimiter: '\n',
        });
        ast = truncateAstToFirstPage(fullAst);

        if (cacheId) {
          const now = formatDate();
          try {
            await prisma.object.create({
              data: {
                id: cacheId,
                type: cacheId,
                date_created: now,
                date_modified: now,
                data: ast as object,
                occ: 0,
                ...(ctx.user?.id ? { created_by_id: ctx.user.id } : {}),
              },
              select: { id: true },
            });
          } catch (createErr: unknown) {
            const code = (createErr as { code?: string })?.code;
            if (code !== 'P2002') {
              console.warn('fetchDocxPreviews: failed to cache preview', path, createErr);
            }
          }
        }
      } catch (err) {
        console.warn('fetchDocxPreviews: parse failed', path, err);
        continue;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signedUrl: _drop, ...fileMeta } = file;
    previews.push({
      path,
      data: fileMeta as FileMetadataSectionItem,
      ast,
    });
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
 * Single entry point for the fetch-previews intent (action).
 * Generates previews (and writes to Object table), returns previews.
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

/**
 * Read DOCX previews from the Object table only (no download/parse).
 * Used by the loader to return whatever previews are already cached.
 * Caller must pass metadata that includes .files (e.g. signed metadata).
 */
export async function readDocxPreviewsFromObjectTable(metadata: {
  files?: Record<string, FileMetadataSectionItem & { signedUrl?: string }>;
}): Promise<DocxPreviewItem[]> {
  const files = metadata.files ?? {};
  if (typeof files !== 'object') {
    return [];
  }
  const previewEntries = Object.entries(files).filter(([, file]) => isPreviewCandidate(file));
  const prisma = await getPrismaClient();
  const previews: DocxPreviewItem[] = [];
  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId = typeof md5 === 'string' && md5 ? docxPreviewCacheId(md5) : null;
    if (!cacheId) continue;
    const cached = await prisma.object.findUnique({
      where: { id: cacheId },
      select: { data: true },
    });
    if (cached?.data == null || !isCachedAst(cached.data)) continue;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signedUrl: _drop, ...fileMeta } = file;
    previews.push({
      path,
      data: fileMeta as FileMetadataSectionItem,
      ast: cached.data as ReturnType<typeof truncateAstToFirstPage>,
    });
  }
  previews.sort((a, b) => {
    const orderA = a.data.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.data.order ?? Number.POSITIVE_INFINITY;
    return orderA - orderB;
  });
  return previews;
}
