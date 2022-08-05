import type { Link } from 'myst-spec';
import { Link as RemixLink } from '@remix-run/react';
import { ExternalLinkIcon, LinkIcon } from '@heroicons/react/outline';
import type { NodeRenderer } from './types';

type TransformedLink = Link & { internal?: boolean };

export const link: NodeRenderer<TransformedLink> = (node, children) => {
  const internal = node.internal ?? false;
  if (internal) {
    return (
      <RemixLink key={node.key} to={node.url} prefetch="intent">
        {children}
      </RemixLink>
    );
  }
  return (
    <a key={node.key} target="_blank" href={node.url} rel="noreferrer">
      {children}
    </a>
  );
};

export const linkBlock: NodeRenderer<TransformedLink> = (node, children) => {
  const iconClass = 'w-6 h-6 self-center transition-transform flex-none ml-3';
  const containerClass =
    'flex-1 p-4 my-4 block border font-normal hover:border-blue-500 dark:hover:border-blue-400 no-underline hover:text-blue-600 dark:hover:text-blue-400 text-gray-600 dark:text-gray-100 border-gray-200 dark:border-gray-500 rounded shadow-sm hover:shadow-lg dark:shadow-neutral-700';
  const internal = node.internal ?? false;
  const nested = (
    <div className="flex align-middle h-full">
      <div className="flex-grow">
        {node.title}
        <div className="text-xs text-gray-500 dark:text-gray-400">{children}</div>
      </div>
      {internal && <LinkIcon className={iconClass} />}
      {!internal && <ExternalLinkIcon className={iconClass} />}
    </div>
  );

  if (internal) {
    return (
      <RemixLink key={node.key} to={node.url} prefetch="intent" className={containerClass}>
        {nested}
      </RemixLink>
    );
  }
  return (
    <a
      key={node.key}
      className={containerClass}
      target="_blank"
      rel="noopener noreferrer"
      href={node.url}
    >
      {nested}
    </a>
  );
};

const LINK_RENDERERS = {
  link,
  linkBlock,
};

export default LINK_RENDERERS;
