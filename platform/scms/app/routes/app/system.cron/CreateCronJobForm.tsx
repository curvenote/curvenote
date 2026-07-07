import { useEffect, useRef, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';
import { CronEndpointScopes, ui } from '@curvenote/scms-core';
import { Plus } from 'lucide-react';

type CreateActionData = {
  success?: boolean;
  message?: string;
  error?: { message: string };
};

function slugifyDisplayName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateCronJobForm({ allowedHosts }: { allowedHosts: string[] }) {
  const fetcher = useFetcher<CreateActionData>();
  const revalidator = useRevalidator();
  const prevFetcherState = useRef(fetcher.state);
  const [formKey, setFormKey] = useState(0);

  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('');
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    if (!isNameManuallyEdited) {
      setName(slugifyDisplayName(displayName));
    }
  }, [displayName, isNameManuallyEdited]);

  useEffect(() => {
    const wasBusy = prevFetcherState.current !== 'idle';
    prevFetcherState.current = fetcher.state;

    if (!wasBusy || fetcher.state !== 'idle' || !fetcher.data) {
      return;
    }

    if (fetcher.data.error) {
      ui.toastError(fetcher.data.error.message);
      return;
    }

    if (fetcher.data.success) {
      ui.toastSuccess(fetcher.data.message ?? 'Cron job created successfully');
      setDisplayName('');
      setName('');
      setIsNameManuallyEdited(false);
      setFormKey((k) => k + 1);
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  const allowedHostsHint =
    allowedHosts.length > 0 ? allowedHosts.join(', ') : 'configured API hosts from app-config';

  return (
    <section className="p-4 bg-white rounded-lg border dark:bg-gray-900 dark:border-gray-700">
      <h3 className="mb-3 font-semibold">Create HTTP cron (HANDSHAKE)</h3>
      <fetcher.Form key={formKey} method="post" className="grid gap-4 max-w-xl">
        <input type="hidden" name="intent" value="create" />

        <div>
          <ui.Label htmlFor="cron-display-name">Display name *</ui.Label>
          <ui.Input
            id="cron-display-name"
            name="description"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My New Cron"
            required
            disabled={isSubmitting}
            className="mt-1"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Human-readable label shown in the list
          </p>
        </div>

        <div>
          <ui.Label htmlFor="cron-name">Identifier *</ui.Label>
          <ui.Input
            id="cron-name"
            name="name"
            value={name}
            onChange={(e) => {
              setIsNameManuallyEdited(true);
              setName(e.target.value);
            }}
            placeholder="my-new-cron"
            required
            disabled={isSubmitting}
            className="mt-1 font-mono"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Unique ID: lowercase letters, numbers, and hyphens only (no spaces)
          </p>
        </div>

        <div>
          <ui.Label htmlFor="cron-schedule">Schedule *</ui.Label>
          <ui.Input
            id="cron-schedule"
            name="schedule"
            placeholder="* * * * *"
            required
            disabled={isSubmitting}
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-sm text-muted-foreground">Standard cron expression (UTC)</p>
        </div>

        <div>
          <ui.Label htmlFor="cron-http-method">HTTP method</ui.Label>
          <ui.Input
            id="cron-http-method"
            name="http_method"
            defaultValue="POST"
            disabled={isSubmitting}
            className="mt-1 font-mono"
          />
        </div>

        <div>
          <ui.Label htmlFor="cron-target-url">Target URL *</ui.Label>
          <ui.Input
            id="cron-target-url"
            name="target_url"
            placeholder="http://localhost:3031/v1/..."
            required
            disabled={isSubmitting}
            className="mt-1 font-mono text-xs"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Must use an allowed API host:{' '}
            <code className="text-xs bg-muted px-1 rounded">{allowedHostsHint}</code>
          </p>
        </div>

        <div>
          <ui.Label htmlFor="cron-target-scope">Scope</ui.Label>
          <ui.Input
            id="cron-target-scope"
            name="target_scope"
            placeholder={CronEndpointScopes.JOB_QUEUE_DRAIN}
            disabled={isSubmitting}
            className="mt-1 font-mono text-xs"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Optional. Derived from the target URL when left blank.
          </p>
        </div>

        <ui.StatefulButton
          type="submit"
          className="w-fit"
          overlayBusy
          busy={isSubmitting}
          disabled={isSubmitting}
        >
          <Plus className="mr-2 w-4 h-4" />
          Create
        </ui.StatefulButton>
      </fetcher.Form>
    </section>
  );
}
