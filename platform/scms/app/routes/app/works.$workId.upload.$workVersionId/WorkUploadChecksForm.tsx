import type { ExtensionCheckService } from '@curvenote/scms-core';
import { UploadCheckOptionCard } from '@curvenote/scms-core';
import type { ChecksObject } from '@curvenote/scms-server';
import { ArticleStructureUploadCheckCard } from './ArticleStructureUploadCheckCard';

interface WorkUploadChecksFormProps extends ChecksObject {
  checkServices: ExtensionCheckService[];
  workVersionId: string;
  /** Manifest logo URL for text integrity (from Object store), when configured. */
  textIntegrityLogoUrl?: string;
}

export function WorkUploadChecksForm({
  enabled,
  checkServices,
  workVersionId,
  textIntegrityLogoUrl,
}: WorkUploadChecksFormProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {checkServices.map((service) => (
        <UploadCheckOptionCard
          key={service.id}
          service={service}
          workVersionId={workVersionId}
          enabled={enabled.includes(service.id as (typeof enabled)[number])}
          logoUrl={
            service.id === 'checks-text-integrity' ? textIntegrityLogoUrl : undefined
          }
        />
      ))}

      <ArticleStructureUploadCheckCard />
    </div>
  );
}
