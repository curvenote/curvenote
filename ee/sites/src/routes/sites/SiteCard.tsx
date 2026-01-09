import { Link } from 'react-router';
import type { UserSiteDTO } from '@curvenote/common';
import { primitives, SiteLogo } from '@curvenote/scms-core';
import { ExternalLinkIcon, Server } from 'lucide-react';

export default function SiteCard({ site }: { site: UserSiteDTO }) {
  return (
    <primitives.Card className="h-auto space-y-1 lg:p-6" lift>
      <Link className="block" prefetch="none" to={`/app/sites/${site.name}`}>
        <SiteLogo
          className="object-cover mb-4 h-14"
          alt={site.title}
          logo={site.logo}
          logo_dark={site.logo_dark}
        />
      </Link>
      <Link
        prefetch="none"
        to={`/app/sites/${site.name}`}
        className="block no-underline hover:underline"
      >
        <h2>{site.title}</h2>
      </Link>
      {site.external && (
        <div className="flex items-center gap-1 mt-[10px]">
          <Server className="inline-block w-3 h-3 align-middle" />
          <span className="font-mono text-xs dark:text-white">Integration</span>
        </div>
      )}
      {site.url && (
        <Link
          prefetch="none"
          to={site.url}
          className="font-mono text-xs underline dark:text-white"
          target="_blank"
        >
          {site.url}
          <ExternalLinkIcon className="inline-block w-3 h-3 ml-1 align-middle" />
        </Link>
      )}
    </primitives.Card>
  );
}
