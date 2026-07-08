import { Building2, Mail } from 'lucide-react';
import { OrcidIcon } from '@scienceicons/react/24/solid';
import type { Affiliation, Author } from './types.js';
import { getAffiliationName } from './affiliationHelpers.js';
import { isValidOrcid } from './validation.js';

export type AuthorSummaryListProps = {
  authors: Author[];
  affiliationList: Affiliation[];
};

function orcidHref(orcid: string): string {
  const trimmed = orcid.trim();
  return trimmed.startsWith('http') ? trimmed : `https://orcid.org/${trimmed}`;
}

/**
 * Read-only, text-first summary of the authors and their affiliations. Rendered
 * as the default view when `AuthorField` is in `simple` mode; the enclosing
 * field provides the Edit affordance that flips to the full editing form.
 */
export function AuthorSummaryList({ authors, affiliationList }: AuthorSummaryListProps) {
  return (
    <div className="space-y-3">
      {authors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No authors added yet.</p>
      ) : (
        <ol className="space-y-3">
          {authors.map((author) => {
            const name = author.name?.trim();
            const orcid = author.orcid?.trim();
            const showOrcid = orcid && isValidOrcid(orcid);
            const affiliations = (author.affiliationIds ?? [])
              .map((id) => ({ id, name: getAffiliationName(affiliationList, id) }))
              .filter((affiliation): affiliation is { id: string; name: string } =>
                Boolean(affiliation.name),
              );
            return (
              <li key={author.id} className="space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className={`text-sm font-semibold ${name ? '' : 'text-muted-foreground/60'}`}
                  >
                    {name || 'Author Name'}
                  </span>
                  {showOrcid && (
                    <a
                      href={orcidHref(orcid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline cursor-pointer shrink-0"
                      aria-label="View ORCID profile"
                    >
                      <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
                    </a>
                  )}
                  {author.corresponding && (
                    <Mail
                      className="w-4 h-4 text-muted-foreground shrink-0"
                      aria-label="Corresponding author"
                    />
                  )}
                </div>
                {affiliations.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {affiliations.map((affiliation, index) => (
                      <span key={affiliation.id}>
                        {index > 0 && ' '}
                        <Building2
                          className="inline-block mb-0.5 mr-1 w-3.5 h-3.5 align-text-bottom"
                          aria-hidden
                        />
                        {affiliation.name}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
