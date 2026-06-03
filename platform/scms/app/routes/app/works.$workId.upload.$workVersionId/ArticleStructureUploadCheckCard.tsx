import { primitives, UploadCheckCardContent, uploadCheckCardClassName } from '@curvenote/scms-core';
import { FileText } from 'lucide-react';

/**
 * Coming-soon article structure option on the work upload page (not toggleable yet).
 */
export function ArticleStructureUploadCheckCard() {
  return (
    <primitives.Card className={uploadCheckCardClassName({ enabled: false, disabled: true })}>
      <UploadCheckCardContent
        logo={<FileText className="w-[22px] h-[22px] text-muted-foreground" aria-hidden />}
        title={
          <>
            Article Structure{' '}
            <sup className="text-xs font-normal text-muted-foreground">(coming soon)</sup>
          </>
        }
        description="Validate document structure, metadata, and formatting."
        enabled={false}
        disabled
      />
    </primitives.Card>
  );
}
