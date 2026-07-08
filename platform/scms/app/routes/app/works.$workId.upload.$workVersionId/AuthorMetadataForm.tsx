import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthorField, type Affiliation, type Author, ui } from '@curvenote/scms-core';
import { useFetcher } from 'react-router';
import type { Route } from './+types/route';
import type { AuthorFieldMetadata } from './mystAuthorAdapters';

const SAVE_DEBOUNCE_MS = 400;

export type AuthorMetadataFormProps = {
  value: AuthorFieldMetadata;
  onChange: (value: AuthorFieldMetadata) => void;
};

export function AuthorMetadataForm({ value, onChange }: AuthorMetadataFormProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
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

  return (
    <div className="space-y-2">
      <AuthorField
        schema={{ name: 'authors', title: 'Authors', required: false }}
        value={authors}
        onChange={updateAuthors}
        affiliationList={affiliations}
        onAffiliationListChange={updateAffiliations}
        autoSave={false}
        simple
      />
      {fetcher.state !== 'idle' ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Saving author metadata...
        </p>
      ) : null}
    </div>
  );
}
