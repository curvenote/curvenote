import { Link } from 'react-router';
import type { WorkVersionTimelineSubmissionVersion } from '../types/versionTimeline.js';
import { formatDatetime } from '../utils/formatDate.js';
import { cn } from '../utils/cn.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';

function getStatusRingClasses(statusTags?: string[]) {
  if (!statusTags?.length) {
    return 'ring-border bg-muted/40';
  }

  const hasEnd = statusTags.includes('end');
  const hasError = statusTags.includes('error');
  const hasWarning = statusTags.includes('warning');

  if (hasError) {
    return 'ring-red-500 bg-red-50 dark:bg-red-950/40 dark:ring-red-400';
  }
  if (hasWarning) {
    return 'ring-orange-500 bg-orange-50 dark:bg-orange-950/40 dark:ring-orange-400';
  }
  if (hasEnd && !hasError && !hasWarning) {
    return 'ring-green-600 bg-green-50 dark:bg-green-950/40 dark:ring-green-500';
  }

  return 'ring-border bg-muted/40';
}

function SiteMark({ site }: { site: WorkVersionTimelineSubmissionVersion['site'] }) {
  if (site.logo) {
    return (
      <img src={site.logo} alt="" className="object-contain size-4 max-w-4 max-h-4" aria-hidden />
    );
  }

  return (
    <span
      className="flex justify-center items-center size-4 text-[9px] font-semibold uppercase text-muted-foreground"
      aria-hidden
    >
      {site.name.slice(0, 1)}
    </span>
  );
}

export function SubmissionVersionSiteChip({
  submissionVersion,
  workId,
}: {
  submissionVersion: WorkVersionTimelineSubmissionVersion;
  workId?: string;
}) {
  const siteLabel = submissionVersion.site.title || submissionVersion.site.name;
  const tag = submissionVersion.tag;
  const href = workId
    ? `/app/works/${workId}/site/${submissionVersion.site.name}/submission/${submissionVersion.id}`
    : undefined;

  const chip = (
    <span
      className={cn(
        'inline-flex h-4 shrink-0 items-center justify-center gap-0.5 rounded-md ring-2',
        tag ? 'px-1' : 'px-0.5',
        getStatusRingClasses(submissionVersion.statusTags),
        href && 'transition-opacity hover:opacity-80',
      )}
    >
      <SiteMark site={submissionVersion.site} />
      {tag ? (
        <>
          <span className="w-px h-3 bg-border/80 shrink-0" aria-hidden />
          <span className="text-[10px] font-mono leading-4 text-foreground/90">{tag}</span>
        </>
      ) : null}
    </span>
  );

  const ariaLabel = tag
    ? `${siteLabel}: ${submissionVersion.statusLabel}, ${tag}`
    : `${siteLabel}: ${submissionVersion.statusLabel}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link
            to={href}
            className="inline-flex items-center"
            aria-label={ariaLabel}
            onClick={(event) => event.stopPropagation()}
          >
            {chip}
          </Link>
        ) : (
          <span className="inline-flex items-center cursor-default">{chip}</span>
        )}
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>
        <span className="font-medium">{siteLabel}</span>
        <span className="text-muted-foreground"> · {submissionVersion.statusLabel}</span>
        {tag ? <span className="text-muted-foreground"> · {tag}</span> : null}
        {submissionVersion.date_published ? (
          <span className="text-muted-foreground">
            {' '}
            · Publication date · {formatDatetime(submissionVersion.date_published)}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
