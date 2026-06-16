'use client';

import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '../../components/ui/index.js';
import type { CheckMaintenanceRecord } from './check-maintenance.js';

type ActionData = {
  error?: { type: string; message: string };
  success?: boolean;
};

type Props = {
  intent: string;
  maintenance?: CheckMaintenanceRecord | null;
  serviceLabel: string;
};

export function CheckMaintenanceAdminPanel({ intent, maintenance, serviceLabel }: Props) {
  const fetcher = useFetcher<ActionData>();
  const [enabled, setEnabled] = useState(maintenance?.enabled === true);
  const [message, setMessage] = useState(maintenance?.message ?? '');
  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    setEnabled(maintenance?.enabled === true);
    setMessage(maintenance?.message ?? '');
  }, [maintenance?.enabled, maintenance?.message]);

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.error?.message) {
      ui.toastError(fetcher.data.error.message);
      return;
    }
    if (fetcher.data.success) {
      ui.toastSuccess(
        enabled
          ? `${serviceLabel} marked under maintenance`
          : `${serviceLabel} maintenance cleared`,
      );
    }
  }, [fetcher.state, fetcher.data, enabled, serviceLabel]);

  return (
    <div className="p-4 space-y-4 rounded-md border border-border">
      <div>
        <h3 className="text-sm font-medium">Maintenance mode</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          When enabled, users cannot run checks or trigger outbound calls to {serviceLabel}.
          In-flight jobs and webhooks continue processing.
        </p>
      </div>

      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="enabled" value={enabled ? 'true' : 'false'} />
        <input type="hidden" name="message" value={message} />

        <label className="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={isSubmitting}
          />
          Under maintenance
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${intent}-maintenance-message`}>
            Tooltip message (optional)
          </label>
          <ui.TextField
            id={`${intent}-maintenance-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="This service is temporarily unavailable for maintenance."
            disabled={isSubmitting}
            className="w-full"
          />
        </div>

        <ui.StatefulButton
          type="submit"
          size="sm"
          busy={isSubmitting}
          overlayBusy
          disabled={isSubmitting}
        >
          Save maintenance settings
        </ui.StatefulButton>
      </fetcher.Form>

      {maintenance?.updatedAt ? (
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(maintenance.updatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
