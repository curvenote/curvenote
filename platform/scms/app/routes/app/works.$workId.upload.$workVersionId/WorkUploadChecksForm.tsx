import type { ExtensionCheckService } from '@curvenote/scms-core';
import {
  UploadCheckOptionCard,
  UPLOAD_CHECKS_GRID_CLASS,
  getUploadCheckEligibilityContext,
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
  uploadCheckLogoUrls,
}: {
  service: ExtensionCheckService;
  workVersionId: string;
  enabled: boolean;
  metadata: unknown;
  uploadCheckLogoUrls?: Record<string, string | undefined>;
}) {
  const { blocked: underMaintenance, message: maintenanceMessage } = useCheckMaintenanceBlocked(
    service.id,
  );
  const eligibilityContext = getUploadCheckEligibilityContext(metadata);
  const eligible = service.isUploadEligible?.(metadata, eligibilityContext) ?? true;
  const { disabled, invalid } = resolveUploadCheckCardState({
    eligible,
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
  return (
    <div className={UPLOAD_CHECKS_GRID_CLASS}>
      {checkServices.map((service) => (
        <UploadCheckServiceCard
          key={service.id}
          service={service}
          workVersionId={workVersionId}
          enabled={enabled.includes(service.id as (typeof enabled)[number])}
          metadata={metadata}
          uploadCheckLogoUrls={uploadCheckLogoUrls}
        />
      ))}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
