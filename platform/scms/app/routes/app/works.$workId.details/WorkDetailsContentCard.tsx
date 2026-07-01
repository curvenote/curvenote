import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { primitives, summarizeAuthors, ui } from '@curvenote/scms-core';
import type { WorkVersionContentCardData } from '../works.$workId/types';
import { WorkDoiDialog } from './WorkDoiDialog';

type AuthorLike = { name?: string; family?: string; given?: string };

function getAuthorsForDisplay(version: WorkVersionContentCardData): AuthorLike[] {
  const details = version.author_details;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d) => {
      if (d && typeof d === 'object' && 'name' in d)
        return { name: String((d as { name?: string }).name) };
      if (d && typeof d === 'object' && ('family' in d || 'given' in d))
        return {
          family: (d as { family?: string }).family,
          given: (d as { given?: string }).given,
        };
      return { name: '' };
    });
  }
  return (version.authors ?? []).map((name) => ({ name }));
}

function resolveDisplayDoi(version: WorkVersionContentCardData): string | null {
  const versionDoi = version.doi != null ? String(version.doi).trim() : '';
  if (versionDoi) return versionDoi;
  const workDoi = version.workDoi != null ? String(version.workDoi).trim() : '';
  return workDoi || null;
}

export function WorkDetailsContentCard({
  version,
}: {
  version: WorkVersionContentCardData | null;
}) {
  const [doiDialogOpen, setDoiDialogOpen] = useState(false);

  if (!version) {
    return (
      <primitives.Card className="p-6">
        <p className="text-sm text-muted-foreground">No published version yet.</p>
      </primitives.Card>
    );
  }

  const authorsForDisplay = getAuthorsForDisplay(version);
  const authorSummary = summarizeAuthors(authorsForDisplay, { maxDisplay: 5 }) || 'Unknown authors';
  const licenseDisplay = version.license;
  const displayDoi = resolveDisplayDoi(version);
  const doiHref = displayDoi ? `https://doi.org/${encodeURIComponent(displayDoi)}` : null;
  const showDoiRow = displayDoi != null || version.canEditDoi;

  return (
    <>
      <primitives.Card lift className="px-4 pt-6 pb-4 space-y-2">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          {version.title || 'Untitled Work'}
        </h2>
        <div className="text-base text-muted-foreground">{authorSummary}</div>
        <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm">
          {showDoiRow ? (
            <div>
              <span className="font-medium text-foreground">DOI </span>
              {doiHref ? (
                <>
                  <a
                    href={doiHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex gap-1 items-center font-mono text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {displayDoi}
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                  </a>
                  {version.canEditDoi ? (
                    <>
                      {' '}
                      <ui.Button
                        type="button"
                        variant="link"
                        className="inline h-auto p-0 text-sm"
                        onClick={() => setDoiDialogOpen(true)}
                      >
                        Edit
                      </ui.Button>
                    </>
                  ) : null}
                </>
              ) : (
                <ui.Button
                  type="button"
                  variant="link"
                  className="inline h-auto p-0 font-mono text-sm"
                  onClick={() => setDoiDialogOpen(true)}
                >
                  + DOI
                </ui.Button>
              )}
            </div>
          ) : null}
          {licenseDisplay != null ? (
            <div>
              <span className="font-medium text-foreground">License </span>
              {licenseDisplay.tooltip ? (
                <ui.Tooltip>
                  <ui.TooltipTrigger asChild>
                    <span className="underline cursor-help text-muted-foreground decoration-dotted decoration-muted-foreground">
                      {licenseDisplay.text}
                    </span>
                  </ui.TooltipTrigger>
                  <ui.TooltipContent>
                    <p>{licenseDisplay.tooltip}</p>
                  </ui.TooltipContent>
                </ui.Tooltip>
              ) : (
                <span className="text-muted-foreground">{licenseDisplay.text}</span>
              )}
            </div>
          ) : null}
        </div>
      </primitives.Card>

      {version.canEditDoi ? (
        <WorkDoiDialog
          open={doiDialogOpen}
          onOpenChange={setDoiDialogOpen}
          workDoi={version.workDoi}
        />
      ) : null}
    </>
  );
}
