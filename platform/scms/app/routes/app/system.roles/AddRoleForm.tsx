import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { Plus, PlusCircle } from 'lucide-react';
import { primitives, ui, useExpandableForm, cn } from '@curvenote/scms-core';
import type { GeneralError } from '@curvenote/scms-core';

export function AddRoleForm() {
  const fetcher = useFetcher<{
    success?: boolean;
    error?: GeneralError | string;
    role?: any;
  }>();

  const { isExpanded, isExiting, expand, handleCancel, formRef, onSubmit } = useExpandableForm(
    fetcher,
    {
      animationDuration: 200,
    },
  );

  const isSubmitting = fetcher.state === 'submitting';

  // Handle form submission success/error
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        let errorMessage: string;
        if (typeof fetcher.data.error === 'string') {
          errorMessage = fetcher.data.error;
        } else if (
          fetcher.data.error &&
          typeof fetcher.data.error === 'object' &&
          'message' in fetcher.data.error
        ) {
          errorMessage = fetcher.data.error.message;
        } else {
          errorMessage = 'An unknown error occurred';
        }
        ui.toastError(errorMessage);
      } else if (fetcher.data.success) {
        ui.toastSuccess('Role created successfully');
        // Reset form
        if (formRef.current) {
          formRef.current.reset();
        }
      }
    }
  }, [fetcher.state, fetcher.data, formRef]);

  return (
    <div className="space-y-4">
      {!isExpanded && (
        <div>
          <ui.Button onClick={expand} variant="default" disabled={isSubmitting}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add New Role
          </ui.Button>
        </div>
      )}

      {isExpanded && (
        <primitives.Card className="p-6 bg-white dark:bg-white">
          <fetcher.Form
            ref={formRef}
            onSubmit={onSubmit}
            method="post"
            className={cn('space-y-4', isExiting && 'animate-out fade-out duration-200')}
          >
            <input type="hidden" name="intent" value="create" />

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Role</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <ui.Label htmlFor="name">Name *</ui.Label>
                <ui.Input
                  id="name"
                  name="name"
                  placeholder="special-user"
                  required
                  autoFocus
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Unique identifier (lowercase, hyphens allowed)
                </p>
              </div>

              <div>
                <ui.Label htmlFor="title">Title *</ui.Label>
                <ui.Input
                  id="title"
                  name="title"
                  placeholder="Special User"
                  required
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">Human-readable display name</p>
              </div>
            </div>

            <div>
              <ui.Label htmlFor="description">Description *</ui.Label>
              <ui.Textarea
                id="description"
                name="description"
                placeholder="Can view and manage compliance reports and user access"
                required
                disabled={isSubmitting}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <ui.Label htmlFor="scopes">Scopes *</ui.Label>
              <ui.Textarea
                id="scopes"
                name="scopes"
                placeholder="app:compliance:read, app:platform:admin"
                required
                disabled={isSubmitting}
                className="mt-1"
                rows={3}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Comma-separated list of scopes (e.g., app:compliance:read, platform:admin)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <ui.Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </ui.Button>
              <ui.StatefulButton
                type="submit"
                overlayBusy
                busy={isSubmitting}
                disabled={isSubmitting}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </ui.StatefulButton>
            </div>
          </fetcher.Form>
        </primitives.Card>
      )}
    </div>
  );
}
