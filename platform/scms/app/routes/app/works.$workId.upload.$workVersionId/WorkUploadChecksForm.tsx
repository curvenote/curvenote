import type { ExtensionCheckService, UploadCheckCardMeta } from '@curvenote/scms-core';
import {
  ServiceLogo,
  UploadCheckOptionCard,
  UploadCheckCardPlaceholder,
  UPLOAD_CHECKS_GRID_CLASS,
} from '@curvenote/scms-core';
import type { ChecksObject } from '@curvenote/scms-server';
import { ArticleStructureUploadCheckCard } from './ArticleStructureUploadCheckCard';

interface WorkUploadChecksFormProps extends ChecksObject {
  /** Server-resolved card list so layout is stable before client extension code runs. */
  uploadCheckCards: UploadCheckCardMeta[];
  checkServices: ExtensionCheckService[];
  workVersionId: string;
  /** Manifest logo URL for text integrity (from Object store), when configured. */
  textIntegrityLogoUrl?: string;
}

export function WorkUploadChecksForm({
  enabled,
  uploadCheckCards,
  checkServices,
  workVersionId,
  textIntegrityLogoUrl,
}: WorkUploadChecksFormProps) {
  const servicesById = new Map(checkServices.map((s) => [s.id, s]));

  return (
    <div className={UPLOAD_CHECKS_GRID_CLASS}>
      {uploadCheckCards.map((meta) => {
        const service = servicesById.get(meta.id);
        if (service) {
          return (
            <UploadCheckOptionCard
              key={service.id}
              service={service}
              workVersionId={workVersionId}
              enabled={enabled.includes(service.id as (typeof enabled)[number])}
              logoUrl={
                service.id === 'checks-text-integrity' ? textIntegrityLogoUrl : undefined
              }
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
