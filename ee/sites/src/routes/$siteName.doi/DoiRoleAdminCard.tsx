import { useFetcher } from 'react-router';
import { SITE_DOI_CONFIG_STATUS, SystemAdminBadge, primitives, ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import type { DoiActionData } from './doi.utils.js';

type DoiRoleAdminCardProps = {
  config: SiteDoiConfigDTO;
  roleBoundBy?: { name: string; date: string };
};

export function DoiRoleAdminCard({ config, roleBoundBy }: DoiRoleAdminCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  const busy = fetcher.state !== 'idle';

  if (config.status === SITE_DOI_CONFIG_STATUS.PENDING_ROLE) {
    return (
      <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              disabled={busy}
              required
            />
            <p className="text-xs text-muted-foreground">
              Validated with one Crossref login as the Curvenote depositor with this role. Nothing
              is saved unless it passes.
            </p>
          </div>
          <div className="flex justify-end">
            <ui.StatefulButton type="submit" busy={busy} overlayBusy busyMessage="Validating…">
              Validate and link role
            </ui.StatefulButton>
          </div>
        </fetcher.Form>
      </primitives.Card>
    );
  }

  if (config.status !== SITE_DOI_CONFIG_STATUS.ACTIVE) {
    // NEEDS_ATTENTION: the way out in this iteration is Reset, below.
    return null;
  }

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>Crossref role</h2>
        <SystemAdminBadge />
      </div>
      <p className="text-sm font-light">
        {roleBoundBy
          ? `Linked by ${roleBoundBy.name} on ${new Date(roleBoundBy.date).toLocaleDateString()}.`
          : 'Linked.'}{' '}
        Unlinking returns the Site to “Waiting for Crossref role”.
      </p>
      <fetcher.Form
        method="POST"
        className="flex justify-end m-0"
        onSubmit={(e) => {
          if (!confirm(`Unlink the Crossref role "${config.role}" from this Site?`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="unlink-role" />
        <input type="hidden" name="occ" value={config.occ} />
        <ui.StatefulButton type="submit" variant="outline" busy={busy} overlayBusy>
          Unlink role
        </ui.StatefulButton>
      </fetcher.Form>
    </primitives.Card>
  );
}
