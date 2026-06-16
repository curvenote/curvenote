import type { ExtensionCheckService } from '@curvenote/scms-core';
import {
  UploadCheckOptionCard,
  UPLOAD_CHECKS_GRID_CLASS,
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
  /** Manifest logo URL for text integrity (from Object store), when configured. */
  textIntegrityLogoUrl?: string;
}

function UploadCheckServiceCard({
  service,
  workVersionId,
  enabled,
  metadata,
  textIntegrityLogoUrl,
}: {
  service: ExtensionCheckService;
  workVersionId: string;
  enabled: boolean;
  metadata: unknown;
  textIntegrityLogoUrl?: string;
}) {
  const { blocked: underMaintenance, message: maintenanceMessage } = useCheckMaintenanceBlocked(
    service.id,
  );
  const eligible = service.isUploadEligible?.(metadata) ?? true;
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
      logoUrl={service.id === 'checks-text-integrity' ? textIntegrityLogoUrl : undefined}
    />
  );
}

export function WorkUploadChecksForm({
  enabled,
  checkServices,
  workVersionId,
  metadata,
  textIntegrityLogoUrl,
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
          textIntegrityLogoUrl={textIntegrityLogoUrl}
        />
      ))}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
