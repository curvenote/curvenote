import { formatDistanceToNow } from 'date-fns';
import { PlusIcon, Trash2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cn, ui } from '@curvenote/scms-core';
import type { SubmissionDetailSlugRow } from './types.js';

type SlugManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slugs: SubmissionDetailSlugRow[];
  fallback: string;
  baseUrl: string;
  draftSlug: string;
  onDraftSlugChange: (value: string) => void;
  addSlugError?: string;
  isSubmitting: boolean;
  onAdd: () => void;
  onRequestRemove: (slugId: string, slug: string) => void;
  onRequestSetPrimary: (slugId: string, slug: string) => void;
};

type SlugListRowProps = {
  slug: string;
  href: string;
  badge?: 'Primary' | 'Default';
  updatedLabel: string;
  muted?: boolean;
  onSetPrimary?: () => void;
  onRemove?: () => void;
  isSubmitting: boolean;
};

function SlugListRow({
  slug,
  href,
  badge,
  updatedLabel,
  muted,
  onSetPrimary,
  onRemove,
  isSubmitting,
}: SlugListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0',
        muted && 'bg-muted/50',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            className={cn(
              'truncate text-sm hover:underline',
              muted ? 'text-muted-foreground' : 'text-foreground',
              badge === 'Primary' && 'font-medium',
            )}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {slug}
          </a>
          {badge ? (
            <ui.Badge variant="outline-muted" size="sm">
              {badge}
            </ui.Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{updatedLabel}</p>
      </div>
      {(onSetPrimary || onRemove) && (
        <div className="flex shrink-0 items-center gap-2">
          {onSetPrimary && (
            <ui.Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={isSubmitting}
              onClick={onSetPrimary}
              className="text-muted-foreground hover:text-foreground"
            >
              Set as primary
            </ui.Button>
          )}
          {onRemove && (
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Remove slug"
              aria-label={`Remove ${slug}`}
              disabled={isSubmitting}
              onClick={onRemove}
            >
              <Trash2 aria-hidden />
            </ui.Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SlugManagerDialog({
  open,
  onOpenChange,
  slugs,
  fallback,
  baseUrl,
  draftSlug,
  onDraftSlugChange,
  addSlugError,
  isSubmitting,
  onAdd,
  onRequestRemove,
  onRequestSetPrimary,
}: SlugManagerDialogProps) {
  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    onAdd();
  };

  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent variant="wide">
        <ui.DialogHeader>
          <ui.DialogTitle>Manage slugs</ui.DialogTitle>
          <ui.DialogDescription>
            The primary slug is the public URL. Removing a slug breaks existing external links that
            use it.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-border">
            {slugs.map((slugRow) => (
              <SlugListRow
                key={slugRow.id}
                slug={slugRow.slug}
                href={`${baseUrl}${slugRow.slug}`}
                badge={slugRow.primary ? 'Primary' : undefined}
                updatedLabel={`Updated ${formatDistanceToNow(new Date(slugRow.date_modified))} ago`}
                onSetPrimary={
                  slugRow.primary
                    ? undefined
                    : () => {
                        onRequestSetPrimary(slugRow.id, slugRow.slug);
                      }
                }
                onRemove={() => {
                  onRequestRemove(slugRow.id, slugRow.slug);
                }}
                isSubmitting={isSubmitting}
              />
            ))}
            <SlugListRow
              slug={fallback}
              href={`${baseUrl}${fallback}`}
              badge="Default"
              updatedLabel="Work id fallback — not removable"
              muted
              isSubmitting={isSubmitting}
            />
          </div>
          <div className="flex items-start gap-2">
            <ui.TextField
              className="min-w-0 flex-1"
              value={draftSlug}
              onChange={(event) => {
                onDraftSlugChange(event.target.value);
              }}
              onKeyDown={handleDraftKeyDown}
              placeholder="Enter slug"
              disabled={isSubmitting}
              maxLength={64}
              error={addSlugError}
            />
            <ui.Button className="shrink-0" type="button" onClick={onAdd} disabled={isSubmitting}>
              <PlusIcon className="w-4 h-4" />
              Add a slug
            </ui.Button>
          </div>
        </div>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
