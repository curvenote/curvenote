import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { AuthorField, type Affiliation, type Author, ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { Route } from './+types/route';
import type { AuthorFieldMetadata } from './mystAuthorAdapters';
import { AuthorSummaryView } from './AuthorSummaryView';

const SAVE_DEBOUNCE_MS = 400;
const AUTHORS_FIELD_NAME = 'authors';
const AUTHORS_FIELD_TITLE = 'Authors';

export type AuthorMetadataFormProps = {
  value: AuthorFieldMetadata;
  onChange: (value: AuthorFieldMetadata) => void;
};

export function AuthorMetadataForm({ value, onChange }: AuthorMetadataFormProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
  const [isEditing, setIsEditing] = useState(false);
  const [authors, setAuthors] = useState<Author[]>(value.authors);
  const [affiliations, setAffiliations] = useState<Affiliation[]>(value.affiliations);
  const authorsRef = useRef<Author[]>(value.authors);
  const affiliationsRef = useRef<Affiliation[]>(value.affiliations);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authorsRef.current = value.authors;
    affiliationsRef.current = value.affiliations;
    setAuthors(value.authors);
    setAffiliations(value.affiliations);
  }, [value]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

  const submit = useCallback(
    (next: AuthorFieldMetadata) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const formData = new FormData();
        formData.set('intent', 'update-author-metadata');
        formData.set('authorMetadata', JSON.stringify(next));
        fetcher.submit(formData, { method: 'POST' });
      }, SAVE_DEBOUNCE_MS);
    },
    [fetcher],
  );

  const update = useCallback(
    (next: AuthorFieldMetadata) => {
      authorsRef.current = next.authors;
      affiliationsRef.current = next.affiliations;
      setAuthors(next.authors);
      setAffiliations(next.affiliations);
      onChange(next);
      submit(next);
    },
    [onChange, submit],
  );

  const updateAuthors = useCallback(
    (nextAuthors: Author[]) => {
      update({ authors: nextAuthors, affiliations: affiliationsRef.current });
    },
    [update],
  );

  const updateAffiliations = useCallback(
    (nextAffiliations: Affiliation[]) => {
      update({ authors: authorsRef.current, affiliations: nextAffiliations });
    },
    [update],
  );

  const savingIndicator =
    fetcher.state !== 'idle' ? (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Saving author metadata...
      </p>
    ) : null;

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 justify-between items-center">
          <ui.FormLabel htmlFor={AUTHORS_FIELD_NAME} defined={authors.length > 0}>
            {AUTHORS_FIELD_TITLE}
          </ui.FormLabel>
          <ui.Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-auto cursor-pointer shrink-0"
          >
            <Pencil className="mr-1 w-3.5 h-3.5 shrink-0" aria-hidden />
            Edit
          </ui.Button>
        </div>
        <AuthorSummaryView
          authors={authors}
          affiliationList={affiliations}
          onAddNow={() => setIsEditing(true)}
        />
        {savingIndicator}
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      <ui.Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setIsEditing(false)}
        className="absolute top-0 right-0 z-10 h-auto cursor-pointer shrink-0"
      >
        <Check className="mr-1 w-3.5 h-3.5 shrink-0" aria-hidden />
        done editing
      </ui.Button>
      <AuthorField
        schema={{ name: AUTHORS_FIELD_NAME, title: AUTHORS_FIELD_TITLE, required: false }}
        value={authors}
        onChange={updateAuthors}
        affiliationList={affiliations}
        onAffiliationListChange={updateAffiliations}
        autoSave={false}
      />
      {savingIndicator}
    </div>
  );
}
