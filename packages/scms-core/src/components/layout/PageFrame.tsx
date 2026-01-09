import { forwardRef } from 'react';
import { cn } from '../../utils/index.js';
import { FrameHeader } from '../FrameHeader.js';
import { ConfigurableBreadcrumb, type BreadcrumbItemConfig } from '../ui/ConfigurableBreadcrumb.js';
import { PageFrameProvider, usePageFrame } from './PageFrameProvider.js';

interface PageFrameProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  hasSecondaryNav?: boolean;
  breadcrumbs?: BreadcrumbItemConfig[];
  children: React.ReactNode;
  enableProvider?: boolean;
}

/**
 * PageFrame component with optional provider support for dynamic updates
 */
export const PageFrame = forwardRef<HTMLDivElement, PageFrameProps>(function PageFrame(
  {
    title,
    subtitle,
    description,
    header,
    children,
    className,
    hasSecondaryNav = true,
    breadcrumbs,
    enableProvider = false,
  },
  ref,
) {
  // If provider is enabled, wrap children with PageFrameProvider
  if (enableProvider) {
    return (
      <PageFrameProvider
        initialProps={{
          title,
          subtitle,
          description,
          header,
          className,
          hasSecondaryNav,
          breadcrumbs,
        }}
      >
        <PageFrameContent ref={ref}>{children}</PageFrameContent>
      </PageFrameProvider>
    );
  }

  // Default behavior without provider
  return (
    <PageFrameContent
      ref={ref}
      title={title}
      subtitle={subtitle}
      description={description}
      header={header}
      className={className}
      hasSecondaryNav={hasSecondaryNav}
      breadcrumbs={breadcrumbs}
    >
      {children}
    </PageFrameContent>
  );
});

/**
 * Internal PageFrame content component that can use context or props
 */
const PageFrameContent = forwardRef<HTMLDivElement, PageFrameProps>(function PageFrameContent(
  {
    title: propTitle,
    subtitle: propSubtitle,
    description: propDescription,
    header: propHeader,
    children,
    className: propClassName,
    hasSecondaryNav: propHasSecondaryNav = true,
    breadcrumbs: propBreadcrumbs,
  },
  ref,
) {
  // Try to use context, fall back to props
  let contextState: any = {};
  try {
    const { state } = usePageFrame();
    contextState = state;
  } catch {
    // Not in provider context, use props
  }

  // Merge context state with props (props take precedence)
  const finalTitle = propTitle ?? contextState.title;
  const finalSubtitle = propSubtitle ?? contextState.subtitle;
  const finalDescription = propDescription ?? contextState.description;
  const finalHeader = propHeader ?? contextState.header;
  const finalClassName = propClassName ?? contextState.className;
  const finalHasSecondaryNav = propHasSecondaryNav ?? contextState.hasSecondaryNav ?? true;
  const finalBreadcrumbs = propBreadcrumbs ?? contextState.breadcrumbs;

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
      <div className="space-y-12">{children}</div>
    </div>
  );
});
