/**
 * Server-side document preview fetching for a work version.
 *
 * For the given work version: finds preview-candidate files in metadata.files
 * (the intersection of officeparser-supported formats and the manuscript dropzone
 * MIME types — see isPreviewCandidate; today {docx, pdf}), downloads each via
 * signed URL, parses with officeparser, and returns the first "page" of content
 * (truncated AST) per file.
 *
 * Extracted figures are NOT kept as base64. Each candidate figure is downscaled to a
 * compact webp at parse time and written to object storage under the work version's
 * `thumbnails/` subpath; the cached preview stores only the storage keys. The picker
 * references signed URLs (see signPreviewFigures), so base64 image bytes never hit the
 * Object table, the loader payload, or client memory.
 *
 * Parsed previews are cached in the Object table as type/id
 * "docx:preview:v2:${file.md5}" so repeated loads skip re-parsing. The prefix is
 * versioned: bumping it invalidates older cache shapes.
 */

import {
  File,
  KnownBuckets,
  StorageBackend,
  findWorkByVersion,
  getPrismaClient,
  resolveThumbnailBucket,
  signFilesInMetadata,
} from '@curvenote/scms-server';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import { formatDate } from '@curvenote/common';
import type { OfficeParserAST, OfficeContentNode, OfficeAttachment } from 'officeparser';
import { isPreviewCandidate } from './previewGuards';
import { downscaleToWebp } from './imagePipeline.server';

/** Number of top-level content nodes to include for "first page" preview */
const FIRST_PAGE_CONTENT_LIMIT = 10;

/** A first page with this much text is enough for metadata extraction on its own. */
const FIRST_PAGE_MIN_TEXT_LENGTH = 500;

/** Page two must be this much larger than a sparse first page before we include it. */
const SECOND_PAGE_SIGNIFICANTLY_LARGER_RATIO = 1.5;

/** Object table type/id prefix for cached document preview entries (versioned). */
const DOCUMENT_PREVIEW_CACHE_PREFIX = 'docx:preview:v2:';

/** Older cache prefixes whose rows should be removed during cleanup. */
const LEGACY_PREVIEW_CACHE_PREFIXES = ['docx:preview:'];

/** Longest edge (px) of a downscaled candidate figure thumbnail. */
const PREVIEW_FIGURE_MAX_EDGE = 384;

/** webp quality for downscaled candidate figure thumbnails. */
const PREVIEW_FIGURE_WEBP_QUALITY = 70;

/** Maximum number of candidate figures to extract/store per document. */
const MAX_PREVIEW_FIGURES = 24;

/** Skip preview generation for source files larger than this (protects against OOM). */
const MAX_PREVIEW_SOURCE_BYTES = 100 * 1024 * 1024;

function documentPreviewCacheId(md5: string): string {
  return `${DOCUMENT_PREVIEW_CACHE_PREFIX}${md5}`;
}

/** Storage key for a downscaled candidate figure, under the source file's thumbnails/ dir. */
function thumbnailKeyForFigure(sourcePath: string, md5: string, index: number): string {
  const slashIdx = sourcePath.lastIndexOf('/');
  const dir = slashIdx >= 0 ? sourcePath.slice(0, slashIdx) : '';
  const fileName = `preview-${md5}-${index}.webp`;
  return dir ? `${dir}/thumbnails/${fileName}` : `thumbnails/${fileName}`;
}

/** A candidate thumbnail figure, referenced by storage key (never base64). */
export interface PreviewFigure {
  /** Storage key (path) of the downscaled webp candidate thumbnail. */
  key: string;
  /** Original attachment name, used to resolve inline image nodes in the text preview. */
  name?: string;
  altText?: string;
  /** Signed read URL — populated at loader time (see signPreviewFigures), never persisted. */
  signedUrl?: string;
}

/** First-page AST (text/content only — no base64 attachments). */
export interface PreviewAstData {
  type: OfficeParserAST['type'];
  metadata: OfficeParserAST['metadata'];
  content: OfficeContentNode[];
  wasTruncated: boolean;
}

export interface DocumentPreviewItem {
  /** File path (key in metadata.files) */
  path: string;
  /** File metadata (name, size, type, path, etc.) */
  data: FileMetadataSectionItem;
  /** First-page AST (type, metadata, content only) */
  ast: PreviewAstData;
  /** Candidate thumbnail figures (storage keys; signedUrl added at loader time). */
  figures: PreviewFigure[];
  /** True when preview generation was skipped (e.g. source too large). */
  previewUnavailable?: boolean;
}

export interface FetchPreviewsResult {
  previews: DocumentPreviewItem[];
}

/** Shape persisted in Object.data for a cached preview. */
interface CachedPreview {
  ast: PreviewAstData;
  figures: PreviewFigure[];
  previewUnavailable?: boolean;
}

function isCachedPreview(data: unknown): data is CachedPreview {
  return (
    typeof data === 'object' &&
    data !== null &&
    'ast' in data &&
    'figures' in data &&
    Array.isArray((data as { figures: unknown }).figures) &&
    typeof (data as { ast: unknown }).ast === 'object' &&
    (data as { ast: unknown }).ast !== null
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
 * Returns a serializable object containing content text only — no base64 attachments.
 */
export function truncateAstToFirstPage(ast: OfficeParserAST): PreviewAstData {
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
    wasTruncated,
  };
}

/**
 * Downscale each image attachment to a compact webp and write it to storage under the
 * source file's thumbnails/ subpath. Returns the candidate figures (storage keys only).
 * Best-effort per image: a single failure is skipped rather than aborting the document.
 */
async function extractAndStoreFigures(
  attachments: OfficeAttachment[],
  opts: { sourcePath: string; md5: string; backend: StorageBackend; bucket: KnownBuckets },
): Promise<PreviewFigure[]> {
  const images = attachments
    .filter((att) => att.type === 'image' && typeof att.data === 'string' && att.data.length > 0)
    .slice(0, MAX_PREVIEW_FIGURES);

  const figures: PreviewFigure[] = [];
  let index = 0;
  for (const att of images) {
    try {
      const source = Buffer.from(att.data, 'base64');
      const webp = await downscaleToWebp(source, att.mimeType, {
        maxEdge: PREVIEW_FIGURE_MAX_EDGE,
        quality: PREVIEW_FIGURE_WEBP_QUALITY,
      });
      const key = thumbnailKeyForFigure(opts.sourcePath, opts.md5, index);
      const file = new File(opts.backend, key, opts.bucket);
      await file.writeArrayBuffer(
        webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer,
        'image/webp',
      );
      figures.push({ key, name: att.name, altText: att.altText });
      index += 1;
    } catch (err) {
      console.warn('extractAndStoreFigures: failed to process figure', opts.sourcePath, err);
    }
  }
  return figures;
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

function emptyPreviewAst(sourcePath: string): PreviewAstData {
  const type: OfficeParserAST['type'] = sourcePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
  return { type, metadata: {} as OfficeParserAST['metadata'], content: [], wasTruncated: false };
}

function stripSignedUrl(file: FileMetadataSectionItem & { signedUrl?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signedUrl: _drop, ...fileMeta } = file;
  return fileMeta as FileMetadataSectionItem;
}

function sortPreviewsByOrder(previews: DocumentPreviewItem[]): DocumentPreviewItem[] {
  return previews.sort((a, b) => {
    const orderA = a.data.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.data.order ?? Number.POSITIVE_INFINITY;
    return orderA - orderB;
  });
}

/**
 * Fetch previews for all preview-candidate files in the work version's metadata
 * (see isPreviewCandidate). Downloads each file via signed URL, parses with
 * officeparser, downscales+stores candidate figures, and returns file metadata plus
 * truncated AST (first page of content) and figure storage keys.
 */
export async function fetchDocumentPreviews(
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

  const cdn = work.cdn ?? '';
  const signedMetadata = await signFilesInMetadata(
    { ...rawMetadata, files } as Parameters<typeof signFilesInMetadata>[0],
    cdn,
    ctx,
  );
  const signedFiles = signedMetadata.files ?? {};
  const previewEntries = Object.entries(signedFiles).filter(([, file]) => isPreviewCandidate(file));

  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const figureBucket = cdn ? resolveThumbnailBucket(ctx, backend, cdn) : null;

  const previews: DocumentPreviewItem[] = [];
  const prisma = await getPrismaClient();

  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId = typeof md5 === 'string' && md5 ? documentPreviewCacheId(md5) : null;

    let cached: CachedPreview | null = null;

    if (cacheId) {
      const row = await prisma.object.findUnique({
        where: { id: cacheId },
        select: { data: true },
      });
      if (row?.data != null && isCachedPreview(row.data)) {
        cached = row.data;
      }
    }

    if (!cached) {
      // Guard oversized sources to avoid loading/parsing huge documents into memory.
      const size = typeof file.size === 'number' ? file.size : 0;
      if (size > MAX_PREVIEW_SOURCE_BYTES) {
        console.warn('fetchDocumentPreviews: source too large, skipping preview', path, size);
        cached = { ast: emptyPreviewAst(path), figures: [], previewUnavailable: true };
      } else {
        const signedUrl = file.signedUrl;
        if (!signedUrl || typeof signedUrl !== 'string') {
          console.warn('fetchDocumentPreviews: no signedUrl for preview candidate', path);
          continue;
        }
        try {
          const response = await fetch(signedUrl);
          if (!response.ok) {
            console.warn('fetchDocumentPreviews: download failed', path, response.status);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          // Defer loading officeparser (and its heavy transitive deps: tesseract.js,
          // pdfjs-dist) until a document actually needs parsing, keeping the route's
          // server module light on cold start.
          const { parseOffice } = await import('officeparser');
          const fullAst = await parseOffice(arrayBuffer, {
            extractAttachments: true,
            newlineDelimiter: '\n',
          });
          const ast = truncateAstToFirstPage(fullAst);
          const figures =
            figureBucket && cacheId
              ? await extractAndStoreFigures(fullAst.attachments ?? [], {
                  sourcePath: path,
                  md5: md5 as string,
                  backend,
                  bucket: figureBucket,
                })
              : [];
          cached = { ast, figures, previewUnavailable: false };
        } catch (err) {
          console.warn('fetchDocumentPreviews: parse failed', path, err);
          continue;
        }
      }

      if (cacheId) {
        const now = formatDate();
        try {
          await prisma.object.create({
            data: {
              id: cacheId,
              type: cacheId,
              date_created: now,
              date_modified: now,
              data: cached as object,
              occ: 0,
              ...(ctx.user?.id ? { created_by_id: ctx.user.id } : {}),
            },
            select: { id: true },
          });
        } catch (createErr: unknown) {
          const code = (createErr as { code?: string })?.code;
          if (code !== 'P2002') {
            console.warn('fetchDocumentPreviews: failed to cache preview', path, createErr);
          }
        }
      }
    }

    previews.push({
      path,
      data: stripSignedUrl(file),
      ast: cached.ast,
      figures: cached.figures,
      previewUnavailable: cached.previewUnavailable,
    });
  }

  return { previews: sortPreviewsByOrder(previews) };
}

/**
 * Single entry point for the fetch-previews intent (action).
 * Generates previews (and writes to Object table), returns previews.
 * Throws if workVersionId is missing (caller can map to 400).
 */
export async function handleFetchPreviewsIntent(
  workVersionId: string | undefined,
  ctx: Context,
): Promise<{ previews: DocumentPreviewItem[] }> {
  if (!workVersionId) {
    throw new Error('Work version ID is required');
  }
  const result = await fetchDocumentPreviews(workVersionId, ctx);
  return { previews: result.previews };
}

/**
 * Read document previews from the Object table only (no download/parse).
 * Used by the loader to return whatever previews are already cached.
 * Caller must pass metadata that includes .files (e.g. signed metadata).
 *
 * Figures are returned without signedUrl; call signPreviewFigures to add them.
 */
export async function readDocumentPreviewsFromObjectTable(metadata: {
  files?: Record<string, FileMetadataSectionItem & { signedUrl?: string }>;
}): Promise<DocumentPreviewItem[]> {
  const files = metadata.files ?? {};
  if (typeof files !== 'object') {
    return [];
  }
  const previewEntries = Object.entries(files).filter(([, file]) => isPreviewCandidate(file));
  const prisma = await getPrismaClient();
  const previews: DocumentPreviewItem[] = [];
  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId = typeof md5 === 'string' && md5 ? documentPreviewCacheId(md5) : null;
    if (!cacheId) continue;
    const row = await prisma.object.findUnique({
      where: { id: cacheId },
      select: { data: true },
    });
    if (row?.data == null || !isCachedPreview(row.data)) continue;
    previews.push({
      path,
      data: stripSignedUrl(file),
      ast: row.data.ast,
      figures: row.data.figures,
      previewUnavailable: row.data.previewUnavailable,
    });
  }
  return sortPreviewsByOrder(previews);
}

/**
 * Attach a signed read URL to each candidate figure so the client can render the
 * thumbnail without the bytes ever entering the loader payload. Best-effort per
 * figure: a signing failure leaves that figure without a URL.
 */
export async function signPreviewFigures(
  previews: DocumentPreviewItem[],
  cdn: string,
  ctx: Context,
): Promise<DocumentPreviewItem[]> {
  if (!cdn) return previews;
  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const bucket = resolveThumbnailBucket(ctx, backend, cdn);
  return Promise.all(
    previews.map(async (item) => {
      if (item.figures.length === 0) return item;
      const figures = await Promise.all(
        item.figures.map(async (fig) => {
          try {
            const signedUrl = await new File(backend, fig.key, bucket).url();
            return { ...fig, signedUrl };
          } catch (err) {
            console.warn('signPreviewFigures: failed to sign figure', fig.key, err);
            return fig;
          }
        }),
      );
      return { ...item, figures };
    }),
  );
}

/**
 * Read the set of valid candidate figure storage keys for a work version (from cache).
 * Used to validate a submitted thumbnail locator before persisting it.
 */
export async function readPreviewFigureKeysForVersion(workVersionId: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const work = await findWorkByVersion(workVersionId);
  const rawMetadata = work?.metadata as Record<string, unknown> | undefined;
  const files = rawMetadata?.files as Record<string, FileMetadataSectionItem> | undefined;
  if (!files || typeof files !== 'object') return keys;

  const md5s = Object.values(files)
    .filter((file) => isPreviewCandidate(file))
    .map((file) => file.md5)
    .filter((md5): md5 is string => typeof md5 === 'string' && md5.length > 0);
  if (md5s.length === 0) return keys;

  const prisma = await getPrismaClient();
  const rows = await prisma.object.findMany({
    where: { id: { in: md5s.map((md5) => documentPreviewCacheId(md5)) } },
    select: { data: true },
  });
  for (const row of rows) {
    if (!isCachedPreview(row.data)) continue;
    for (const fig of row.data.figures) {
      if (fig.key) keys.add(fig.key);
    }
  }
  return keys;
}

/**
 * Remove preview artifacts for a work version: the candidate figure webp files in
 * storage (except `keepKey`, typically the selected thumbnail) and the cached preview
 * rows in the Object table (current + legacy prefixes).
 *
 * Called after a successful `confirm-work`. Best-effort: never throws.
 *
 * The cache is content-addressed by md5, so in the rare case another draft uploaded
 * the byte-identical file, its cache is dropped too — that's fine, it regenerates.
 */
export async function deletePreviewArtifactsForVersion(
  workVersionId: string,
  ctx: Context,
  opts?: { keepKey?: string | null },
): Promise<{ rows: number; files: number }> {
  try {
    const work = await findWorkByVersion(workVersionId);
    const rawMetadata = work?.metadata as Record<string, unknown> | undefined;
    const files = rawMetadata?.files as Record<string, FileMetadataSectionItem> | undefined;
    if (!files || typeof files !== 'object') return { rows: 0, files: 0 };

    const md5s = Object.values(files)
      .filter((file) => isPreviewCandidate(file))
      .map((file) => file.md5)
      .filter((md5): md5 is string => typeof md5 === 'string' && md5.length > 0);
    if (md5s.length === 0) return { rows: 0, files: 0 };

    const prisma = await getPrismaClient();
    const currentIds = md5s.map((md5) => documentPreviewCacheId(md5));

    // Remove unselected candidate figure files from storage (current-format rows only).
    let filesDeleted = 0;
    const cdn = work?.cdn ?? '';
    if (cdn) {
      const rows = await prisma.object.findMany({
        where: { id: { in: currentIds } },
        select: { data: true },
      });
      const keep = opts?.keepKey ?? null;
      const keysToDelete = new Set<string>();
      for (const row of rows) {
        if (!isCachedPreview(row.data)) continue;
        for (const fig of row.data.figures) {
          if (fig.key && fig.key !== keep) keysToDelete.add(fig.key);
        }
      }
      if (keysToDelete.size > 0) {
        const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
        const bucket = resolveThumbnailBucket(ctx, backend, cdn);
        await Promise.all(
          Array.from(keysToDelete).map(async (key) => {
            try {
              await new File(backend, key, bucket).delete();
              filesDeleted += 1;
            } catch (err) {
              console.warn('deletePreviewArtifactsForVersion: failed to delete figure', key, err);
            }
          }),
        );
      }
    }

    const cacheIds = Array.from(
      new Set([
        ...currentIds,
        ...md5s.flatMap((md5) => LEGACY_PREVIEW_CACHE_PREFIXES.map((prefix) => `${prefix}${md5}`)),
      ]),
    );
    const { count } = await prisma.object.deleteMany({ where: { id: { in: cacheIds } } });
    return { rows: count, files: filesDeleted };
  } catch (err) {
    console.warn('deletePreviewArtifactsForVersion: cleanup failed', workVersionId, err);
    return { rows: 0, files: 0 };
  }
}
