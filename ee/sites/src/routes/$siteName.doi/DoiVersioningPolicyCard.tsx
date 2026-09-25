import { ExternalLink } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { DOI_VERSIONING_DOCS_URL } from './doi.utils.js';

/** Read-only: every DOI resolves to the latest published version of its Work. */
export function DoiVersioningPolicyCard() {
  return (
    <ui.Card className="px-6 py-4 space-y-2">
      <h2>Versioning policy</h2>
      <p className="text-sm font-medium">DOI links to latest</p>
      <p className="text-sm font-light">
        The DOI links to the latest published version of the Work.
      </p>
      <a
        className="inline-flex gap-1 items-center text-sm text-primary hover:underline"
        href={DOI_VERSIONING_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Learn how DOI versioning works
        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
      </a>
    </ui.Card>
  );
}
