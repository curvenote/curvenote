import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from 'react-router';
import { cn, ui } from '@curvenote/scms-core';
import type { Route } from './+types/route';
import { useInlineSave } from './useInlineSave';
import { InlineSaveIndicator } from './InlineSaveIndicator';

interface WorkTitleFormProps {
  title: string;
  disabled?: boolean;
  placeholder?: string;
}

export function WorkTitleForm({
  title: initialTitle,
  disabled: disabledProp,
  placeholder = 'Enter the article title',
}: WorkTitleFormProps) {
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
  const [title, setTitle] = useState(initialTitle || '');
  const disabled = disabledProp ?? fetcher.state !== 'idle';

  // Sync local state with title changes from loader
  useEffect(() => {
    setTitle(initialTitle || '');
  }, [initialTitle]);

  // Show toast when action returns an error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) {
      ui.toastError((fetcher.data as { error: { message: string } }).error.message);
    }
  }, [fetcher.state, fetcher.data]);

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
          <ui.Textarea
            id="article-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(saveState !== 'idle' ? 'pr-20' : '', 'resize-none')}
            rows={3}
          />
          <InlineSaveIndicator saveState={saveState} className="absolute bottom-1 right-[6px]" />
        </fetcher.Form>
      </div>
    </div>
  );
}
