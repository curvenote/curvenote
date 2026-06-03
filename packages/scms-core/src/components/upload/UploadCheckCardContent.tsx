'use client';

import type { ReactNode } from 'react';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { Checkbox } from '../ui/checkbox.js';
import { cn } from '../../utils/cn.js';

/** Matches upload check card checkbox (`size-5`). */
const CORNER_CONTROL_SIZE_PX = 20;

const CORNER_CONTROL_CLASS =
  'pointer-events-none absolute top-2.5 right-2 z-10 shrink-0 sm:top-3 sm:right-4';

/** Title, description, and info line are not separate click targets (card/button handles interaction). */
const TEXT_BLOCK_CLASS = 'cursor-default pointer-events-none select-none';

/** Logo slot size (+10% vs prior h-5 / max-w-[72px]). */
const LOGO_IMG_CLASS =
  '[&_img]:h-[22px] [&_img]:w-auto [&_img]:max-w-[79px] [&_img]:object-contain [&_svg]:h-[22px] [&_svg]:w-[22px]';

export interface UploadCheckCardContentProps {
  logo?: ReactNode;
  title: ReactNode;
  description: string;
  infoLine?: string;
  enabled: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** When true and `busy`, show a corner spinner instead of the checkbox (e.g. EULA status fetch). */
  spinnerWhenBusy?: boolean;
  onRequestEnable?: () => void;
}

/**
 * Shared body for upload-page check option cards (wizard-aligned typography).
 */
export function UploadCheckCardContent({
  logo,
  title,
  description,
  infoLine,
  enabled,
  disabled = false,
  busy = false,
  spinnerWhenBusy = false,
  onRequestEnable,
}: UploadCheckCardContentProps) {
  const showFooter = Boolean(infoLine || logo);
  const showCornerSpinner = busy && spinnerWhenBusy;

  const cornerControl = showCornerSpinner ? (
    <span className={CORNER_CONTROL_CLASS} aria-hidden>
      <LoadingSpinner
        size={CORNER_CONTROL_SIZE_PX}
        thickness={2}
        color="text-stone-500 dark:text-stone-400"
      />
    </span>
  ) : (
    <Checkbox
      checked={enabled}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden
      className={cn(
        CORNER_CONTROL_CLASS,
        enabled &&
          'border-green-400 bg-green-50 data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500 dark:data-[state=checked]:border-green-600 dark:data-[state=checked]:bg-green-600',
      )}
    />
  );

  const body = (
    <div
      className={cn(
        'relative px-2 py-3 text-left sm:px-4',
        showCornerSpinner && 'cursor-wait',
      )}
    >
      {cornerControl}
      <div className={cn('min-w-0 pr-8', TEXT_BLOCK_CLASS)}>
        <h3 className="text-base font-medium leading-snug">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {showFooter ? (
        <div
          className={cn(
            'flex gap-3 items-center mt-2',
            infoLine ? 'justify-between' : 'justify-end',
          )}
        >
          {infoLine ? (
            <p className={cn('flex-1 min-w-0 text-xs text-muted-foreground', TEXT_BLOCK_CLASS)}>
              {infoLine}
            </p>
          ) : null}
          {logo ? (
            <div
              className={cn(
                'flex flex-shrink-0 items-center justify-end',
                LOGO_IMG_CLASS,
                '[&>span]:flex [&>span]:items-center [&>span]:justify-end',
              )}
            >
              {logo}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (disabled || enabled) {
    return body;
  }

  return (
    <button
      type="button"
      className={cn('w-full text-left cursor-pointer', busy && 'opacity-50 cursor-wait')}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onRequestEnable?.();
      }}
    >
      {body}
    </button>
  );
}
