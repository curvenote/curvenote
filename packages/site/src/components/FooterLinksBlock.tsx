import classNames from 'classnames';
import { Link } from '@remix-run/react';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/outline';
import type { FooterLinks, NavigationLink } from '@curvenote/site-common';

const FooterLink = ({ title, url, group, right }: NavigationLink & { right?: boolean }) => {
  return (
    <Link
      prefetch="intent"
      className="group flex-1 p-4 block border font-normal hover:border-blue-600 dark:hover:border-blue-400 no-underline hover:text-blue-600 dark:hover:text-blue-400 text-gray-600 dark:text-gray-100 border-gray-200 dark:border-gray-500 rounded shadow-sm hover:shadow-lg dark:shadow-neutral-700"
      to={url}
    >
      <div className="flex align-middle h-full">
        {right && (
          <ArrowLeftIcon className="w-6 h-6 self-center transition-transform group-hover:-translate-x-1" />
        )}
        <div className={classNames('flex-grow', { 'text-right': right })}>
          <div className="text-xs text-gray-500 dark:text-gray-400">{group || ' '}</div>
          {title}
        </div>
        {!right && (
          <ArrowRightIcon className="w-6 h-6 self-center transition-transform group-hover:translate-x-1" />
        )}
      </div>
    </Link>
  );
};

export function FooterLinksBlock({ links }: { links?: FooterLinks }) {
  if (!links) return null;
  return (
    <div className="flex space-x-4 my-10">
      {links.navigation?.prev && <FooterLink {...links.navigation?.prev} right />}
      {links.navigation?.next && <FooterLink {...links.navigation?.next} />}
    </div>
  );
}
