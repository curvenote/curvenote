import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { NavLink, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { MenuIcon } from './MenuIcon.js';
import type { ClientExtension } from '../../modules/index.js';

type SubMenuItemProps = {
  open: boolean;
  icon?: React.ReactNode;
  label: string;
  onMobileSidebarOpened?: () => void;
  name?: string;
  subMenus?: {
    label: string;
    url: string;
  }[];
  extensions?: ClientExtension[];
};

export function SubMenuItem({
  icon,
  open,
  label,
  name,
  subMenus,
  onMobileSidebarOpened,
  extensions,
}: SubMenuItemProps) {
  const { pathname } = useLocation();
  const [isOpenSubMenu, setIsOpenSubMenu] = useState(false);
  const [isShownMinSubMenu, setIsShownMinSubMenu] = useState<null | boolean>(false);

  const isChildrenActive = subMenus && subMenus?.some((item) => item.url === pathname);

  useEffect(() => {
    if (isChildrenActive) {
      setIsOpenSubMenu(true);
    }
  }, []);

  return (
    <div
      className="group"
      onMouseEnter={() => setIsShownMinSubMenu(true)}
      onMouseLeave={() => setIsShownMinSubMenu(false)}
    >
      <button
        onClick={() => setIsOpenSubMenu(!isOpenSubMenu)}
        className={cn(
          isChildrenActive
            ? "relative my-1 flex h-11 w-full flex-row items-center  text-base font-medium text-blue-900 before:block before:h-full before:w-1 before:rounded-r-full before:bg-blue-900 before:content-[''] hover:text-blue-900 focus:outline-hidden dark:hover:text-blue-900"
            : 'relative my-1 flex h-11 w-full flex-row items-center justify-between border-l-4 border-transparent text-base font-light text-stone-600 hover:text-blue-900 focus:outline-hidden  dark:text-white dark:hover:text-blue-900',
        )}
      >
        <span className="flex justify-between w-full">
          <span className="flex items-center">
            <span className="inline-flex items-center justify-center ml-4">
              {icon && icon}
              {!icon && name && <MenuIcon name={name} extensions={extensions} />}
            </span>
            {open && <span className="ml-4 text-sm tracking-wide truncate">{label}</span>}
          </span>
          {open && (
            <span
              className={cn('mr-4 transition-transform duration-200', isOpenSubMenu && 'rotate-90')}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </span>
          )}
        </span>
      </button>

      {!open && subMenus && isShownMinSubMenu !== null && (
        <div
          className={cn(
            isShownMinSubMenu ? 'visible' : 'invisible',
            ' absolute left-full hidden h-auto w-40 transform rounded-md bg-white p-4 opacity-0 shadow-[0px_5px_54px_rgba(0,0,0,0.05)] backdrop-blur-lg transition-all duration-300 group-focus-within:visible group-focus-within:opacity-100 group-hover:opacity-100  dark:bg-stone-900 xl:block',
          )}
        >
          <div>
            {subMenus.map(({ label: L, url }) => (
              <NavLink
                key={L}
                onClick={() => setIsShownMinSubMenu(null)}
                to={url}
                className={({ isActive }) =>
                  isActive
                    ? 'relative my-1 flex h-7 flex-row items-center rounded-md font-medium text-blue-900 hover:text-blue-900 focus:outline-hidden dark:hover:text-blue-900'
                    : 'relative my-1 flex h-7 flex-row items-center rounded font-light text-stone-600 hover:text-blue-900 focus:outline-hidden dark:text-white dark:hover:text-blue-900'
                }
              >
                <span className="text-sm tracking-wide truncate">{L}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {isOpenSubMenu &&
        open &&
        subMenus?.length &&
        subMenus.map(({ label: L, url }) => (
          <NavLink
            key={L}
            onClick={onMobileSidebarOpened}
            to={url}
            className={({ isActive }) =>
              isActive
                ? 'relative my-1 flex h-7 flex-row items-center rounded-md font-medium text-blue-900 hover:text-blue-900 focus:outline-hidden dark:hover:text-blue-900'
                : 'relative my-1 flex h-7 flex-row items-center rounded font-light text-stone-600 hover:text-blue-900 focus:outline-hidden dark:text-white dark:hover:text-blue-900'
            }
          >
            <span className="text-sm tracking-wide truncate ml-14">{L}</span>
          </NavLink>
        ))}
    </div>
  );
}
