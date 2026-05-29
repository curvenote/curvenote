import { ExternalLink } from 'lucide-react';
import { buildUrl, doi as doiUtils } from 'doi-utils';
import { ui } from '@curvenote/scms-core';

export function DoiBadge({ doi }: { doi: string }) {
  const label = doiUtils.normalize(doi) ?? doi;
  const href = buildUrl(doi);
  if (!href) return null;

  return (
    <ui.Badge
      variant="outline-muted"
      size="xs"
      className="font-normal px-1.5 py-0 font-mono"
      asChild
    >
      <a href={href} target="_blank" rel="noopener noreferrer" title={label}>
        DOI {label}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </ui.Badge>
  );
}
