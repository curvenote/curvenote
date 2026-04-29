import { forwardRef } from 'react';
import { cn } from '../../utils/index.js';
import { FrameHeader } from '../FrameHeader.js';
import { ConfigurableBreadcrumb, type BreadcrumbItemConfig } from '../ui/ConfigurableBreadcrumb.js';

interface PageFrameProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  hasSecondaryNav?: boolean;
  breadcrumbs?: BreadcrumbItemConfig[];
  children: React.ReactNode;
}

export const PageFrame = forwardRef<HTMLDivElement, PageFrameProps>(function PageFrame(
  {
    title: propTitle,
    subtitle: propSubtitle,
    description: propDescription,
    header: propHeader,
    children,
    className: propClassName,
    containerClassName: propContainerClassName,
    hasSecondaryNav: propHasSecondaryNav = true,
    breadcrumbs: propBreadcrumbs,
  },
  ref,
) {
  const finalTitle = propTitle;
  const finalSubtitle = propSubtitle;
  const finalDescription = propDescription;
  const finalHeader = propHeader;
  const finalClassName = propClassName;
  const finalContainerClassName = propContainerClassName;
  const finalHasSecondaryNav = propHasSecondaryNav ?? true;
  const finalBreadcrumbs = propBreadcrumbs;

  return (
    <div
      ref={ref}
      data-name="page-frame"
      className={cn(
        'relative py-16 pr-4 w-full xl:mt-0 xl:py-[56px] xl:pr-8 2xl:pr-16',
        {
          'xl:pl-10 2xl:pl-16 max-w-[1400px]': finalHasSecondaryNav,
          'max-w-[1680px]': !finalHasSecondaryNav,
        },
        finalClassName,
      )}
    >
      {finalBreadcrumbs && finalBreadcrumbs.length > 0 && (
        <div className="mb-4">
          <ConfigurableBreadcrumb items={finalBreadcrumbs} />
        </div>
      )}
      {(finalHeader || finalTitle || finalSubtitle || finalDescription) && (
        <div className="mb-12">
          {finalHeader || (
            <FrameHeader
              title={finalTitle}
              subtitle={finalSubtitle}
              description={finalDescription}
            />
          )}
        </div>
      )}
      <div className={cn('space-y-12', finalContainerClassName)}>{children}</div>
    </div>
  );
});
