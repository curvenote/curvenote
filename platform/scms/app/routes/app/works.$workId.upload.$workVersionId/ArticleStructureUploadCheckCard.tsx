import { primitives, UploadCheckCardContent, uploadCheckCardClassName } from '@curvenote/scms-core';
import { CurvenoteText } from '@curvenote/icons';

/**
 * Coming-soon article structure option on the work upload page (not toggleable yet).
 */
export function ArticleStructureUploadCheckCard() {
  return (
    <primitives.Card className={uploadCheckCardClassName({ enabled: false, disabled: true })}>
      <UploadCheckCardContent
        logo={
          <CurvenoteText
            fill="currentColor"
            className="h-[22px] w-auto max-w-[79px] shrink-0 text-black"
            aria-hidden
          />
        }
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
