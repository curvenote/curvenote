import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { NavLink, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { MenuIcon } from './MenuIcon.js';
import type { MenuSubItem } from './types.js';
import type { ClientExtension } from '../../modules/index.js';

function SiteSubMenuMark({ logo, siteName }: { logo?: string; siteName?: string }) {
  if (logo) {
    return <img src={logo} alt="" className="object-contain size-5 max-w-5 max-h-5" aria-hidden />;
  }

  if (!siteName) return null;

  return (
    <span
      className="flex justify-center items-center size-5 text-[10px] font-semibold uppercase text-muted-foreground"
      aria-hidden
    >
      {siteName.slice(0, 1)}
    </span>
  );
}

type SubMenuItemProps = {
  icon?: React.ReactNode;
  label: string;
  onMobileSidebarOpened?: () => void;
  name?: string;
  subMenus?: MenuSubItem[];
  extensions?: ClientExtension[];
};

export function SubMenuItem({
  icon,
  label,
  name,
  subMenus,
  onMobileSidebarOpened,
  extensions,
}: SubMenuItemProps) {
  const { pathname } = useLocation();
  const [isOpenSubMenu, setIsOpenSubMenu] = useState(false);

  const isChildrenActive =
    subMenus?.some((item) => pathname === item.url || pathname.startsWith(`${item.url}/`)) ?? false;

  useEffect(() => {
    if (isChildrenActive) {
      setIsOpenSubMenu(true);
    }
  }, [isChildrenActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpenSubMenu(!isOpenSubMenu)}
        className="hover:bg-teal-3000/10 relative my-1 flex h-11 w-full cursor-pointer flex-row items-center justify-between text-base font-light text-stone-600 hover:text-blue-900 focus:outline-hidden dark:text-white dark:hover:text-blue-900"
      >
        <span className="flex items-center min-w-0">
          <span className="inline-flex items-center justify-center ml-2">
            {icon && icon}
            {!icon && name && <MenuIcon name={name} extensions={extensions} />}
          </span>
          <span className="ml-4 text-sm tracking-wide truncate">{label}</span>
        </span>
        <span
          className={cn(
            'mr-4 shrink-0 transition-transform duration-200',
            isOpenSubMenu && 'rotate-180',
          )}
        >
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {isOpenSubMenu &&
        subMenus?.map(({ label: L, url, logo, siteName }) => (
          <NavLink
            key={url}
            onClick={onMobileSidebarOpened}
            to={url}
            className={({ isActive }) =>
              isActive
                ? 'relative my-1 flex h-7 flex-row items-center rounded-md font-medium text-blue-900 hover:text-blue-900 focus:outline-hidden dark:hover:text-blue-900'
                : 'relative my-1 flex h-7 flex-row items-center rounded font-light text-stone-600 hover:text-blue-900 focus:outline-hidden dark:text-white dark:hover:text-blue-900'
            }
          >
            <span className="inline-flex items-center justify-center ml-2 shrink-0">
              <SiteSubMenuMark logo={logo} siteName={siteName} />
            </span>
            <span className="ml-4 text-sm tracking-wide truncate">{L}</span>
          </NavLink>
        ))}
    </div>
  );
}
