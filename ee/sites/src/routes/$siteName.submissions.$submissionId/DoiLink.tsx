import { ExternalLink } from 'lucide-react';
import { buildUrl } from 'doi-utils';

type DoiLinkProps = {
  doi: string;
};

export function DoiLink({ doi }: DoiLinkProps) {
  return (
    <a
      href={buildUrl(doi)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex gap-1 items-center text-sm break-all text-primary hover:underline"
    >
      {doi}
      <ExternalLink className="inline-block w-4 h-4 shrink-0" aria-hidden />
    </a>
  );
}
