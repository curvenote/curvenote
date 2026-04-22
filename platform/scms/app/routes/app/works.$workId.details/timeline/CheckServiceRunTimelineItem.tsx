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
  /** Controls default expanded state of this timeline row. */
  defaultExpanded?: boolean;
};

const serviceDataFromRun = (run: CheckServiceRunRow): unknown =>
  (run.data != null && typeof run.data === 'object' && 'serviceData' in run.data
    ? (run.data as { serviceData?: unknown }).serviceData
    : undefined) ?? undefined;

/**
 * Timeline item for a check service run (database-driven). When a matching check
 * extension exists, the tray and pill are implemented by the extension's
 * sectionActivityComponent and sectionSummaryBadgeComponent; an optional
 * sectionSummaryTitleComponent replaces the default name segment before the word “checks” on the same line.
 * When no matching service is found, a generic fallback row and tray are shown.
 */
export function CheckServiceRunTimelineItem({
  run,
  checkService,
  basePath,
  defaultExpanded,
}: CheckServiceRunTimelineItemProps) {
  const date = (
    <DateWithPopover
      date={run.date_modified}
      dateCreated={run.date_created}
      dateModified={run.date_modified}
    />
  );
  const serviceData = serviceDataFromRun(run);
  const checksActionPath = checkService?.checksActionPath ?? `${basePath}/checks`;

  if (checkService) {
    const SummaryTitleComponent = checkService.sectionSummaryTitleComponent;
    const message = (
      <span className="inline-flex flex-nowrap gap-2 items-center min-w-0 max-w-full h-7">
        <span className="flex h-full min-w-0 shrink items-center overflow-hidden [&_img]:max-h-full [&_img]:w-auto [&_img]:object-contain [&_img]:object-left [&_span]:max-h-full [&_svg]:max-h-full [&_svg]:w-auto">
          {SummaryTitleComponent != null ? (
            <SummaryTitleComponent metadata={serviceData} />
          ) : (
            <span className="leading-none truncate">{checkService.name}</span>
          )}
        </span>
      </span>
    );
    const ActivityComponent = checkService.sectionActivityComponent;
    const SummaryBadgeComponent = checkService.sectionSummaryBadgeComponent;
    const MountComponent = checkService.checkRunTimelineMountComponent;

    const pill =
      SummaryBadgeComponent != null ? <SummaryBadgeComponent metadata={serviceData} /> : null;

    const tray = (
      <div className="flex flex-col gap-3">
        <ActivityComponent
          metadata={serviceData}
          workVersionId={run.work_version_id}
          checkRunId={run.id}
          remoteStatusActionPath={checksActionPath}
        />
      </div>
    );

    return (
      <>
        {/*
          Headless extension component: must be a component (not a callback) so hooks like
          useFetcher work under the router. See ExtensionCheckService.checkRunTimelineMountComponent.
        */}
        {MountComponent != null ? (
          <MountComponent
            checkRunId={run.id}
            workVersionId={run.work_version_id}
            checkKind={run.kind}
            metadata={serviceData}
            remoteStatusActionPath={checksActionPath}
            defaultExpanded={defaultExpanded}
          />
        ) : null}
        <TimelineItemExpandable
          icon={<ShieldCheck className="w-4 h-4" aria-hidden />}
          message={message}
          date={date}
          pill={pill}
          defaultExpanded={Boolean(defaultExpanded)}
          className="py-2"
        >
          {tray}
        </TimelineItemExpandable>
      </>
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
      className="py-2"
    >
      {tray}
    </TimelineItemExpandable>
  );
}
