import { cn } from '../../utils/cn.js';
import React from 'react';
import type { HTMLAttributes } from 'react';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
});
