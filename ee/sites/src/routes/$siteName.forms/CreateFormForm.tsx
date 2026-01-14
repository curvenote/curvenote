import { useFetcher } from 'react-router';
import { primitives, ui, useExpandableForm } from '@curvenote/scms-core';
import { PlusCircle } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export function CreateFormForm() {
  const fetcher = useFetcher();
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { isExpanded, isExiting, expand, handleCancel, formRef, onSubmit } = useExpandableForm(
    fetcher,
    { animationDuration: 200 },
  );

  // Focus the title input when the form expands
  useEffect(() => {
    if (isExpanded && titleInputRef.current) {
      // Small delay to ensure the form is fully rendered
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isNameManuallyEdited && nameInputRef.current) {
      const transformedName = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '-'); // Replace spaces with hyphens
      nameInputRef.current.value = transformedName;
    }
  };

  const handleNameChange = () => {
    setIsNameManuallyEdited(true);
  };

  // Get optimistic values from formData when submitting
  const optimisticTitle =
    fetcher.state === 'submitting' ? fetcher.formData?.get('title') : undefined;
  const optimisticName = fetcher.state === 'submitting' ? fetcher.formData?.get('name') : undefined;
  const optimisticDescription =
    fetcher.state === 'submitting' ? fetcher.formData?.get('description') : undefined;

  // Type guard for error
  const error =
    fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data
      ? (fetcher.data as { error?: string | { message?: string } }).error
      : undefined;

  if (!isExpanded) {
    return (
      <div className="mb-6">
        <ui.Button variant="default" onClick={expand} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Add Form
        </ui.Button>
      </div>
    );
  }

  return (
    <primitives.Card
      className={`mb-6 p-6 duration-200 ${
        !isExiting ? 'animate-in slide-in-from-top-2' : 'animate-out slide-out-to-top-2'
      }`}
      lift
    >
      {error && (
        <div className="mb-2 text-red-500">
          {typeof error === 'string'
            ? error
            : typeof error === 'object' && 'message' in error
              ? error.message
              : Array.isArray(error)
                ? (error as any[]).map((e: any, i: number) => (
                    <div key={i}>{e.message || JSON.stringify(e)}</div>
                  ))
                : String(error) || 'An error occurred.'}
        </div>
      )}
      <fetcher.Form ref={formRef} className="flex flex-col gap-4" method="post" onSubmit={onSubmit}>
        <input type="hidden" name="intent" value="create-form" />
        <ui.TextField
          id="form-title"
          name="title"
          label="Form title"
          placeholder="Form title"
          required
          ref={titleInputRef}
          onChange={handleTitleChange}
          title="Enter a descriptive title for this form"
          defaultValue={optimisticTitle as string}
          disabled={fetcher.state === 'submitting'}
        />
        <ui.TextField
          id="form-name"
          name="name"
          label="Form name"
          placeholder="Form name"
          required
          ref={nameInputRef}
          onChange={handleNameChange}
          pattern="[a-z0-9\-_]+"
          title="Only lowercase letters, numbers, hyphens, and underscores are allowed"
          defaultValue={optimisticName as string}
          disabled={fetcher.state === 'submitting'}
        />
        <ui.TextField
          id="form-description"
          name="description"
          label="Form description"
          placeholder="Form description"
          title="Provide a detailed description of this form"
          defaultValue={optimisticDescription as string}
          disabled={fetcher.state === 'submitting'}
        />
        <div className="flex items-center justify-between gap-2 text-sm text-stone-500">
          <span>Forms simplify submission creation for users.</span>
          <div>
            <ui.Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="ml-2"
              disabled={fetcher.state === 'submitting'}
            >
              Cancel
            </ui.Button>
            <ui.StatefulButton
              type="submit"
              className="px-6 ml-2"
              busy={fetcher.state === 'submitting'}
            >
              Create Form
            </ui.StatefulButton>
          </div>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
