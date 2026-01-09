import type { ButtonProps } from './button.js';
import { Button } from './button.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { cn } from '../../utils/cn.js';

export interface StatefulButtonProps extends ButtonProps {
  busy?: boolean;
  busyMessage?: string;
  disabled?: boolean;
  overlayBusy?: boolean;
}

export function StatefulButton({
  children,
  busy,
  busyMessage,
  disabled,
  overlayBusy,
  className,
  ...props
}: StatefulButtonProps) {
  return (
    <Button
      disabled={busy || disabled}
      {...props}
      className={cn('relative cursor-pointer', className)}
    >
      {busy && (
        <>
          <span
            className={cn({
              'flex absolute inset-0 z-10 justify-center items-center w-full': overlayBusy,
            })}
          >
            <LoadingSpinner className="opacity-100 text-stone-900" />
          </span>
          {busy && (
            <span className={cn({ 'opacity-40': overlayBusy })}>{busyMessage ?? children}</span>
          )}
        </>
      )}
      {!busy && <>{children}</>}
    </Button>
  );
}
