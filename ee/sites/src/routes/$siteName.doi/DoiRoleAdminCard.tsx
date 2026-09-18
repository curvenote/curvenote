import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { SITE_DOI_CONFIG_STATUS, SystemAdminBadge, ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import type { DoiActionData } from './doi.utils.js';

type DoiRoleAdminCardProps = {
  config: SiteDoiConfigDTO;
};

/**
 * Only while the Site waits for its role. Once linked, the role is read-only on the account card
 * and Advanced actions is the only way to unlink it.
 */
export function DoiRoleAdminCard({ config }: DoiRoleAdminCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  const busy = fetcher.state !== 'idle';
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);

  if (config.status !== SITE_DOI_CONFIG_STATUS.PENDING_ROLE) {
    return null;
  }
  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2>Link the Crossref role</h2>
        <SystemAdminBadge />
      </div>
      <p className="text-sm font-light">
        Enter the role from the Crossref email for this organisation. First check that the prefix
        owner above, <span className="font-medium">{config.prefix_owner ?? 'Unknown'}</span>,
        matches the organisation named in the email. Linking is the authorisation: it says this
        prefix and role belong to this Site.
      </p>
      <fetcher.Form method="POST" className="m-0 space-y-4">
        <input type="hidden" name="intent" value="bind-role" />
        <input type="hidden" name="occ" value={config.occ} />
        <div className="space-y-2">
          <label htmlFor="doi-bind-role" className="block text-sm font-medium">
            Crossref role
          </label>
          <ui.Input
            id="doi-bind-role"
            name="role"
            className="max-w-sm font-mono"
            placeholder="e.g. elms"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            required
          />
          <p className="text-xs text-muted-foreground">
            Validated with one Crossref login as the Curvenote depositor with this role. Nothing is
            saved unless it passes.
          </p>
        </div>
        <div className="flex justify-end">
          <ui.StatefulButton type="submit" busy={busy} overlayBusy busyMessage="Validating…">
            Validate and link role
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </ui.Card>
  );
}
