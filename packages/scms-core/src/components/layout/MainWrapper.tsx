import { cn } from '../../utils/index.js';
import { StatusBarContent } from './StatusBarContent.js';

export function MainWrapper({
  children,
  hasSecondaryNav,
}: {
  children: React.ReactNode;
  hasSecondaryNav?: boolean;
}) {
  return (
    <main
      data-name="main-wrapper"
      className={cn(
        'max-w-none',
        'overflow-hidden flex-1 w-full h-full hide-scrollbar',
        'mx-2', // mobile padding
        'pb-6', // bottom padding for status bar (24px)
        'relative', // for absolute positioning of status bar
        {
          'xl:ml-[280px]': hasSecondaryNav,
          'xl:pl-8 2xl:pl-16': !hasSecondaryNav,
        }, // desktop padding
      )}
    >
      {children}
      <StatusBarContent hasSecondaryNav={hasSecondaryNav} />
    </main>
  );
}
