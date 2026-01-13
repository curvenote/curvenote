import * as React from 'react';
import { Link } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb.js';
import { cn } from '../../utils/index.js';

export interface BreadcrumbItemConfig {
  label: string;
  href?: string;
  onBack?: () => void;
  isCurrentPage?: boolean;
}

export interface ConfigurableBreadcrumbProps {
  items: BreadcrumbItemConfig[];
  className?: string;
  maxWidth?: string;
  maxItems?: number;
  itemMaxWidth?: string;
}

export function ConfigurableBreadcrumb({
  items,
  className,
  maxItems = 5,
  itemMaxWidth = 'max-w-32',
}: ConfigurableBreadcrumbProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Handle ellipsis when too many items
  const shouldShowEllipsis = items.length > maxItems;
  const visibleItems = shouldShowEllipsis
    ? [
        ...items.slice(0, 1), // Always show first item
        ...items.slice(-maxItems + 2), // Show last maxItems-1 items
      ]
    : items;

  return (
    <Breadcrumb className={cn(className)}>
      <BreadcrumbList>
        {visibleItems.map((item, index) => (
          <React.Fragment key={index}>
            {shouldShowEllipsis && index === 1 && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem className={cn('min-w-0', { [itemMaxWidth]: items.length > 2 })}>
              {item.isCurrentPage ? (
                <BreadcrumbPage className={cn('block', { truncate: items.length > 2 })}>
                  {item.label}
                </BreadcrumbPage>
              ) : item.onBack ? (
                <BreadcrumbLink asChild>
                  <button
                    onClick={item.onBack}
                    className={cn('block cursor-pointer underline-offset-4 hover:underline', {
                      truncate: items.length > 2,
                    })}
                  >
                    {item.label}
                  </button>
                </BreadcrumbLink>
              ) : item.href ? (
                <BreadcrumbLink asChild>
                  <Link
                    to={item.href}
                    prefetch="intent"
                    className={cn('block', { truncate: items.length > 2 })}
                  >
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <span className="block truncate text-muted-foreground">{item.label}</span>
              )}
            </BreadcrumbItem>
            {index < visibleItems.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
