import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { dbListAllDomains } from './db.server';
import { DomainRow } from './DomainRow';
import { useEffect, useRef, useState } from 'react';

type DomainsDBO = Awaited<ReturnType<typeof dbListAllDomains>>;

// Subtle background colors for different sites
const SITE_BACKGROUNDS = [
  'bg-gray-50', // Light gray
  'bg-blue-50', // Light blue
  'bg-green-50', // Light green
  'bg-purple-50', // Light purple
  'bg-orange-50', // Light orange
  'bg-pink-50', // Light pink
  'bg-yellow-50', // Light yellow
  'bg-indigo-50', // Light indigo
  'bg-teal-50', // Light teal
  'bg-rose-50', // Light rose
];

export function DomainManagement() {
  const fetcher = useFetcher<{
    error?: string;
    domains?: DomainsDBO;
  }>();
  const tableRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | null>(null);

  // Update min height when domains are loaded
  useEffect(() => {
    if (fetcher.data?.domains && tableRef.current && !minHeight) {
      setMinHeight(tableRef.current.offsetHeight);
    }
  }, [fetcher.data?.domains, minHeight]);

  // Sort domains by site name and then by hostname
  const sortedDomains = [...(fetcher.data?.domains ?? [])].sort((a, b) => {
    // First sort by site name
    const siteCompare = a.site.name.localeCompare(b.site.name);
    if (siteCompare !== 0) return siteCompare;
    // Then sort by hostname
    return a.hostname.localeCompare(b.hostname);
  });

  // Get unique sites in order
  const uniqueSites = Array.from(
    new Map(sortedDomains.map((domain) => [domain.site_id, domain.site.name])).values(),
  );

  // Determine which sites have primary domains
  const sitesWithPrimaryDomains = sortedDomains.reduce((acc, domain) => {
    if (domain.default) {
      acc.add(domain.site_id);
    }
    return acc;
  }, new Set<string>());

  return (
    <div>
      <h2 className="text-xl font-bold">Domain Management</h2>
      <p className="max-w-xl">
        View and manage domains across all sites. You can set a domain as the primary for its site.
      </p>
      <fetcher.Form method="POST" className="py-4">
        <input type="hidden" name="action" value="list-domains" />
        <ui.StatefulButton type="submit" busy={fetcher.state === 'submitting'} overlayBusy>
          List Domains
        </ui.StatefulButton>
      </fetcher.Form>

      <div className="my-8" style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}>
        {fetcher.data?.domains && (
          <div ref={tableRef}>
            <table className="font-mono text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-1 text-left">Site</th>
                  <th className="px-3 py-1 text-left">Domain</th>
                  <th className="px-3 py-1 text-left">Status</th>
                  <th className="px-3 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDomains.map((domain) => {
                  const siteIndex = uniqueSites.indexOf(domain.site.name);
                  const backgroundColor = SITE_BACKGROUNDS[siteIndex % SITE_BACKGROUNDS.length];

                  return (
                    <DomainRow
                      key={domain.id}
                      domain={domain}
                      isFirstInSite={
                        domain === sortedDomains.find((d) => d.site_id === domain.site_id)
                      }
                      isLastInSite={
                        domain ===
                        sortedDomains
                          .slice()
                          .reverse()
                          .find((d) => d.site_id === domain.site_id)
                      }
                      hasPrimaryDomain={sitesWithPrimaryDomains.has(domain.site_id)}
                      backgroundColor={backgroundColor}
                      fetcher={fetcher}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {fetcher.data?.error && <div className="mt-2 text-red-500">{fetcher.data.error}</div>}
    </div>
  );
}
