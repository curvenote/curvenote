import * as React from 'react';
import { Link } from 'react-router';
import type { FormPage } from './types.js';
import { cn } from '@curvenote/scms-core';

type PageNavProps = {
  basePath: string;
  currentPageSlug: string;
  formPages: FormPage[];
  /** If provided, Continue is only allowed when this returns true. Called on click; navigation is prevented when false. */
  onBeforeContinue?: () => boolean;
  /** When true, Continue is shown but disabled (e.g. when validation errors are visible). */
  continueDisabled?: boolean;
};

export function PageNav({
  basePath,
  currentPageSlug,
  formPages,
  onBeforeContinue,
  continueDisabled = false,
}: PageNavProps) {
  const currentIndex = formPages.findIndex((p) => p.slug === currentPageSlug);
  const prevPage = currentIndex > 0 ? formPages[currentIndex - 1] : null;
  const nextPage =
    currentIndex >= 0 && currentIndex < formPages.length - 1 ? formPages[currentIndex + 1] : null;
  const prevHref = prevPage ? `${basePath}${prevPage.slug}` : null;
  const nextHref = nextPage ? `${basePath}${nextPage.slug}` : null;

  const handleContinueClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onBeforeContinue && !onBeforeContinue()) {
      e.preventDefault();
    }
  };

  const continueClassName =
    'inline-flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-md transition-colors';

  return (
    <div className="flex justify-between items-center pt-6 mt-6 border-t border-border">
      {prevHref ? (
        <Link
          to={prevHref}
          className={cn(
            continueClassName,
            'text-foreground bg-background border border-border hover:bg-muted',
          )}
        >
          ‹ Back
        </Link>
      ) : (
        <span />
      )}
      {nextHref ? (
        continueDisabled ? (
          <span
            className={cn(
              continueClassName,
              'text-white bg-[#3E7AA9]/60 cursor-not-allowed border border-transparent',
            )}
            aria-disabled="true"
          >
            Continue ›
          </span>
        ) : (
          <Link
            to={nextHref}
            onClick={handleContinueClick}
            className={cn(
              continueClassName,
              'text-white bg-[#3E7AA9] hover:bg-[#3E7AA9]/90 border border-transparent',
            )}
          >
            Continue ›
          </Link>
        )
      ) : (
        <span />
      )}
    </div>
  );
}
