import { Link } from 'react-router';
import type { ComponentType } from 'react';
import type { ClientExtensionCheckService } from '@curvenote/scms-core';
import { formatDate, ui } from '@curvenote/scms-core';
import type { ServiceRunEntry } from '../works.$workId/checkServiceRunSummaries';

type WorkListSummaryComponentProps = {
  metadata: any;
  checkRunId: string;
  workVersionId: string;
  checkServiceId: string;
  checkServiceName: string;
  checkRunDateModified: string;
};

export type WorkListCheckService = ClientExtensionCheckService & {
  workListSummaryComponent?: ComponentType<WorkListSummaryComponentProps>;
  isWorkListSummaryVisible?: (metadata: unknown) => boolean;
};

type WorkCheckSummariesProps = {
  workId: string;
  latestCheckRunsByServiceKind?: Record<string, ServiceRunEntry>;
  checkServices: WorkListCheckService[];
};

function serviceDataFromRun(entry: ServiceRunEntry): unknown {
  return entry.run.data != null &&
    typeof entry.run.data === 'object' &&
    'serviceData' in entry.run.data
    ? (entry.run.data as { serviceData?: unknown }).serviceData
    : undefined;
}

function WorkCheckSummaryContent({
  service,
  entry,
}: {
  service: WorkListCheckService;
  entry: ServiceRunEntry;
}) {
  const SummaryComponent = service.workListSummaryComponent;
  const metadata = serviceDataFromRun(entry);

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
  latestCheckRunsByServiceKind,
  checkServices,
}: WorkCheckSummariesProps) {
  if (!latestCheckRunsByServiceKind || Object.keys(latestCheckRunsByServiceKind).length === 0) {
    return null;
  }

  const serviceById = new Map(checkServices.map((service) => [service.id, service]));
  const summaries = Object.values(latestCheckRunsByServiceKind)
    .map((entry) => {
      const service = serviceById.get(entry.run.kind);
      return { entry, service, metadata: serviceDataFromRun(entry) };
    })
    .filter(
      (
        summary,
      ): summary is {
        entry: ServiceRunEntry;
        service: WorkListCheckService;
        metadata: unknown;
      } =>
        summary.service != null &&
        (summary.service.isWorkListSummaryVisible?.(summary.metadata) ?? true),
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
                className="inline-flex gap-2 items-center px-2 py-1 max-w-full text-xs rounded-sm border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300"
              >
                <span className="inline-flex gap-1.5 items-center min-w-0">
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
