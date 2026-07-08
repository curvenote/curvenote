import { Building2, Mail, Pencil } from 'lucide-react';
import { OrcidIcon } from '@scienceicons/react/24/solid';
import * as ui from '../ui/index.js';
import type { Affiliation, Author } from './types.js';
import { getAffiliationName } from './affiliationHelpers.js';
import { isValidOrcid } from './validation.js';

export type AuthorSummaryListProps = {
  authors: Author[];
  affiliationList: Affiliation[];
  onEdit: () => void;
  /** Label for the edit affordance; defaults to 'Edit'. */
  editLabel?: string;
};

function orcidHref(orcid: string): string {
  const trimmed = orcid.trim();
  return trimmed.startsWith('http') ? trimmed : `https://orcid.org/${trimmed}`;
}

/**
 * Read-only, text-first summary of the authors and their affiliations. Rendered
 * as the default view when `AuthorField` is in `simple` mode; an Edit button
 * flips the field to the full editing form.
 */
export function AuthorSummaryList({
  authors,
  affiliationList,
  onEdit,
  editLabel = 'Edit',
}: AuthorSummaryListProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ui.Button
          type="button"
          variant="link"
          size="sm"
          onClick={onEdit}
          className="h-auto text-muted-foreground cursor-pointer hover:text-foreground"
        >
          <Pencil className="mr-1 w-3.5 h-3.5 shrink-0" aria-hidden />
          {editLabel}
        </ui.Button>
      </div>
      {authors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No authors added yet.</p>
      ) : (
        <ol className="space-y-3">
          {authors.map((author) => {
            const name = author.name?.trim();
            const orcid = author.orcid?.trim();
            const showOrcid = orcid && isValidOrcid(orcid);
            const affiliationNames = (author.affiliationIds ?? [])
              .map((id) => getAffiliationName(affiliationList, id))
              .filter(Boolean);
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
                {affiliationNames.length > 0 && (
                  <div className="flex gap-1.5 items-start text-sm text-muted-foreground">
                    <Building2 className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden />
                    <span>{affiliationNames.join('; ')}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
