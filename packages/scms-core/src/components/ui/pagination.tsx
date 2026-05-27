import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '../../utils/cn.js';

const paginationLinkBase =
  'inline-flex items-center justify-center gap-0.5 whitespace-nowrap rounded-md text-xs font-medium tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('flex justify-center mx-auto w-full', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

function PaginationItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" className={cn('', className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  asChild?: boolean;
  size?: 'default' | 'icon';
} & React.ComponentProps<'a'>;

function PaginationLink({
  className,
  isActive,
  size = 'default',
  asChild = false,
  ...props
}: PaginationLinkProps) {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        paginationLinkBase,
        size === 'icon' && 'size-8 shrink-0',
        size === 'default' && 'h-8 min-w-8 px-2',
        isActive
          ? 'border border-input bg-background text-foreground'
          : 'border border-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('pl-2', className)}
      {...props}
    >
      <ChevronLeft />
      <span>Prev</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn('pr-2', className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRight />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('flex justify-center items-center size-8', className)}
      {...props}
    >
      <MoreHorizontal className="size-3.5" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
