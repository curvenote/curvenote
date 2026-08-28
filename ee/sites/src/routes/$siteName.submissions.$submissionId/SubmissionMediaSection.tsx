import { useEffect, useState } from 'react';
import { cn } from '@curvenote/scms-core';

export type SubmissionMediaSectionProps = {
  thumbnailUrl: string | undefined;
  title: string;
};

/** Match ChooseThumbnailSection row tile widths so the card stays gallery-sized. */
const tileWidthClassName =
  'w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)]';

export function SubmissionMediaSection({ thumbnailUrl, title }: SubmissionMediaSectionProps) {
  // Signed thumbnail links are often emitted whenever a CDN key exists, even when the
  // thumbnail route 404s (no column + no manifest thumbnail). Treat load failure as empty.
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailUrl]);

  const showImage = Boolean(thumbnailUrl) && !imageFailed;

  return (
    <div>
      <div className="mb-3">
        <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
          MEDIA
        </span>
      </div>
      <div className={cn('flex flex-col gap-1 items-stretch', tileWidthClassName)}>
        <div
          className={cn(
            'flex flex-col gap-0.5 rounded-md border p-2',
            'border-stone-200 bg-white dark:border-stone-500 dark:bg-stone-900',
          )}
        >
          <p className="text-xs leading-none truncate text-muted-foreground/80">Thumbnail</p>
          <div className="flex overflow-hidden justify-center items-center min-h-0 rounded aspect-square bg-stone-100 dark:bg-stone-800">
            {showImage ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="object-contain w-full h-full"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="text-xs text-muted-foreground">No Thumbnail</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
