import { useFetcher } from 'react-router';
import {
  SITE_DOI_CONFIG_MODE,
  SITE_DOI_CONFIG_STATUS,
  SystemAdminBadge,
  primitives,
} from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import { DoiConfirmAction } from './DoiConfirmAction.js';
import type { DoiActionData } from './doi.utils.js';

type DoiAdvancedActionsCardProps = {
  config: SiteDoiConfigDTO;
  siteTitle: string;
};

export function DoiAdvancedActionsCard({ config, siteTitle }: DoiAdvancedActionsCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  const canUnlink =
    config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX &&
    config.status === SITE_DOI_CONFIG_STATUS.ACTIVE;

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <div className="flex flex-wrap items-center gap-2">
        <h2>Advanced actions</h2>
        <SystemAdminBadge />
      </div>
      <div className="space-y-4 divide-y divide-stone-200 dark:divide-stone-700 [&>*+*]:pt-4">
        {canUnlink && (
          <DoiConfirmAction
            intent="unlink-role"
            occ={config.occ}
            title="Unlink the Crossref role"
            description="Returns the Site to “Waiting for Crossref role”. The prefix is kept and becomes editable again."
            confirmTitle="Unlink the Crossref role?"
            confirmDescription={`This will unlink the Crossref role "${config.role}" from ${siteTitle}. The prefix is kept and becomes editable again.`}
            buttonLabel="Unlink role"
            confirmVariant="default"
            fetcher={fetcher}
          />
        )}
        <DoiConfirmAction
          intent="reset"
          occ={config.occ}
          title="Reset DOI setup"
          description="Removes the prefix and role and returns the Site to the first-time setup. Only possible while the Site has no registered DOIs."
          confirmTitle="Reset DOI setup?"
          confirmDescription={`This will remove the prefix and role and return ${siteTitle} to the first-time setup state. Any unsaved changes will be lost.`}
          buttonLabel="Reset setup"
          confirmVariant="destructive"
          fetcher={fetcher}
        />
      </div>
    </primitives.Card>
  );
}
