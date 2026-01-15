import { forwardRef } from 'react';
import { useLocation } from 'react-router';
import { cn } from '../../utils/index.js';
import { FrameHeader } from '../FrameHeader.js';
import { ConfigurableBreadcrumb, type BreadcrumbItemConfig } from '../ui/ConfigurableBreadcrumb.js';
import { useDeploymentConfig } from '../../providers/DeploymentProvider.js';

interface PageFrameProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  hasSecondaryNav?: boolean;
  breadcrumbs?: BreadcrumbItemConfig[];
  children: React.ReactNode;
}

/**
 * PageFrame component that can use page configuration from app config
 */
export const PageFrame = forwardRef<HTMLDivElement, PageFrameProps>(function PageFrame(
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
  const location = useLocation();
  const deploymentConfig = useDeploymentConfig();

  // Look up current path in pages config
  const pageConfig = deploymentConfig.pages?.find((page) => page.path === location.pathname);

  // Use page config if found, otherwise use props
  // Props take precedence if both are provided
  const finalTitle = pageConfig?.title ?? propTitle;
  const finalSubtitle = pageConfig?.subtitle ?? propSubtitle;
  const finalDescription = pageConfig?.description ?? propDescription;
  const finalHeader = propHeader;
  const finalClassName = propClassName;
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
      <div className="space-y-12">{children}</div>
    </div>
  );
});
