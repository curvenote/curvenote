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

/** Reserve two lines for info text so card footers align across the upload checks grid. */
const FOOTER_MIN_HEIGHT_CLASS = 'min-h-[2.75rem]';

const CARD_CONTENT_SHELL_CLASS = 'flex h-full min-h-0 w-full flex-1 flex-col';

export interface UploadCheckCardContentProps {
  logo?: ReactNode;
  title: ReactNode;
  description: string;
  infoLine?: string;
  enabled: boolean;
  disabled?: boolean;
  invalid?: boolean;
  warning?: boolean;
  warningMessage?: string;
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
  invalid = false,
  warning = false,
  warningMessage,
  busy = false,
  spinnerWhenBusy = false,
  onRequestEnable,
}: UploadCheckCardContentProps) {
  const footerText = warning && warningMessage ? warningMessage : infoLine;
  const showFooter = Boolean(footerText || logo);
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
          !invalid &&
          !warning &&
          'border-green-400 bg-green-50 data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500 dark:data-[state=checked]:border-green-600 dark:data-[state=checked]:bg-green-600',
        enabled &&
          warning &&
          !invalid &&
          'border-amber-400 bg-amber-50 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500 dark:data-[state=checked]:border-amber-600 dark:data-[state=checked]:bg-amber-600',
        enabled &&
          invalid &&
          'border-red-400 bg-red-50 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500 dark:data-[state=checked]:border-red-600 dark:data-[state=checked]:bg-red-600',
      )}
    />
  );

  const body = (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col px-2 py-3 text-left sm:px-4',
        showCornerSpinner && 'cursor-wait',
      )}
    >
      {cornerControl}
      <div className={cn('min-w-0 flex-1 pr-8', TEXT_BLOCK_CLASS)}>
        <h3 className="text-base font-medium leading-snug">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {showFooter ? (
        <div
          className={cn(
            'mt-2 flex shrink-0 gap-3 items-end',
            FOOTER_MIN_HEIGHT_CLASS,
            footerText ? 'justify-between' : 'justify-end',
          )}
        >
          {footerText ? (
            <p
              className={cn(
                'flex flex-1 min-w-0 items-end self-stretch text-xs leading-snug',
                TEXT_BLOCK_CLASS,
                invalid
                  ? 'text-red-600 dark:text-red-400'
                  : warning
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground',
              )}
            >
              {footerText}
            </p>
          ) : (
            <span className="flex-1 min-w-0" aria-hidden />
          )}
          {logo ? (
            <div
              className={cn(
                'flex h-[22px] shrink-0 items-end justify-end',
                LOGO_IMG_CLASS,
                '[&>span]:flex [&>span]:h-full [&>span]:items-end [&>span]:justify-end',
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
    return <div className={CARD_CONTENT_SHELL_CLASS}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        CARD_CONTENT_SHELL_CLASS,
        'text-left cursor-pointer',
        busy && 'opacity-50 cursor-wait',
      )}
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
