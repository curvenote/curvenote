import { ExternalLink } from 'lucide-react';
import { primitives, ui } from '@curvenote/scms-core';
import { authorInitials, getDoiHref, getNamedAuthors } from './SubmissionSummaryCard.utils.js';

export type SubmissionSummaryCardProps = {
  title: string;
  description: string | undefined;
  authors: { name: string }[];
  publishedOn: string | undefined;
  doi: string | undefined;
};

export function SubmissionSummaryCard({
  title,
  description,
  authors,
  publishedOn,
  doi,
}: SubmissionSummaryCardProps) {
  const namedAuthors = getNamedAuthors(authors);
  const doiHref = getDoiHref(doi);

  return (
    <primitives.Card lift className="p-8 rounded-md">
      <div className="space-y-5">
        <h3 title="submission title" className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h3>

        {namedAuthors.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {namedAuthors.map((author, index) => {
              const initials = authorInitials(author.name);
              return (
                <li key={`${author.name}-${index}`} className="flex gap-2 items-center min-w-0">
                  {initials ? (
                    <ui.Avatar className="w-6 h-6">
                      <ui.AvatarFallback className="text-[10px] font-medium text-muted-foreground">
                        {initials}
                      </ui.AvatarFallback>
                    </ui.Avatar>
                  ) : null}
                  <span className="text-sm truncate text-foreground">{author.name}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {description ? (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold tracking-wide uppercase text-foreground">
              Description
            </div>
            <p title="submission description" className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-sm text-foreground">
          {doi && doiHref ? (
            <a
              href={doiHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex gap-1 items-center hover:text-foreground hover:underline"
            >
              DOI {doi}
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
            </a>
          ) : null}
          {publishedOn ? (
            <div className="ml-auto text-xs text-muted-foreground">{publishedOn}</div>
          ) : null}
        </div>
      </div>
    </primitives.Card>
  );
}
