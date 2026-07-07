import type {
  UploadCheckEligibilityContext,
  UploadFactPresence,
} from '../modules/extensions/types.js';

/** MIME type for `.docx` as stored on work version `metadata.files` entries. */
export const WORK_VERSION_DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const UPLOAD_ANALYSIS_METADATA_KEY = 'upload.analysis';

export type WorkVersionFileEntry = {
  name?: string;
  size?: number;
  type?: string;
  path?: string;
  slot?: string;
  md5?: string;
};

type FileEntryLike = WorkVersionFileEntry;

export interface UploadAnalysisMetadata {
  source?: 'metadata-preview' | string;
  sourceSignature?: string;
  document?: {
    images?: UploadFactPresence;
  };
  metadata?: {
    title?: UploadFactPresence;
    authors?: UploadFactPresence;
    affiliations?: UploadFactPresence;
  };
}

const UNKNOWN_UPLOAD_CHECK_ELIGIBILITY_CONTEXT: UploadCheckEligibilityContext = {
  document: { images: 'unknown' },
  metadata: {
    title: 'unknown',
    authors: 'unknown',
    affiliations: 'unknown',
  },
};

function isUploadFactPresence(value: unknown): value is UploadFactPresence {
  return value === 'present' || value === 'absent' || value === 'unknown';
}

function readUploadAnalysisMetadata(metadata: unknown): UploadAnalysisMetadata | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const analysis = (metadata as Record<string, unknown>)[UPLOAD_ANALYSIS_METADATA_KEY];
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return undefined;
  return analysis as UploadAnalysisMetadata;
}

/**
 * Files in `metadata.files` for a given upload slot.
 */
export function getFilesForSlot(metadata: unknown, slot: string): WorkVersionFileEntry[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return [];
  return Object.values(files).filter(
    (f): f is WorkVersionFileEntry =>
      f != null && typeof f === 'object' && (f as WorkVersionFileEntry).slot === slot,
  );
}

/**
 * Stable source signature for manuscript files that feed upload analysis.
 */
export function computeManuscriptSourceSignature(metadata: unknown): string {
  return getFilesForSlot(metadata, 'manuscript')
    .map((f) => (typeof f.md5 === 'string' && f.md5 ? f.md5 : f.path))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .join(',');
}

/**
 * Upload check eligibility facts derived from persisted upload analysis metadata.
 *
 * Missing, malformed, or stale analysis is treated as unknown so checks keep their
 * existing behavior unless analysis confidently proves a fact.
 */
export function getUploadCheckEligibilityContext(metadata: unknown): UploadCheckEligibilityContext {
  const analysis = readUploadAnalysisMetadata(metadata);
  if (!analysis) return UNKNOWN_UPLOAD_CHECK_ELIGIBILITY_CONTEXT;

  const currentSignature = computeManuscriptSourceSignature(metadata);
  if (
    !analysis.sourceSignature ||
    !currentSignature ||
    analysis.sourceSignature !== currentSignature
  ) {
    return UNKNOWN_UPLOAD_CHECK_ELIGIBILITY_CONTEXT;
  }

  return {
    document: {
      images: isUploadFactPresence(analysis.document?.images)
        ? analysis.document.images
        : 'unknown',
    },
    metadata: {
      title: isUploadFactPresence(analysis.metadata?.title) ? analysis.metadata.title : 'unknown',
      authors: isUploadFactPresence(analysis.metadata?.authors)
        ? analysis.metadata.authors
        : 'unknown',
      affiliations: isUploadFactPresence(analysis.metadata?.affiliations)
        ? analysis.metadata.affiliations
        : 'unknown',
    },
  };
}

export function uploadFactPresenceFromValue(value: unknown): UploadFactPresence {
  if (typeof value === 'string') return value.trim() ? 'present' : 'absent';
  if (Array.isArray(value)) return value.length > 0 ? 'present' : 'absent';
  if (value == null) return 'absent';
  if (typeof value === 'object') return Object.keys(value).length > 0 ? 'present' : 'absent';
  return 'present';
}

/**
 * Whether a file entry is DOCX or PDF (by MIME or extension on name/path).
 */
export function isDocxOrPdfFile(entry: FileEntryLike): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const type = entry.type?.toLowerCase?.();
  const name = (entry.name ?? entry.path ?? '')?.toString?.().toLowerCase?.() ?? '';
  if (type === 'application/pdf') return true;
  if (type === WORK_VERSION_DOCX_MIME) return true;
  if (name.endsWith('.pdf') || name === 'pdf') return true;
  if (name.endsWith('.docx')) return true;
  return false;
}

/**
 * Upload check card interaction state from eligibility and selection.
 * Ineligible checks stay selectable; only a selected ineligible check is shown as invalid.
 */
export function resolveUploadCheckCardState({
  eligible,
  enabled,
  underMaintenance = false,
}: {
  eligible: boolean;
  enabled: boolean;
  underMaintenance?: boolean;
}): { disabled: boolean; invalid: boolean } {
  if (underMaintenance) {
    return { disabled: true, invalid: false };
  }
  if (eligible) {
    return { disabled: false, invalid: false };
  }
  if (enabled) {
    return { disabled: false, invalid: true };
  }
  return { disabled: false, invalid: false };
}

type UploadEligibilityService = {
  id: string;
  isUploadEligible?: (metadata: unknown, context?: UploadCheckEligibilityContext) => boolean;
};

/** True when any enabled check fails its upload eligibility predicate. */
export function hasInvalidEnabledUploadChecks(
  metadata: unknown,
  enabledCheckIds: string[],
  services: UploadEligibilityService[],
  context: UploadCheckEligibilityContext = getUploadCheckEligibilityContext(metadata),
): boolean {
  for (const id of enabledCheckIds) {
    const service = services.find((s) => s.id === id);
    if (service?.isUploadEligible && !service.isUploadEligible(metadata, context)) {
      return true;
    }
  }
  return false;
}

/** True when any enabled check is under maintenance. */
export function hasMaintenanceEnabledUploadChecks(
  enabledCheckIds: string[],
  maintenanceByServiceId: Record<string, { underMaintenance?: boolean }>,
): boolean {
  return enabledCheckIds.some((id) => maintenanceByServiceId[id]?.underMaintenance === true);
}

/**
 * Whether `metadata.files` includes a PDF (by MIME or `.pdf` / `pdf` name/path).
 */
export function hasPdfInMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as FileEntryLike[];
  return entries.some((f) => {
    if (!f || typeof f !== 'object') return false;
    const type = f.type?.toLowerCase?.();
    const name = (f.name ?? f.path ?? '')?.toString?.().toLowerCase?.() ?? '';
    return type === 'application/pdf' || name.endsWith('.pdf') || name === 'pdf';
  });
}

/**
 * Whether `metadata.files` includes a Word document (DOCX MIME or `.docx` name/path).
 */
export function hasDocxInMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as FileEntryLike[];
  return entries.some(
    (f) =>
      f?.type === WORK_VERSION_DOCX_MIME ||
      (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.docx')) ||
      (typeof f?.path === 'string' && f.path.toLowerCase().endsWith('.docx')),
  );
}
