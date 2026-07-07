import type { ExtensionCheckService, UploadCheckEligibilityContext } from '@curvenote/scms-core';
import {
  UploadCheckOptionCard,
  UPLOAD_CHECKS_GRID_CLASS,
  getUploadCheckEligibilityContext,
  resolveExtensionUploadEligibility,
  resolveUploadCheckCardState,
  useCheckMaintenanceBlocked,
} from '@curvenote/scms-core';
import type { ChecksObject } from '@curvenote/scms-server';
import { ArticleStructureUploadCheckCard } from './ArticleStructureUploadCheckCard';

interface WorkUploadChecksFormProps extends ChecksObject {
  checkServices: ExtensionCheckService[];
  workVersionId: string;
  /** Signed work version metadata (files + checks) for upload eligibility. */
  metadata: unknown;
  /** Manifest logo URLs keyed by check service id (from extension `resolveUploadLogoUrl`). */
  uploadCheckLogoUrls?: Record<string, string | undefined>;
}

function UploadCheckServiceCard({
  service,
  workVersionId,
  enabled,
  metadata,
  eligibilityContext,
  uploadCheckLogoUrls,
}: {
  service: ExtensionCheckService;
  workVersionId: string;
  enabled: boolean;
  metadata: unknown;
  eligibilityContext: UploadCheckEligibilityContext;
  uploadCheckLogoUrls?: Record<string, string | undefined>;
}) {
  const { blocked: underMaintenance, message: maintenanceMessage } = useCheckMaintenanceBlocked(
    service.id,
  );
  const eligibility = resolveExtensionUploadEligibility(service, metadata, eligibilityContext);
  const { disabled, invalid, warning } = resolveUploadCheckCardState({
    status: eligibility.status,
    enabled,
    underMaintenance,
  });

  return (
    <UploadCheckOptionCard
      service={service}
      workVersionId={workVersionId}
      enabled={enabled}
      disabled={disabled}
      invalid={invalid}
      warning={warning}
      warningMessage={eligibility.message}
      eligibilityContext={eligibilityContext}
      maintenanceMessage={underMaintenance ? maintenanceMessage : undefined}
      logoUrl={uploadCheckLogoUrls?.[service.id]}
    />
  );
}

export function WorkUploadChecksForm({
  enabled,
  checkServices,
  workVersionId,
  metadata,
  uploadCheckLogoUrls,
}: WorkUploadChecksFormProps) {
  const eligibilityContext = getUploadCheckEligibilityContext(metadata);

  return (
    <div className={UPLOAD_CHECKS_GRID_CLASS}>
      {checkServices.map((service) => (
        <UploadCheckServiceCard
          key={service.id}
          service={service}
          workVersionId={workVersionId}
          enabled={enabled.includes(service.id as (typeof enabled)[number])}
          metadata={metadata}
          eligibilityContext={eligibilityContext}
          uploadCheckLogoUrls={uploadCheckLogoUrls}
        />
      ))}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
