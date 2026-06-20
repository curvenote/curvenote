import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import type { ClientExtensionCheckService } from '../../modules/extensions/types.js';
import { DateWithPopover } from './DateWithPopover.js';
import { TimelineItemExpandable, TimelineItemPill } from './TimelineItem.js';

export type TimelineCheckServiceRunRow = {
  id: string;
  work_version_id: string;
  kind: string;
  date_created: string;
  date_modified: string;
  data: unknown;
  created_by_id: string | null;
};

type CheckServiceRunTimelineItemProps = {
  run: TimelineCheckServiceRunRow;
  /** When no matching extension is registered, show a generic fallback (no extension UI). */
  checkService: ClientExtensionCheckService | null;
  basePath: string;
  /** Controls default expanded state of this timeline row. */
  defaultExpanded?: boolean;
  /** Optional route for fallback detail copy; defaults to `${basePath}/work-integrity`. */
  fallbackDetailsHref?: string;
};

const serviceDataFromRun = (run: TimelineCheckServiceRunRow): unknown =>
  (run.data != null && typeof run.data === 'object' && 'serviceData' in run.data
    ? (run.data as { serviceData?: unknown }).serviceData
    : undefined) ?? undefined;

/**
 * Timeline item for a check service run. When a matching check extension exists,
 * the tray and badge are implemented by that extension; otherwise a generic
 * fallback row keeps the check-run event visible.
 */
export function CheckServiceRunTimelineItem({
  run,
  checkService,
  basePath,
  defaultExpanded,
  fallbackDetailsHref,
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
          checkRunDateModified={run.date_modified}
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

  const message = <>Check run{run.kind ? ` (${run.kind})` : ''} completed</>;
  const detailsHref = fallbackDetailsHref ?? `${basePath}/work-integrity`;
  const tray = (
    <p className="text-sm text-muted-foreground">
      Detailed results are not available for this check. The check extension for this run may not be
      enabled. You can view work integrity from the{' '}
      <Link to={detailsHref} className="text-primary hover:underline">
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
