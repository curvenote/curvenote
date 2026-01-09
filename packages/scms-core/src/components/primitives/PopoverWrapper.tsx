import React, { useImperativeHandle, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import classNames from 'classnames';

export interface PopoverActions {
  closePopover: () => void;
}

export const PopoverWrapper = React.forwardRef<
  PopoverActions,
  React.PropsWithChildren<{ className?: string; content: React.ReactNode; skip?: boolean }>
>(({ className, content, children, skip }, ref) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({
    closePopover: () => {
      closeRef.current?.click();
    },
  }));
  if (skip) return <>{children}</>;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={classNames(
            'rounded bg-white shadow-[0_10px_38px_-10px_hsla(206,22%,7%,.35),0_10px_20px_-15px_hsla(206,22%,7%,.2)] focus:shadow-[0_10px_38px_-10px_hsla(206,22%,7%,.35),0_10px_20px_-15px_hsla(206,22%,7%,.2)] will-change-[transform,opacity] data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade',
            className,
          )}
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {content}
          <Popover.Close
            ref={closeRef}
            className="rounded-full h-5 w-5 inline-flex items-center justify-center absolute top-[5px] right-[5px] hover:bg-gray-100 focus:shadow-[0_0_0_2px] focus:shadow-gray-50 outline-hidden cursor-pointer"
            aria-label="Close"
          >
            <X />
          </Popover.Close>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

export default PopoverWrapper;
