import type { ExtensionCheckService } from '@curvenote/scms-core';
import {
  UploadCheckOptionCard,
  UPLOAD_CHECKS_GRID_CLASS,
  resolveUploadCheckCardState,
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

export function WorkUploadChecksForm({
  enabled,
  checkServices,
  workVersionId,
  metadata,
  textIntegrityLogoUrl,
}: WorkUploadChecksFormProps) {
  return (
    <div className={UPLOAD_CHECKS_GRID_CLASS}>
      {checkServices.map((service) => {
        const isEnabled = enabled.includes(service.id as (typeof enabled)[number]);
        const eligible = service.isUploadEligible?.(metadata) ?? true;
        const { disabled, invalid } = resolveUploadCheckCardState({
          eligible,
          enabled: isEnabled,
        });
        return (
          <UploadCheckOptionCard
            key={service.id}
            service={service}
            workVersionId={workVersionId}
            enabled={isEnabled}
            disabled={disabled}
            invalid={invalid}
            logoUrl={service.id === 'checks-text-integrity' ? textIntegrityLogoUrl : undefined}
          />
        );
      })}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
