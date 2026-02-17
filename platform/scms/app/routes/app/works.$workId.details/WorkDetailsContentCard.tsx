import { ExternalLink } from 'lucide-react';
import { primitives, summarizeAuthors, ui } from '@curvenote/scms-core';

type AuthorLike = { name?: string; family?: string; given?: string };

type WorkVersionForCard = {
  title: string;
  authors: string[];
  author_details?: unknown[];
  doi?: string | null;
  /** Accepts Prisma JsonValue (string | number | boolean | object | array | null) and other shapes */
  metadata?: unknown;
};

function getAuthorsForDisplay(version: WorkVersionForCard): AuthorLike[] {
  const details = version.author_details;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d) => {
      if (d && typeof d === 'object' && 'name' in d)
        return { name: String((d as { name?: string }).name) };
      if (d && typeof d === 'object' && ('family' in d || 'given' in d))
        return {
          family: (d as { family?: string }).family,
          given: (d as { given?: string }).given,
        };
      return { name: '' };
    });
  }
  return (version.authors ?? []).map((name) => ({ name }));
}

function getLicenseDisplay(version: WorkVersionForCard): { text: string; tooltip?: string } {
  const meta = version.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const record = meta as Record<string, unknown>;
    const license = record.license;
    if (license != null && license !== '') {
      if (typeof license === 'string') return { text: license };
      if (typeof license === 'object' && license !== null && 'content' in license) {
        const content = (license as { content?: { id?: string; name?: string } }).content;
        const id = content?.id ?? content?.name;
        if (id) return { text: String(id) };
      }
    }
  }
  return { text: 'unknown', tooltip: 'No license has been set.' };
}

export function WorkDetailsContentCard({ version }: { version: WorkVersionForCard | null }) {
  if (!version) {
    return (
      <primitives.Card className="p-6">
        <p className="text-sm text-muted-foreground">No published version yet.</p>
      </primitives.Card>
    );
  }

  const authorsForDisplay = getAuthorsForDisplay(version);
  const authorSummary = summarizeAuthors(authorsForDisplay, { maxDisplay: 5 }) || 'Unknown authors';
  const licenseDisplay = getLicenseDisplay(version);
  const hasDoi = version.doi != null && String(version.doi).trim() !== '';
  const doiValue = hasDoi ? String(version.doi).trim() : 'none';
  const doiHref = hasDoi ? `https://doi.org/${encodeURIComponent(doiValue)}` : null;

  return (
    <primitives.Card lift className="px-4 pt-6 pb-4 space-y-2">
      <h2 className="text-2xl font-medium tracking-tight text-foreground">
        {version.title || 'Untitled Work'}
      </h2>
      <div className="text-base text-muted-foreground">{authorSummary}</div>
      <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm">
        <div>
          <span className="font-medium text-foreground">DOI </span>
          {doiHref ? (
            <a
              href={doiHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex gap-1 items-center font-mono text-muted-foreground hover:text-foreground hover:underline"
            >
              {doiValue}
              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="font-mono text-muted-foreground">{doiValue}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-foreground">License </span>
          {licenseDisplay.tooltip ? (
            <ui.Tooltip>
              <ui.TooltipTrigger asChild>
                <span className="underline cursor-help text-muted-foreground decoration-dotted decoration-muted-foreground">
                  {licenseDisplay.text}
                </span>
              </ui.TooltipTrigger>
              <ui.TooltipContent className="text-background">
                <p className="text-background">{licenseDisplay.tooltip}</p>
              </ui.TooltipContent>
            </ui.Tooltip>
          ) : (
            <span className="text-muted-foreground">{licenseDisplay.text}</span>
          )}
        </div>
      </div>
    </primitives.Card>
  );
}
