import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from 'react-router';
import { Check } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import type { Route } from './+types/route';
import { useInlineSave } from './useInlineSave';

interface AuthorsFormProps {
  /** Initial authors string (comma-separated); prefer wv.authors over extracted */
  initialAuthors: string;
  disabled?: boolean;
  placeholder?: string;
}

export function AuthorsForm({
  initialAuthors,
  disabled: disabledProp,
  placeholder = 'Enter author names, comma-separated',
}: AuthorsFormProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
  const [authors, setAuthors] = useState(initialAuthors || '');
  const disabled = disabledProp ?? fetcher.state !== 'idle';

  useEffect(() => {
    setAuthors(initialAuthors || '');
  }, [initialAuthors]);

  // Show toast when action returns an error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

  const triggerSave = useCallback(() => {
    const formData = new FormData();
    formData.append('intent', 'update-authors');
    formData.append('authors', authors);
    fetcher.submit(formData, { method: 'post' });
  }, [authors, fetcher]);

  const { handleBlur, saveState } = useInlineSave({
    value: authors,
    initialValue: initialAuthors || '',
    onSave: triggerSave,
    isSaving: fetcher.state !== 'idle',
    minSavingDisplayTime: 1000,
    successDisplayTime: 1000,
  });

  return (
    <div className="space-y-1">
      <label htmlFor="authors" className="inline-block text-sm font-medium">
        Authors
      </label>
      <fetcher.Form className="relative">
        <ui.Textarea
          id="authors"
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(saveState !== 'idle' ? 'pr-20' : '', 'resize-none')}
          rows={3}
        />
        {saveState === 'saving' && (
          <div className="absolute bottom-3 right-3 pointer-events-none">
            <p className="text-xs text-muted-foreground">Saving...</p>
          </div>
        )}
        {saveState === 'saved' && (
          <div className="absolute bottom-3 right-3 pointer-events-none">
            <Check className="w-4 h-4 text-green-600" />
          </div>
        )}
      </fetcher.Form>
    </div>
  );
}
