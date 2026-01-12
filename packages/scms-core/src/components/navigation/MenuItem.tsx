import { NavLink } from 'react-router';
import React from 'react';
import { SubMenuItem } from './SubMenuItem.js';
import { MenuIcon } from './MenuIcon.js';
import type { ClientExtension } from '../../modules/index.js';

type MenuItemProps = {
  open: boolean;
  onMobileSidebarOpened?: () => void;
  extensions?: ClientExtension[];
  menus: {
    icon?: React.ReactNode;
    label: string;
    name?: string;
    url: string;
    end?: boolean;
    subMenus?: {
      label: string;
      url: string;
    }[];
  }[];
};

export function MenuItem({ open, menus, onMobileSidebarOpened, extensions }: MenuItemProps) {
  return (
    <li className="flex flex-col">
      {menus.map(({ label, icon, url, name, end, subMenus }) => (
        <div key={label}>
          {subMenus ? (
            <SubMenuItem
              icon={icon}
              open={open}
              label={label}
              subMenus={subMenus}
              onMobileSidebarOpened={onMobileSidebarOpened}
              extensions={extensions}
            />
          ) : (
            <NavLink
              to={url}
              end={end}
              onClick={onMobileSidebarOpened}
              className={({ isActive }) =>
                isActive
                  ? 'relative my-1 flex h-11 flex-row items-center text-base font-medium text-blue-900 hover:underline dark:text-white focus:outline-hidden dark:hover:underline'
                  : 'hover:bg-teal-3000/10 relative my-1 flex h-11 flex-row items-center text-base font-light text-stone-600 hover:text-blue-900 hover:underline focus:outline-hidden dark:text-white dark:hover:underline'
              }
            >
              <span className="inline-flex items-center justify-center ml-2">
                {' '}
                {icon && typeof icon !== 'string' && icon}
                {(!icon || typeof icon === 'string') && name && (
                  <MenuIcon name={(icon as string | undefined) ?? name} extensions={extensions} />
                )}
              </span>
              <span className="ml-4 text-sm tracking-wide truncate">{label}</span>
            </NavLink>
          )}
        </div>
      ))}
    </li>
  );
}
