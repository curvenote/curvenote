import { Link, useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { MoreVertical, FileText } from 'lucide-react';

export function FormCard({ form, siteName }: { form: any; siteName: string }) {
  const title = form.content?.title ?? form.name;
  const description = form.content?.description ?? 'No description';
  const fetcher = useFetcher();
  return (
    <Link to={`${form.name}`} tabIndex={0} aria-label={title} className="block focus:outline-none">
      <primitives.Card
        lift
        className="relative group cursor-pointer border rounded-md transition-colors"
        validateUsing={fetcher}
      >
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-semibold mb-3">{title}</div>
              <div className="text-sm mb-4">{description}</div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <ui.Menu>
                <ui.MenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-stone-100" aria-label="Open menu">
                    <MoreVertical className="w-5 h-5 text-stone-500" />
                  </button>
                </ui.MenuTrigger>
                <ui.MenuContent align="end">
                  <fetcher.Form method="post">
                    <input type="hidden" name="formId" value={form.id} />
                    <input type="hidden" name="intent" value="delete-form" />
                    <ui.MenuItem
                      onClick={(e) => {
                        if (window.confirm('Are you sure you want to delete this form?')) {
                          const formData = new FormData();
                          formData.append('intent', 'delete-form');
                          formData.append('formId', form.id);
                          fetcher.submit(formData, { method: 'post' });
                        } else {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete Form…
                    </ui.MenuItem>
                  </fetcher.Form>
                </ui.MenuContent>
              </ui.Menu>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>Kind: {form.kind?.content?.title ?? form.kind?.name ?? 'Unknown'}</span>
          </div>
          {form.collections && form.collections.length > 0 && (
            <div className="text-sm text-gray-600">
              <span>
                Collections: {form.collections.map((cif: any) => cif.collection.name).join(', ')}
              </span>
            </div>
          )}
          <div className="flex justify-end items-center mt-4">
            <span className="px-3 py-1 rounded-full border border-stone-400 dark:border-stone-200 text-xs font-mono">
              {form.name}
            </span>
          </div>
        </div>
      </primitives.Card>
    </Link>
  );
}

