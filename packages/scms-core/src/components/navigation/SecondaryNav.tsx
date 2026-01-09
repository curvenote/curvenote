import { MenuItem } from './MenuItem.js';
import { cn } from '../../utils/cn.js';
import { SiteLogo } from '../SiteLogo.js';
import { useMobile } from './Mobile.js';
import type { MenuContents, ServerSideMenuContents } from './types.js';
import type { ClientExtension } from '../../modules/index.js';

export function SecondaryNav({
  contents,
  detailsCard,
  branding,
  title,
  subtitle,
  extensions,
}: {
  contents: ServerSideMenuContents | MenuContents;
  detailsCard?: React.ReactNode;
  branding?: { logo?: string; logo_dark?: string; url?: string; badge?: React.ReactNode };
  title?: string;
  subtitle?: string;
  extensions?: ClientExtension[];
}) {
  const { open } = useMobile();

  return (
    <aside
      className={cn(
        'fixed z-20 flex-col space-y-2 h-full duration-500 left-[110px] xl:shadow-lg bg-stone-100 xl:dark:shadow-dark-visible dark:bg-stone-800',
        'transition-transform duration-150 ease-in-out transform',
        'flex pr-2 pl-4 w-[280px]',
        { '-translate-x-[390px] xl:translate-x-0': !open, 'translate-x-0': open },
      )}
    >
      {branding && (
        <>
          {branding.url ? (
            <div className="pt-[60px]">
              <a className="flex flex-col items-center justify-center" href={branding.url}>
                <SiteLogo
                  className="object-cover h-10 mb-4"
                  alt={title ?? ''}
                  logo={branding.logo}
                  logo_dark={branding.logo_dark}
                />
                <div className="my-[2px] text-2xl font-normal text-black dark:text-white">
                  {title}
                </div>
              </a>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center pt-[60px]">
              {branding.logo && (
                <SiteLogo
                  className="object-cover h-10 mb-4"
                  alt={title ?? ''}
                  logo={branding.logo}
                  logo_dark={branding.logo_dark}
                />
              )}
              {branding.badge && <div className="mb-4">{branding.badge}</div>}
              <div className="my-[2px] text-2xl font-normal text-black dark:text-white">
                {title}
              </div>
            </div>
          )}
        </>
      )}
      {detailsCard && <div className="pt-12">{detailsCard}</div>}
      {!branding && !detailsCard && (
        <div className="flex flex-col items-left px-2 pt-[56px]">
          <h1 className="font-normal test-2xl">{title}</h1>
          {subtitle && <div className="py-1 font-normal txt-base">{subtitle}</div>}
        </div>
      )}
      <div className="h-full overflow-x-hidden overflow-y-auto grow scrollbar scrollbar-thin scrollbar-track-stone-100 scrollbar-thumb-stone-500 dark:scrollbar-track-stone-800 dark:scrollbar-thumb-stone-400">
        {contents.map(({ sectionName, menus }) => (
          <ul key={sectionName ?? menus.reduce((acc, i) => `${acc}-${i}`, '')}>
            <>
              {open && sectionName && (
                <li className="px-5">
                  <div className="flex flex-row items-center h-8">
                    <div className="text-xs font-light uppercase text-stone-800 dark:text-white">
                      {sectionName}
                    </div>
                  </div>
                </li>
              )}
              <MenuItem menus={menus} open={open} extensions={extensions} />
            </>
          </ul>
        ))}
      </div>
    </aside>
  );
}
