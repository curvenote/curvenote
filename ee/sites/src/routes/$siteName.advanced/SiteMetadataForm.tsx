import { useFetcher } from 'react-router';
import { primitives, ui, useEditor } from '@curvenote/scms-core';
import { useState } from 'react';
import type { SiteDTO } from '@curvenote/common';
import type { Prisma } from '@curvenote/scms-db';
import { dump, load } from 'js-yaml';

// Helper function to determine the complexity of a value
function getValueComplexity(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'object') return 0; // primitives (string, number, boolean)
  if (Array.isArray(value)) return 2;
  if (typeof value === 'object') return 1;
  return 3; // fallback for other types
}

// Custom sorting function for YAML keys
function sortKeys(a: string, b: string, obj: any): number {
  const aValue = obj[a];
  const bValue = obj[b];
  const aComplexity = getValueComplexity(aValue);
  const bComplexity = getValueComplexity(bValue);

  // First sort by complexity
  if (aComplexity !== bComplexity) {
    return aComplexity - bComplexity;
  }

  // Then sort alphabetically
  return a.localeCompare(b);
}

export function SiteMetadataForm({
  site,
  metadata,
}: {
  site: SiteDTO;
  metadata: Prisma.JsonObject;
}) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();

  const [error, setError] = useState<string | undefined>();
  const { doc, ref, view } = useEditor(
    dump(metadata, {
      sortKeys: (a, b) => sortKeys(a, b, metadata),
    }),
    'yaml',
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!view) return;

    try {
      load(view.state.doc.toString());
      setError(undefined);
    } catch {
      setError('Invalid YAML');
      return;
    }

    if (confirm(`Are you sure you want to update the site metadata for "${site.name}"?`)) {
      const json = JSON.stringify(load(view.state.doc.toString()));
      fetcher.submit(
        {
          formAction: 'update-site',
          metadata: json,
        },
        { method: 'POST' },
      );
      return;
    }
  }

  const controls = (
    <div className="flex justify-end space-x-3">
      <ui.Button
        type="button"
        variant="secondary"
        disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
        onClick={() => {
          view?.dispatch({
            changes: {
              from: 0,
              to: view?.state.doc.length ?? 0,
              insert: doc,
            },
          });
        }}
      >
        Reset
      </ui.Button>
      <ui.Button
        type="submit"
        disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
        variant="default"
      >
        {fetcher.state === 'submitting' ? 'Saving...' : 'Save'}
      </ui.Button>
    </div>
  );

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <h2>Site Metadata Configuration</h2>
      <p className="text-sm font-light">
        Advanced configuration options for your site. This is a YAML editor that allows you to
        modify the site metadata directly. The site metadata is governed by the journal theme
        configuration object, see the{' '}
        <a
          className="underline"
          href="https://github.com/curvenote/curvenote/blob/main/packages/common/src/types/journal.ts#L71"
          target="_blank"
          rel="noopener noreferrer"
        >
          type definition
        </a>{' '}
        for available fields
      </p>
      <p></p>

      <fetcher.Form method="POST" onSubmit={handleSubmit} className="m-0 space-y-4">
        {controls}

        <div className="relative">
          <div
            ref={ref}
            className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error && (
            <div className="absolute right-0 bottom-0 left-0 p-2 text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}
        </div>

        {controls}
      </fetcher.Form>
    </primitives.Card>
  );
}
