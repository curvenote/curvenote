import React from 'react';
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import classNames from 'classnames';

export function HoverCardWrapper({
  className,
  children,
  content,
  skip,
}: React.PropsWithChildren<{
  className?: string;
  content: React.ReactNode;
  skip?: boolean;
}>) {
  if (skip) return <>{children}</>;
  return (
    <RadixHoverCard.Root>
      <RadixHoverCard.Trigger asChild>{children}</RadixHoverCard.Trigger>
      <RadixHoverCard.Portal>
        <RadixHoverCard.Content
          className={classNames(
            className,
            'data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFade rounded-md bg-white p-5 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] data-[state=open]:transition-all',
          )}
          sideOffset={5}
        >
          {content}
          <RadixHoverCard.Arrow className="fill-white" />
        </RadixHoverCard.Content>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}
