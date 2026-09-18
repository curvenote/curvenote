import { useState } from 'react';
import type { FetcherWithComponents } from 'react-router';
import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS, ui } from '@curvenote/scms-core';
import { normalizePrefix } from '../../backend/crossref/prefix.js';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import type { DoiActionData } from './doi.utils.js';
import { LockedLabel } from './LockedLabel.js';

export type DoiPrefixFormProps = {
  config: SiteDoiConfigDTO;
  editable: boolean;
  owner: string | null;
  fetcher: FetcherWithComponents<DoiActionData>;
  /** The read-only rows and notices of the card: they sit above the actions, never below them. */
  children?: React.ReactNode;
};

/** Owns the prefix draft. The card owns the fetcher, so its success message survives the remount. */
export function DoiPrefixForm({ config, editable, owner, fetcher, children }: DoiPrefixFormProps) {
  const [prefix, setPrefix] = useState(config.prefix);
  const isCustom = config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX;
  const isPending = config.status === SITE_DOI_CONFIG_STATUS.PENDING_ROLE;
  const dirty = prefix.trim() !== config.prefix;
  const busy = fetcher.state !== 'idle';

  return (
    <fetcher.Form method="POST" className="m-0 space-y-4">
      <input type="hidden" name="intent" value="update-prefix" />
      <input type="hidden" name="occ" value={config.occ} />
      <div className="space-y-2">
        {editable ? (
          <label htmlFor="doi-prefix" className="block text-sm font-medium">
            DOI prefix
          </label>
        ) : (
          <LockedLabel htmlFor="doi-prefix">DOI prefix</LockedLabel>
        )}
        <ui.Input
          id="doi-prefix"
          name="prefix"
          className="max-w-sm font-mono"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          onBlur={() => setPrefix(normalizePrefix(prefix) ?? prefix)}
          disabled={!editable || busy}
        />
        <p className="text-xs text-muted-foreground">
          Owner at Crossref: <span className="font-medium">{owner ?? 'Unknown'}</span>.
          {editable && ' Editable until the role is linked.'}
          {isCustom && !isPending && ' Contact Curvenote to change the prefix.'}
        </p>
      </div>
      {children}
      {editable && (
        <div className="flex justify-end pt-4 space-x-3 border-t border-stone-200 dark:border-stone-700">
          <ui.Button
            type="button"
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() => setPrefix(config.prefix)}
          >
            Discard
          </ui.Button>
          <ui.StatefulButton type="submit" disabled={!dirty} busy={busy} overlayBusy>
            Save prefix
          </ui.StatefulButton>
        </div>
      )}
    </fetcher.Form>
  );
}
