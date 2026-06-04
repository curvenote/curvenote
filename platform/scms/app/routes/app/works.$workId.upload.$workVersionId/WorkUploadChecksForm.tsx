import type { ExtensionCheckService, UploadCheckCardMeta } from '@curvenote/scms-core';
import {
  ServiceLogo,
  UploadCheckOptionCard,
  UploadCheckCardPlaceholder,
  UPLOAD_CHECKS_GRID_CLASS,
  resolveUploadCheckCardState,
} from '@curvenote/scms-core';
import type { ChecksObject } from '@curvenote/scms-server';
import { ArticleStructureUploadCheckCard } from './ArticleStructureUploadCheckCard';

interface WorkUploadChecksFormProps extends ChecksObject {
  /** Server-resolved card list so layout is stable before client extension code runs. */
  uploadCheckCards: UploadCheckCardMeta[];
  checkServices: ExtensionCheckService[];
  workVersionId: string;
  /** Signed work version metadata (files + checks) for upload eligibility. */
  metadata: unknown;
  /** Manifest logo URL for text integrity (from Object store), when configured. */
  textIntegrityLogoUrl?: string;
}

export function WorkUploadChecksForm({
  enabled,
  uploadCheckCards,
  checkServices,
  workVersionId,
  metadata,
  textIntegrityLogoUrl,
}: WorkUploadChecksFormProps) {
  const servicesById = new Map(checkServices.map((s) => [s.id, s]));

  return (
    <div className={UPLOAD_CHECKS_GRID_CLASS}>
      {uploadCheckCards.map((meta) => {
        const service = servicesById.get(meta.id);
        if (service) {
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
        }
        return (
          <UploadCheckCardPlaceholder
            key={meta.id}
            meta={meta}
            logo={
              meta.id === 'checks-text-integrity' ? (
                <ServiceLogo
                  logoUrl={textIntegrityLogoUrl}
                  alt="Text Integrity"
                  className="h-[22px] w-auto max-w-[79px] object-contain"
                />
              ) : undefined
            }
          />
        );
      })}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
