import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from 'react-router';
import { Check } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { Route } from './+types/route';
import { useInlineSave } from './useInlineSave';

interface WorkTitleFormProps {
  title: string;
}

export function WorkTitleForm({ title: initialTitle }: WorkTitleFormProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
  const [title, setTitle] = useState(initialTitle || '');

  // Sync local state with title changes from loader
  useEffect(() => {
    setTitle(initialTitle || '');
  }, [initialTitle]);

  // Trigger save function
  const triggerSave = useCallback(() => {
    const formData = new FormData();
    formData.append('intent', 'update-title');
    formData.append('title', title);

    fetcher.submit(formData, {
      method: 'post',
    });
  }, [title, fetcher]);

  // Use inline save hook for blur saving and UI state management
  const { handleBlur, saveState } = useInlineSave({
    value: title,
    initialValue: initialTitle || '',
    onSave: triggerSave,
    isSaving: fetcher.state !== 'idle',
    minSavingDisplayTime: 1000,
    successDisplayTime: 1000,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="article-title" className="inline-block text-sm font-medium">
          Article Title
        </label>
        <fetcher.Form className="relative">
          <ui.Input
            id="article-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            placeholder="Enter the article title"
            disabled={fetcher.state !== 'idle'}
            className={saveState !== 'idle' ? 'pr-20' : ''}
          />
          {saveState === 'saving' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <p className="text-xs text-muted-foreground">Saving...</p>
            </div>
          )}
          {saveState === 'saved' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Check className="w-4 h-4 text-green-600" />
            </div>
          )}
        </fetcher.Form>
      </div>
    </div>
  );
}
