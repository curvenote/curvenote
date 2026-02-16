import { Suspense, useEffect, useState } from 'react';
import { Await, useSearchParams, useFetcher } from 'react-router';
import { cn, formatDate, ui, scopes } from '@curvenote/scms-core';
import type { WorkVersionWithSubmissionVersions } from '../works.$workId/types';
import type { Workflow } from '@curvenote/scms-core';
import { Clock, Loader2, MoreVertical } from 'lucide-react';

export type LinkedJobsByWorkVersionId = Record<string, { id: string; status: string }[]>;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

/** File entry in work version metadata.files (may include signedUrl when loaded for details). */
type MetadataFileItem = {
  name?: string;
  path?: string;
  label?: string;
  type?: string;
  signedUrl?: string;
  size?: number;
};

/** True when the version has files and at least one is a Word document (docx). */
function versionHasDocx(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as MetadataFileItem[];
  return entries.some(
    (f) =>
      f?.type === DOCX_MIME ||
      (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.docx')) ||
      (typeof f?.path === 'string' && f.path.toLowerCase().endsWith('.docx')),
  );
}

/** True when the version has files and at least one is a PDF. */
function versionHasPdf(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const files = meta.files;
  if (!files || typeof files !== 'object') return false;
  const entries = Object.values(files) as MetadataFileItem[];
  return entries.some(
    (f) =>
      f?.type === PDF_MIME ||
      (typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.pdf')) ||
      (typeof f?.path === 'string' && f.path.toLowerCase().endsWith('.pdf')),
  );
}

/** Show Export to PDF menu when version has docx but no PDF (export is needed). */
function versionNeedsExportToPdf(metadata: unknown): boolean {
  return versionHasDocx(metadata) && !versionHasPdf(metadata);
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || typeof bytes !== 'number' || bytes < 0) return '';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${value} ${units[i]}`;
}

function WorkVersionTableRow({
  v,
  idx,
  workflows,
  basePath,
  userScopes,
  canExport,
  linkedJobsByWorkVersionIdPromise,
  fetcher,
  menuOpenId,
  setMenuOpenId,
  includeDrafts,
}: {
  v: WorkVersionWithSubmissionVersions;
  idx: number;
  workflows: Record<string, Workflow>;
  basePath: string;
  userScopes: string[];
  canExport: boolean;
  linkedJobsByWorkVersionIdPromise: Promise<LinkedJobsByWorkVersionId>;
  fetcher: ReturnType<typeof useFetcher>;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  includeDrafts: boolean;
}) {
  const submissionVersionsToShow = includeDrafts
    ? v.submissionVersions
    : v.submissionVersions.filter((sv) => sv.status !== 'DRAFT');

  return (
    <tr className="border-b-[1px] border-gray-300 last:border-none">
      <td
        className={cn('px-4 py-3 text-sm align-middle whitespace-nowrap', {
          'opacity-50': idx !== 0,
          'font-medium': idx === 0,
        })}
      >
        {formatDate(v.date_created, 'MMM dd, y h:mm a ')}
      </td>
      <td
        className={cn('px-4 py-3 text-left align-middle', {
          'opacity-50': idx !== 0,
        })}
      >
        <div className="flex flex-col gap-1">
          {(() => {
            const files = (v.metadata as { files?: Record<string, MetadataFileItem> } | null)
              ?.files;
            if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
              return <span className="text-sm italic text-gray-400">—</span>;
            }
            return (
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {Object.entries(files).map(([, file]) => {
                  const name = file?.name ?? file?.label ?? 'Download';
                  const sizeStr = formatFileSize(file?.size);
                  const label = sizeStr ? `${name} (${sizeStr})` : name;
                  const href = file?.signedUrl;
                  if (!href) {
                    return (
                      <li key={file?.path ?? name} className="text-sm text-gray-500">
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
            );
          })()}
        </div>
      </td>
      <td
        className={cn('px-4 py-3 text-left align-middle', {
          'opacity-50': idx !== 0,
        })}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {submissionVersionsToShow.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {submissionVersionsToShow.map((sv) => (
                <ui.SubmissionVersionBadge
                  key={`submission-badge-${v.id}-${sv.id}`}
                  submissionVersion={sv}
                  workflows={workflows}
                  basePath={basePath}
                  workVersionId={v.id}
                  showSite
                />
              ))}
            </div>
          ) : (
            <span className="text-sm italic text-gray-400">No submissions</span>
          )}
          <Suspense fallback={null}>
            <Await
              resolve={linkedJobsByWorkVersionIdPromise}
              errorElement={null}
            >
              {(resolved) => {
                const linkedJobs = resolved[v.id] ?? [];
                const hasQueued = linkedJobs.some((j) => j.status === 'QUEUED');
                const hasRunning = linkedJobs.some((j) => j.status === 'RUNNING');
                const busyTitle = hasRunning ? 'Exporting' : hasQueued ? 'Waiting to export' : null;
                if (!busyTitle) return null;
                return (
                  <span
                    className="inline-flex items-center text-muted-foreground"
                    title={busyTitle}
                  >
                    {hasRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Clock className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                );
              }}
            </Await>
          </Suspense>
        </div>
      </td>
      {canExport && (
        <td className="px-4 py-3 align-middle w-[80px]">
          {versionNeedsExportToPdf(v.metadata) ? (
            <Suspense fallback={null}>
              <Await
                resolve={linkedJobsByWorkVersionIdPromise}
                errorElement={null}
              >
                {(resolved) => {
                  const linkedJobs = resolved[v.id] ?? [];
                  const hasQueued = linkedJobs.some((j) => j.status === 'QUEUED');
                  const hasRunning = linkedJobs.some((j) => j.status === 'RUNNING');
                  const isExporting = hasQueued || hasRunning;
                  return (
                    <ui.Menu open={menuOpenId === v.id} onOpenChange={(open) => setMenuOpenId(open ? v.id : null)}>
                      <ui.MenuTrigger asChild>
                        <ui.Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Version actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </ui.Button>
                      </ui.MenuTrigger>
                      <ui.MenuContent>
                        <ui.MenuItem
                          disabled={isExporting}
                          onSelect={() => {
                            setMenuOpenId(null);
                            if (isExporting) return;
                            fetcher.submit(
                              { intent: 'export-to-pdf', workVersionId: v.id },
                              { method: 'post', action: basePath },
                            );
                          }}
                        >
                          Export to PDF
                        </ui.MenuItem>
                      </ui.MenuContent>
                    </ui.Menu>
                  );
                }}
              </Await>
            </Suspense>
          ) : null}
        </td>
      )}
    </tr>
  );
}

export function WorkVersionsTable({
  workflows,
  versions,
  basePath,
  userScopes,
  linkedJobsByWorkVersionIdPromise,
}: {
  workflows: Record<string, Workflow>;
  versions: WorkVersionWithSubmissionVersions[];
  basePath: string;
  userScopes: string[];
  linkedJobsByWorkVersionIdPromise: Promise<LinkedJobsByWorkVersionId>;
}) {
  const [searchParams] = useSearchParams();
  const includeDrafts = searchParams.get('drafts') === 'true';
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const fetcher = useFetcher<{ success?: boolean; jobId?: string; error?: { type: string; message: string } }>();

  const canExport = userScopes.includes(scopes.app.works.export);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.error) {
      ui.toastError(fetcher.data.error.message);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <table className="w-full text-left table-fixed dark:text-white">
      <thead>
        <tr className="border-gray-400 border-b-[1px] pointer-events-none">
          <th className="px-4 py-2 w-[180px]">Date</th>
          <th className="px-4 py-2 min-w-[120px]">Files</th>
          <th className="px-4 py-2 min-w-[250px]">Submission Status</th>
          {canExport && <th className="px-4 py-2 w-[80px]" aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {versions.map((v, idx) => (
          <WorkVersionTableRow
            key={v.id}
            v={v}
            idx={idx}
            workflows={workflows}
            basePath={basePath}
            userScopes={userScopes}
            canExport={canExport}
            linkedJobsByWorkVersionIdPromise={linkedJobsByWorkVersionIdPromise}
            fetcher={fetcher}
            menuOpenId={menuOpenId}
            setMenuOpenId={setMenuOpenId}
            includeDrafts={includeDrafts}
          />
        ))}
      </tbody>
    </table>
  );
}
