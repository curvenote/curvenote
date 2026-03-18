import { Suspense, useEffect } from 'react';
import { Await, useFetcher } from 'react-router';
import { FilePlus, Loader2 } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { TimelineItemPlain, TimelineItemExpandable } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import type { LinkedJobsByWorkVersionId } from '../types';

/** File entry in work version metadata.files (may include signedUrl when loaded for details). */
type MetadataFileItem = {
  name?: string;
  path?: string;
  label?: string;
  signedUrl?: string;
  size?: number;
};

function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || typeof bytes !== 'number' || bytes < 0) return '';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${value} ${units[i]}`;
}

function isDocxFile(file: MetadataFileItem): boolean {
  const raw = (file?.name ?? file?.path ?? file?.label ?? '').toLowerCase();
  return raw.endsWith('.docx');
}

function isPdfFile(file: MetadataFileItem): boolean {
  const raw = (file?.name ?? file?.path ?? file?.label ?? '').toLowerCase();
  return raw.endsWith('.pdf');
}

type VersionCreatedTimelineItemProps = {
  dateCreated: string;
  /** Work owner/creator display name; if not set, shown as "owner" */
  ownerName?: string | null;
  /** Work version metadata; if it contains files, the row is expandable with a downloadable file list */
  metadata?: unknown;
  workVersionId?: string;
  basePath?: string;
  canExport?: boolean;
  linkedJobsByWorkVersionIdPromise?: Promise<LinkedJobsByWorkVersionId>;
};

/**
 * Timeline row for "Work version created by {owner}" – the work version anchor for this section.
 * If metadata.files exists, the row is expandable and shows a list of downloadable files (signed links).
 * When there is a Word doc but no PDF and user can export, the tray shows a "Generate PDF" button.
 */
export function VersionCreatedTimelineItem({
  dateCreated,
  ownerName,
  metadata,
  workVersionId,
  basePath,
  canExport,
  linkedJobsByWorkVersionIdPromise,
}: VersionCreatedTimelineItemProps) {
  const fetcher = useFetcher<{
    success?: boolean;
    jobId?: string;
    error?: { type: string; message: string };
  }>();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.error) {
      ui.toastError(fetcher.data.error.message);
    }
  }, [fetcher.state, fetcher.data]);

  const by = ownerName?.trim() ? ownerName : 'owner';
  const message = <>New Version created by {by}</>;
  const date = <DateWithPopover date={dateCreated} />;

  const files =
    metadata != null && typeof metadata === 'object' && 'files' in metadata
      ? (metadata as { files?: Record<string, MetadataFileItem> }).files
      : undefined;
  const hasFiles = files != null && typeof files === 'object' && Object.keys(files).length > 0;
  const hasDocx = hasFiles && Object.values(files!).some(isDocxFile);
  const hasPdf = hasFiles && Object.values(files!).some(isPdfFile);
  const showGeneratePdf =
    false && // TODO: temporarily disabled here pending async dispatching
    canExport &&
    hasDocx &&
    !hasPdf &&
    workVersionId != null &&
    basePath != null &&
    linkedJobsByWorkVersionIdPromise != null;

  const generatePdfButton = showGeneratePdf ? (
    <Suspense fallback={null}>
      <Await resolve={linkedJobsByWorkVersionIdPromise!} errorElement={null}>
        {(resolved: LinkedJobsByWorkVersionId) => {
          const linkedJobs = resolved[workVersionId!] ?? [];
          const isExporting =
            linkedJobs.some((j) => j.status === 'QUEUED') ||
            linkedJobs.some((j) => j.status === 'RUNNING');
          const isSubmitting = fetcher.state !== 'idle';
          const disabled = isExporting || isSubmitting;
          return (
            <ui.Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                fetcher.submit(
                  { intent: 'export-to-pdf', workVersionId: workVersionId! },
                  { method: 'post', action: basePath! },
                );
              }}
            >
              {(isSubmitting || isExporting) && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
              )}
              {isSubmitting || isExporting ? 'Generating…' : 'Generate PDF'}
            </ui.Button>
          );
        }}
      </Await>
    </Suspense>
  ) : null;

  const fileListTray = hasFiles ? (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
          Files
        </span>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {Object.entries(files!).map(([, file]) => {
            const name = file?.name ?? file?.label ?? 'Download';
            const sizeStr = formatFileSize(file?.size);
            const label = sizeStr ? `${name} (${sizeStr})` : name;
            const href = file?.signedUrl;
            if (!href) {
              return (
                <li key={file?.path ?? name} className="text-sm text-muted-foreground">
                  {label}
                </li>
              );
            }
            return (
              <li key={file?.path ?? name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      {generatePdfButton}
    </div>
  ) : null;

  if (hasFiles) {
    return (
      <TimelineItemExpandable icon={<FilePlus aria-hidden />} message={message} date={date}>
        {fileListTray}
      </TimelineItemExpandable>
    );
  }

  return <TimelineItemPlain icon={<FilePlus aria-hidden />} message={message} date={date} />;
}
