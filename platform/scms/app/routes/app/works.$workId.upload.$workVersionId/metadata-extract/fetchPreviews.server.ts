/**
 * Server-side document preview fetching for a work version.
 *
 * Two-phase pipeline:
 * - Phase A (fetch-previews): fast first-page text AST cached without figures.
 * - Phase B (fetch-preview-figures): deferred attachment extraction + thumbnail storage.
 *
 * PDF phase A uses a pdfjs first-page fast path; DOCX uses officeparser without attachments.
 * Phase B re-parses with officeparser + extractAttachments (v1 tradeoff).
 */

import {
  File,
  KnownBuckets,
  StorageBackend,
  findWorkByVersion,
  getPrismaClient,
  resolveThumbnailBucket,
  safeWorkVersionJsonUpdate,
  signFilesInMetadata,
} from '@curvenote/scms-server';
import {
  computeManuscriptSourceSignature,
  UPLOAD_ANALYSIS_METADATA_KEY,
  type FileMetadataSectionItem,
  type UploadFactPresence,
} from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { formatDate } from '@curvenote/common';
import type { OfficeAttachment } from 'officeparser';
import pLimit from 'p-limit';
import { isPreviewCandidate } from './previewGuards';
import { downscaleToWebp, isRenderableFigureMime } from './imagePipeline.server';
import {
  documentPreviewCacheId,
  legacyPreviewCacheIds,
  previewCacheObjectIds,
} from './previewCache';
import {
  emptyPreviewAst,
  truncateAstToFirstPage,
  type PreviewAstData,
} from './previewAstUtils.server';

/** Longest edge (px) of a downscaled candidate figure thumbnail. */
const PREVIEW_FIGURE_MAX_EDGE = 384;

/** webp quality for downscaled candidate figure thumbnails. */
const PREVIEW_FIGURE_WEBP_QUALITY = 70;

/** Maximum number of candidate figures to extract/store per document. */
const MAX_PREVIEW_FIGURES = 24;

/** Parallel figure downscale + storage writes during phase B. */
const FIGURE_EXTRACTION_CONCURRENCY = 4;

/** Skip preview generation for source files larger than this (protects against OOM). */
const MAX_PREVIEW_SOURCE_BYTES = 100 * 1024 * 1024;

/** Storage key for a downscaled candidate figure, under the source file's thumbnails/ dir. */
function thumbnailKeyForFigure(sourcePath: string, md5: string, index: number): string {
  const slashIdx = sourcePath.lastIndexOf('/');
  const dir = slashIdx >= 0 ? sourcePath.slice(0, slashIdx) : '';
  const fileName = `preview-${md5}-${index}.webp`;
  return dir ? `${dir}/thumbnails/${fileName}` : `thumbnails/${fileName}`;
}

/** A candidate thumbnail figure, referenced by storage key (never base64). */
export interface PreviewFigure {
  key: string;
  name?: string;
  altText?: string;
  signedUrl?: string;
}

export const METADATA_THUMBNAILS_KEY = 'thumbnails';

export interface StoredThumbnail {
  key: string;
  sourcePath: string;
  md5: string;
  name?: string;
  altText?: string;
}

export type { PreviewAstData };

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

export interface FetchPreviewsResult {
  previews: DocumentPreviewItem[];
}

interface CachedPreview {
  ast: PreviewAstData;
  figures: PreviewFigure[];
  previewUnavailable?: boolean;
  figuresExtractionSkipped?: boolean;
  figuresPending?: boolean;
}

interface PreviewWorkContext {
  workVersionId: string;
  rawMetadata: Record<string, unknown>;
  previewEntries: [string, FileMetadataSectionItem & { signedUrl?: string }][];
  backend: StorageBackend;
  figureBucket: KnownBuckets | null;
  prisma: Awaited<ReturnType<typeof getPrismaClient>>;
}

export function resolvePreviewImagePresence(
  previewCandidatePaths: string[],
  previews: Pick<
    DocumentPreviewItem,
    'path' | 'figures' | 'previewUnavailable' | 'figuresExtractionSkipped' | 'figuresPending'
  >[],
): UploadFactPresence {
  if (previewCandidatePaths.length === 0) return 'unknown';
  const previewPaths = new Set(previews.map((preview) => preview.path));
  const hasMissingPreview = previewCandidatePaths.some((path) => !previewPaths.has(path));
  if (hasMissingPreview || previews.some((preview) => preview.previewUnavailable === true)) {
    return 'unknown';
  }
  if (previews.some((preview) => preview.figuresPending === true)) {
    return 'unknown';
  }
  if (previews.some((preview) => preview.figures.length > 0)) {
    return 'present';
  }
  if (previews.some((preview) => preview.figuresExtractionSkipped === true)) {
    return 'unknown';
  }
  const allConfidentlyAbsent = previews.every(
    (preview) => preview.figuresExtractionSkipped === false && preview.figures.length === 0,
  );
  return allConfidentlyAbsent && previews.length > 0 ? 'absent' : 'unknown';
}

async function persistPreviewUploadAnalysis({
  workVersionId,
  rawMetadata,
  previewCandidatePaths,
  previews,
}: {
  workVersionId: string;
  rawMetadata: Record<string, unknown>;
  previewCandidatePaths: string[];
  previews: DocumentPreviewItem[];
}): Promise<void> {
  const sourceSignature = computeManuscriptSourceSignature(rawMetadata);
  if (!sourceSignature) return;
  const images = resolvePreviewImagePresence(previewCandidatePaths, previews);
  await safeWorkVersionJsonUpdate(workVersionId, (current?: Prisma.JsonValue) => {
    const meta = (current as Record<string, unknown>) ?? {};
    const existingAnalysis = meta[UPLOAD_ANALYSIS_METADATA_KEY];
    const baseAnalysis =
      existingAnalysis &&
      typeof existingAnalysis === 'object' &&
      !Array.isArray(existingAnalysis) &&
      (existingAnalysis as { sourceSignature?: unknown }).sourceSignature === sourceSignature
        ? (existingAnalysis as Record<string, unknown>)
        : {};
    return {
      ...meta,
      [UPLOAD_ANALYSIS_METADATA_KEY]: {
        ...baseAnalysis,
        source: 'metadata-preview',
        sourceSignature,
        document: {
          ...((baseAnalysis.document as Record<string, unknown> | undefined) ?? {}),
          images,
        },
      },
    } as unknown as Prisma.JsonObject;
  });
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

function cachedToDocumentPreviewItem(
  path: string,
  file: FileMetadataSectionItem & { signedUrl?: string },
  cached: CachedPreview,
): DocumentPreviewItem {
  return {
    path,
    data: stripSignedUrl(file),
    ast: cached.ast,
    figures: cached.figures,
    previewUnavailable: cached.previewUnavailable,
    figuresExtractionSkipped: cached.figuresExtractionSkipped,
    figuresPending: cached.figuresPending,
  };
}

function isPdfFile(path: string, file: FileMetadataSectionItem): boolean {
  if (path.toLowerCase().endsWith('.pdf')) return true;
  return file.type?.toLowerCase() === 'application/pdf';
}

function isDocxFile(path: string, file: FileMetadataSectionItem): boolean {
  const lower = path.toLowerCase();
  if (lower.endsWith('.docx') || lower.endsWith('.docm')) return true;
  const type = file.type?.toLowerCase() ?? '';
  return (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/vnd.ms-word.document.macroenabled.12'
  );
}

async function downloadPreviewSource(signedUrl: string): Promise<ArrayBuffer | null> {
  const response = await fetch(signedUrl);
  if (!response.ok) return null;
  return response.arrayBuffer();
}

async function parseOfficeTextOnly(
  arrayBuffer: ArrayBuffer,
  sourcePath: string,
): Promise<PreviewAstData> {
  const { parseOfficeFromBuffer } = await import('./parseOfficeFromBuffer.server');
  const fullAst = await parseOfficeFromBuffer(arrayBuffer, sourcePath, {
    extractAttachments: false,
    newlineDelimiter: '\n',
  });
  return truncateAstToFirstPage(fullAst);
}

async function generatePhaseATextAst(
  path: string,
  file: FileMetadataSectionItem,
  arrayBuffer: ArrayBuffer,
): Promise<PreviewAstData> {
  if (isPdfFile(path, file)) {
    const { parsePdfFirstPagePreview, isPdfFastPathTextSufficient } =
      await import('./pdfFirstPagePreview.server');
    const fastAst = await parsePdfFirstPagePreview(arrayBuffer);
    if (isPdfFastPathTextSufficient(fastAst)) {
      return fastAst;
    }
    return parseOfficeTextOnly(arrayBuffer, path);
  }
  if (isDocxFile(path, file)) {
    return parseOfficeTextOnly(arrayBuffer, path);
  }
  const { parseOfficeFromBuffer } = await import('./parseOfficeFromBuffer.server');
  const fullAst = await parseOfficeFromBuffer(arrayBuffer, path, {
    extractAttachments: false,
    newlineDelimiter: '\n',
  });
  return truncateAstToFirstPage(fullAst);
}

async function extractAndStoreFigures(
  attachments: OfficeAttachment[],
  opts: { sourcePath: string; md5: string; backend: StorageBackend; bucket: KnownBuckets },
): Promise<PreviewFigure[]> {
  const images = attachments
    .filter(
      (att) =>
        att.type === 'image' &&
        typeof att.data === 'string' &&
        att.data.length > 0 &&
        isRenderableFigureMime(att.mimeType),
    )
    .slice(0, MAX_PREVIEW_FIGURES);

  const limit = pLimit(FIGURE_EXTRACTION_CONCURRENCY);
  const results = await Promise.all(
    images.map((att, index) =>
      limit(async (): Promise<PreviewFigure | null> => {
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
          return { key, name: att.name, altText: att.altText };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(
            'extractAndStoreFigures: skipped figure (decode failed)',
            opts.sourcePath,
            att.mimeType,
            message,
          );
          return null;
        }
      }),
    ),
  );
  return results.filter((fig): fig is PreviewFigure => fig != null);
}

async function loadPreviewWorkContext(
  workVersionId: string,
  ctx: Context,
): Promise<PreviewWorkContext | null> {
  const work = await findWorkByVersion(workVersionId);
  if (!work?.metadata) return null;

  const rawMetadata = work.metadata as Record<string, unknown>;
  const files = rawMetadata?.files as Record<string, FileMetadataSectionItem> | undefined;
  if (!files || typeof files !== 'object') return null;

  const cdn = work.cdn ?? '';
  const signedMetadata = await signFilesInMetadata(
    { ...rawMetadata, files } as Parameters<typeof signFilesInMetadata>[0],
    cdn,
    ctx,
  );
  const signedFiles = signedMetadata.files ?? {};
  const previewEntries = Object.entries(signedFiles).filter(([, file]) =>
    isPreviewCandidate(file),
  ) as [string, FileMetadataSectionItem & { signedUrl?: string }][];

  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const figureBucket = cdn ? resolveThumbnailBucket(ctx, backend, cdn) : null;
  const prisma = await getPrismaClient();

  return {
    workVersionId,
    rawMetadata,
    previewEntries,
    backend,
    figureBucket,
    prisma,
  };
}

async function readCachedPreview(
  prisma: Awaited<ReturnType<typeof getPrismaClient>>,
  cacheId: string | null,
): Promise<CachedPreview | null> {
  if (!cacheId) return null;
  const row = await prisma.object.findUnique({
    where: { id: cacheId },
    select: { data: true },
  });
  if (row?.data != null && isCachedPreview(row.data)) {
    return row.data;
  }
  return null;
}

async function writePhaseACache(
  ctx: Context,
  prisma: Awaited<ReturnType<typeof getPrismaClient>>,
  cacheId: string,
  cached: CachedPreview,
): Promise<void> {
  const now = formatDate();
  try {
    await prisma.object.createMany({
      data: [
        {
          id: cacheId,
          type: cacheId,
          date_created: now,
          date_modified: now,
          data: cached as object,
          occ: 0,
          ...(ctx.user?.id ? { created_by_id: ctx.user.id } : {}),
        },
      ],
      skipDuplicates: true,
    });
  } catch (createErr: unknown) {
    console.warn('fetchDocumentPreviewText: failed to cache preview', cacheId, createErr);
  }
}

async function updatePhaseBCache(
  prisma: Awaited<ReturnType<typeof getPrismaClient>>,
  cacheId: string,
  cached: CachedPreview,
): Promise<void> {
  const now = formatDate();
  try {
    await prisma.object.update({
      where: { id: cacheId },
      data: {
        date_modified: now,
        data: cached as object,
      },
    });
  } catch (updateErr: unknown) {
    console.warn('fetchDocumentPreviewFigures: failed to update preview cache', cacheId, updateErr);
  }
}

/**
 * Phase A: cache first-page text AST without figure extraction.
 */
export async function fetchDocumentPreviewText(
  workVersionId: string,
  ctx: Context,
): Promise<FetchPreviewsResult> {
  const previewCtx = await loadPreviewWorkContext(workVersionId, ctx);
  if (!previewCtx) return { previews: [] };

  const { rawMetadata, previewEntries, figureBucket, prisma } = previewCtx;
  const previews: DocumentPreviewItem[] = [];

  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId =
      typeof md5 === 'string' && md5 ? documentPreviewCacheId(workVersionId, md5) : null;

    let cached = await readCachedPreview(prisma, cacheId);

    if (!cached) {
      const size = typeof file.size === 'number' ? file.size : 0;
      if (size > MAX_PREVIEW_SOURCE_BYTES) {
        console.warn('fetchDocumentPreviewText: source too large, skipping preview', path, size);
        cached = {
          ast: emptyPreviewAst(path),
          figures: [],
          previewUnavailable: true,
          figuresExtractionSkipped: true,
          figuresPending: false,
        };
      } else {
        const signedUrl = file.signedUrl;
        if (!signedUrl || typeof signedUrl !== 'string') {
          console.warn('fetchDocumentPreviewText: no signedUrl for preview candidate', path);
          continue;
        }
        try {
          const arrayBuffer = await downloadPreviewSource(signedUrl);
          if (!arrayBuffer) {
            console.warn('fetchDocumentPreviewText: download failed', path);
            continue;
          }
          const ast = await generatePhaseATextAst(path, file, arrayBuffer);
          const canExtractFigures = Boolean(figureBucket && cacheId);
          cached = {
            ast,
            figures: [],
            previewUnavailable: false,
            figuresExtractionSkipped: !canExtractFigures,
            figuresPending: canExtractFigures,
          };
        } catch (err) {
          console.warn('fetchDocumentPreviewText: parse failed', path, err);
          continue;
        }
      }

      if (cacheId) {
        await writePhaseACache(ctx, prisma, cacheId, cached);
      }
    }

    previews.push(cachedToDocumentPreviewItem(path, file, cached));
  }

  const sortedPreviews = sortPreviewsByOrder(previews);
  try {
    await persistPreviewUploadAnalysis({
      workVersionId,
      rawMetadata,
      previewCandidatePaths: previewEntries.map(([path]) => path),
      previews: sortedPreviews,
    });
  } catch (err) {
    console.warn('fetchDocumentPreviewText: failed to persist upload analysis', workVersionId, err);
  }

  return { previews: sortedPreviews };
}

/**
 * Phase B: extract and store candidate figures for previews marked figuresPending.
 */
export async function fetchDocumentPreviewFigures(
  workVersionId: string,
  ctx: Context,
): Promise<FetchPreviewsResult> {
  const previewCtx = await loadPreviewWorkContext(workVersionId, ctx);
  if (!previewCtx) return { previews: [] };

  const { rawMetadata, previewEntries, backend, figureBucket, prisma } = previewCtx;
  const previews: DocumentPreviewItem[] = [];
  let anyFiguresUpdated = false;

  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId =
      typeof md5 === 'string' && md5 ? documentPreviewCacheId(workVersionId, md5) : null;

    const cached = await readCachedPreview(prisma, cacheId);
    if (!cached) continue;

    if (cached.figuresPending !== true) {
      previews.push(cachedToDocumentPreviewItem(path, file, cached));
      continue;
    }

    if (!figureBucket || !cacheId) {
      cached.figuresPending = false;
      cached.figuresExtractionSkipped = true;
      if (cacheId) {
        await updatePhaseBCache(prisma, cacheId, cached);
      }
      previews.push(cachedToDocumentPreviewItem(path, file, cached));
      continue;
    }

    const signedUrl = file.signedUrl;
    if (!signedUrl || typeof signedUrl !== 'string') {
      console.warn('fetchDocumentPreviewFigures: no signedUrl', path);
      previews.push(cachedToDocumentPreviewItem(path, file, cached));
      continue;
    }

    try {
      const arrayBuffer = await downloadPreviewSource(signedUrl);
      if (!arrayBuffer) {
        console.warn('fetchDocumentPreviewFigures: download failed', path);
        previews.push(cachedToDocumentPreviewItem(path, file, cached));
        continue;
      }

      const { parseOfficeFromBuffer } = await import('./parseOfficeFromBuffer.server');
      const fullAst = await parseOfficeFromBuffer(arrayBuffer, path, {
        extractAttachments: true,
        newlineDelimiter: '\n',
      });
      const figures = await extractAndStoreFigures(fullAst.attachments ?? [], {
        sourcePath: path,
        md5: md5 as string,
        backend,
        bucket: figureBucket,
      });

      const updated: CachedPreview = {
        ...cached,
        figures,
        figuresPending: false,
        figuresExtractionSkipped: false,
      };
      await updatePhaseBCache(prisma, cacheId, updated);
      anyFiguresUpdated = true;
      previews.push(cachedToDocumentPreviewItem(path, file, updated));
    } catch (err) {
      console.warn('fetchDocumentPreviewFigures: figure extraction failed', path, err);
      previews.push(cachedToDocumentPreviewItem(path, file, cached));
    }
  }

  if (anyFiguresUpdated) {
    const allPreviews = await readDocumentPreviewsFromObjectTable(workVersionId, {
      files: Object.fromEntries(previewEntries.map(([path, f]) => [path, stripSignedUrl(f)])),
    });
    try {
      await persistPreviewUploadAnalysis({
        workVersionId,
        rawMetadata,
        previewCandidatePaths: previewEntries.map(([path]) => path),
        previews: allPreviews,
      });
    } catch (err) {
      console.warn(
        'fetchDocumentPreviewFigures: failed to persist upload analysis',
        workVersionId,
        err,
      );
    }
    return { previews: allPreviews };
  }

  return { previews: sortPreviewsByOrder(previews) };
}

/** @deprecated Use fetchDocumentPreviewText. Kept for internal callers/tests. */
export async function fetchDocumentPreviews(
  workVersionId: string,
  ctx: Context,
): Promise<FetchPreviewsResult> {
  return fetchDocumentPreviewText(workVersionId, ctx);
}

export async function handleFetchPreviewsIntent(
  workVersionId: string | undefined,
  ctx: Context,
): Promise<{ previews: DocumentPreviewItem[] }> {
  if (!workVersionId) {
    throw new Error('Work version ID is required');
  }
  const result = await fetchDocumentPreviewText(workVersionId, ctx);
  return { previews: result.previews };
}

export async function handleFetchPreviewFiguresIntent(
  workVersionId: string | undefined,
  ctx: Context,
): Promise<{ previews: DocumentPreviewItem[] }> {
  if (!workVersionId) {
    throw new Error('Work version ID is required');
  }
  const result = await fetchDocumentPreviewFigures(workVersionId, ctx);
  return { previews: result.previews };
}

export async function readDocumentPreviewsFromObjectTable(
  workVersionId: string,
  metadata: {
    files?: Record<string, FileMetadataSectionItem & { signedUrl?: string }>;
  },
): Promise<DocumentPreviewItem[]> {
  const files = metadata.files ?? {};
  if (typeof files !== 'object') {
    return [];
  }
  const previewEntries = Object.entries(files).filter(([, file]) => isPreviewCandidate(file));
  const prisma = await getPrismaClient();
  const previews: DocumentPreviewItem[] = [];
  for (const [path, file] of previewEntries) {
    const md5 = file.md5;
    const cacheId =
      typeof md5 === 'string' && md5 ? documentPreviewCacheId(workVersionId, md5) : null;
    if (!cacheId) continue;
    const row = await prisma.object.findUnique({
      where: { id: cacheId },
      select: { data: true },
    });
    if (row?.data == null || !isCachedPreview(row.data)) continue;
    previews.push(cachedToDocumentPreviewItem(path, file, row.data));
  }
  return sortPreviewsByOrder(previews);
}

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
    where: { id: { in: md5s.map((md5) => documentPreviewCacheId(workVersionId, md5)) } },
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

export async function collectStoredThumbnailsForVersion(
  workVersionId: string,
): Promise<StoredThumbnail[]> {
  const work = await findWorkByVersion(workVersionId);
  const rawMetadata = work?.metadata as Record<string, unknown> | undefined;
  const files = rawMetadata?.files as Record<string, FileMetadataSectionItem> | undefined;
  if (!files || typeof files !== 'object') return [];

  const metaByCacheId = new Map<string, { md5: string; sourcePath: string }>();
  for (const [sourcePath, file] of Object.entries(files)) {
    if (!isPreviewCandidate(file)) continue;
    const md5 = file.md5;
    if (typeof md5 === 'string' && md5.length > 0) {
      metaByCacheId.set(documentPreviewCacheId(workVersionId, md5), { md5, sourcePath });
    }
  }
  if (metaByCacheId.size === 0) return [];

  const prisma = await getPrismaClient();
  const rows = await prisma.object.findMany({
    where: { id: { in: Array.from(metaByCacheId.keys()) } },
    select: { id: true, data: true },
  });

  const thumbnails: StoredThumbnail[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isCachedPreview(row.data)) continue;
    const meta = metaByCacheId.get(row.id);
    if (!meta) continue;
    for (const fig of row.data.figures) {
      if (!fig.key || seen.has(fig.key)) continue;
      seen.add(fig.key);
      thumbnails.push({
        key: fig.key,
        sourcePath: meta.sourcePath,
        md5: meta.md5,
        ...(fig.name ? { name: fig.name } : {}),
        ...(fig.altText ? { altText: fig.altText } : {}),
      });
    }
  }
  return thumbnails;
}

export async function persistThumbnailListingForVersion(
  workVersionId: string,
): Promise<StoredThumbnail[]> {
  const thumbnails = await collectStoredThumbnailsForVersion(workVersionId);
  if (thumbnails.length === 0) return [];
  await safeWorkVersionJsonUpdate(workVersionId, (current?: Prisma.JsonValue) => {
    const meta = (current as Record<string, unknown>) ?? {};
    const existingRaw = meta[METADATA_THUMBNAILS_KEY];
    const existing = Array.isArray(existingRaw) ? (existingRaw as StoredThumbnail[]) : [];
    const byKey = new Map<string, StoredThumbnail>();
    for (const t of existing) if (t?.key) byKey.set(t.key, t);
    for (const t of thumbnails) byKey.set(t.key, t);
    return {
      ...meta,
      [METADATA_THUMBNAILS_KEY]: Array.from(byKey.values()),
    } as unknown as Prisma.JsonObject;
  });
  return thumbnails;
}

export async function deletePreviewArtifactsForVersion(
  workVersionId: string,
): Promise<{ rows: number }> {
  try {
    const work = await findWorkByVersion(workVersionId);
    const metadata = work?.metadata as Record<string, unknown> | undefined;
    const cacheIds = Array.from(
      new Set([
        ...previewCacheObjectIds(workVersionId, metadata),
        ...legacyPreviewCacheIds(metadata),
      ]),
    );
    if (cacheIds.length === 0) return { rows: 0 };

    const prisma = await getPrismaClient();
    const { count } = await prisma.object.deleteMany({ where: { id: { in: cacheIds } } });
    return { rows: count };
  } catch (err) {
    console.warn('deletePreviewArtifactsForVersion: cleanup failed', workVersionId, err);
    return { rows: 0 };
  }
}

// Re-export AST helpers used by anthropic.server and tests.
export {
  astContentToPlainText,
  truncateAstToFirstPage,
  shouldIncludeSecondPage,
} from './previewAstUtils.server';
