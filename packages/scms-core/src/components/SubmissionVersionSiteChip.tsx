import { Link } from 'react-router';
import type { WorkVersionTimelineSubmissionVersion } from '../types/versionTimeline.js';
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
    return <img src={site.logo} alt="" className="object-contain rounded-sm size-4" aria-hidden />;
  }

  return (
    <span
      className="flex justify-center items-center rounded-sm size-4 text-[9px] font-semibold uppercase bg-background text-muted-foreground"
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
  const href = workId
    ? `/app/works/${workId}/site/${submissionVersion.site.name}/submission/${submissionVersion.id}`
    : undefined;

  const chip = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full p-0.5 ring-2 ring-offset-1 ring-offset-popover',
        getStatusRingClasses(submissionVersion.statusTags),
        href && 'transition-opacity hover:opacity-80',
      )}
    >
      <SiteMark site={submissionVersion.site} />
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link
            to={href}
            className="inline-flex"
            aria-label={`${siteLabel}: ${submissionVersion.statusLabel}`}
            onClick={(event) => event.stopPropagation()}
          >
            {chip}
          </Link>
        ) : (
          <span className="inline-flex cursor-default">{chip}</span>
        )}
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>
        <span className="font-medium">{siteLabel}</span>
        <span className="text-muted-foreground"> · {submissionVersion.statusLabel}</span>
        {submissionVersion.tag ? (
          <span className="text-muted-foreground"> · {submissionVersion.tag}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
