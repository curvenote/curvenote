import { useFetcher } from 'react-router';
import { SystemAdminBadge, primitives, ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import type { DoiActionData } from './doi.utils.js';

type DoiAdvancedActionsCardProps = {
  config: SiteDoiConfigDTO;
  siteTitle: string;
};

export function DoiAdvancedActionsCard({ config, siteTitle }: DoiAdvancedActionsCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  const busy = fetcher.state !== 'idle';

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>Advanced actions</h2>
        <SystemAdminBadge />
      </div>
      <fetcher.Form
        method="POST"
        className="flex flex-wrap items-center justify-between gap-4 m-0"
        onSubmit={(e) => {
          if (!confirm(`Reset the DOI setup of "${siteTitle}"? The prefix and role are removed.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="reset" />
        <input type="hidden" name="occ" value={config.occ} />
        <div>
          <div className="text-sm font-medium">Reset DOI setup</div>
          <p className="text-sm font-light">
            Removes the prefix and role and returns the Site to the first-time setup. Only possible
            while the Site has no registered DOIs.
          </p>
        </div>
        <ui.StatefulButton type="submit" variant="destructive" busy={busy} overlayBusy>
          Reset setup
        </ui.StatefulButton>
      </fetcher.Form>
    </primitives.Card>
  );
}
