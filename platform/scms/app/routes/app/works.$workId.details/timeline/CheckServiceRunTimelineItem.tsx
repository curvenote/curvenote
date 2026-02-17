import React from 'react';
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { TimelineItemExpandable, TimelineItemPill } from './TimelineItem';
import { DateWithPopover } from './DateWithPopover';
import type { ClientExtensionCheckService } from '@curvenote/scms-core';
import type { CheckServiceRunRow } from '../../works.$workId/db.server';

type CheckServiceRunTimelineItemProps = {
  run: CheckServiceRunRow;
  /** When no matching extension is registered, show a generic fallback (no extension UI). */
  checkService: ClientExtensionCheckService | null;
  basePath: string;
};

const serviceDataFromRun = (run: CheckServiceRunRow): unknown =>
  (run.data != null && typeof run.data === 'object' && 'serviceData' in run.data
    ? (run.data as { serviceData?: unknown }).serviceData
    : undefined) ?? undefined;

/**
 * Timeline item for a check service run (database-driven). When a matching check
 * extension exists, the tray and pill are implemented by the extension's
 * sectionActivityComponent and sectionSummaryBadgeComponent. When no matching
 * service is found, a generic fallback row and tray are shown.
 */
export function CheckServiceRunTimelineItem({
  run,
  checkService,
  basePath,
}: CheckServiceRunTimelineItemProps) {
  const date = <DateWithPopover date={run.date_modified} />;
  const serviceData = serviceDataFromRun(run);

  if (checkService) {
    const message = <>{checkService.name} checks</>;
    const ActivityComponent = checkService.sectionActivityComponent as React.ComponentType<{
      metadata: unknown;
    }>;
    const SummaryBadgeComponent = checkService.sectionSummaryBadgeComponent;

    const pill =
      SummaryBadgeComponent != null ? <SummaryBadgeComponent metadata={serviceData} /> : null;

    const tray = (
      <div className="flex flex-col gap-3">
        <ActivityComponent metadata={serviceData} />
      </div>
    );

    return (
      <TimelineItemExpandable
        icon={<ShieldCheck className="w-4 h-4" aria-hidden />}
        message={message}
        date={date}
        pill={pill}
      >
        {tray}
      </TimelineItemExpandable>
    );
  }

  // Generic fallback when no extension is registered for run.kind
  const message = <>Check run{run.kind ? ` (${run.kind})` : ''} completed</>;
  const tray = (
    <p className="text-sm text-muted-foreground">
      Detailed results are not available for this check. The check extension for this run may not be
      enabled. You can view work integrity from the{' '}
      <Link to={`${basePath}/work-integrity`} className="text-primary hover:underline">
        Work Integrity
      </Link>{' '}
      page.
    </p>
  );

  return (
    <TimelineItemExpandable
      icon={<ShieldCheck className="w-4 h-4" aria-hidden />}
      message={message}
      date={date}
      pill={<TimelineItemPill label="No details" variant="default" />}
    >
      {tray}
    </TimelineItemExpandable>
  );
}
