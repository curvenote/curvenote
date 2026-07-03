import { Link } from 'react-router';
import type { ComponentType } from 'react';
import type { ClientExtensionCheckService } from '@curvenote/scms-core';
import { formatDate, getCheckServiceRunServiceData, ui } from '@curvenote/scms-core';
import type { ServiceRunEntry } from '../works.$workId/checkServiceRunSummaries';

type WorkListSummaryComponentProps = {
  metadata: any;
  checkRunId: string;
  workVersionId: string;
  checkServiceId: string;
  checkServiceName: string;
  checkRunDateModified: string;
  compact?: boolean;
};

export type WorkListCheckService = ClientExtensionCheckService & {
  workListSummaryComponent?: ComponentType<WorkListSummaryComponentProps>;
  isWorkListSummaryVisible?: (metadata: unknown) => boolean;
};

type WorkCheckSummariesProps = {
  workId: string;
  workListCheckRunsByServiceKind?: Record<string, ServiceRunEntry>;
  checkServices: WorkListCheckService[];
};

function WorkCheckSummaryContent({
  service,
  entry,
}: {
  service: WorkListCheckService;
  entry: ServiceRunEntry;
}) {
  const SummaryComponent = service.workListSummaryComponent;
  const metadata = getCheckServiceRunServiceData(entry.run);

  if (SummaryComponent) {
    return (
      <SummaryComponent
        metadata={metadata}
        checkRunId={entry.run.id}
        workVersionId={entry.workVersionId}
        checkServiceId={service.id}
        checkServiceName={service.name}
        checkRunDateModified={entry.run.date_modified}
      />
    );
  }

  const SummaryTitleComponent = service.sectionSummaryTitleComponent;
  const SummaryBadgeComponent = service.sectionSummaryBadgeComponent;

  return (
    <>
      {SummaryTitleComponent ? (
        <span className="flex items-center min-w-0 max-w-32 [&_img]:max-h-4 [&_svg]:max-h-4">
          <SummaryTitleComponent metadata={metadata} />
        </span>
      ) : (
        <span className="truncate">{service.name}</span>
      )}
      {SummaryBadgeComponent ? <SummaryBadgeComponent metadata={metadata} /> : null}
    </>
  );
}

export function WorkCheckSummaries({
  workId,
  workListCheckRunsByServiceKind,
  checkServices,
}: WorkCheckSummariesProps) {
  if (
    !workListCheckRunsByServiceKind ||
    Object.keys(workListCheckRunsByServiceKind).length === 0
  ) {
    return null;
  }

  const serviceById = new Map(checkServices.map((service) => [service.id, service]));
  const summaries = Object.values(workListCheckRunsByServiceKind)
    .map((entry) => {
      const service = serviceById.get(entry.run.kind);
      return { entry, service };
    })
    .filter(
      (
        summary,
      ): summary is {
        entry: ServiceRunEntry;
        service: WorkListCheckService;
      } => summary.service != null,
    )
    .sort((a, b) =>
      a.entry.run.date_created > b.entry.run.date_created
        ? -1
        : a.entry.run.date_created < b.entry.run.date_created
          ? 1
          : 0,
    );

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-start mt-2">
      <div className="flex flex-wrap gap-2 justify-start items-center">
        {summaries.map(({ entry, service }) => {
          return (
            <ui.SimpleTooltip
              key={entry.run.id}
              title={`${service.name} check was run on ${formatDate(
                entry.run.date_created,
              )} on the work version dated ${formatDate(entry.versionDateCreated)}`}
              side="top"
              sideOffset={6}
            >
              <Link
                to={`${workId}/checks`}
                className="inline-flex min-h-7 items-center gap-2 px-2 py-1 max-w-full text-xs rounded-sm border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <WorkCheckSummaryContent service={service} entry={entry} />
                </span>
              </Link>
            </ui.SimpleTooltip>
          );
        })}
      </div>
    </div>
  );
}
