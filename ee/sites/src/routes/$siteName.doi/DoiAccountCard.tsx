import { useState } from 'react';
import { useFetcher } from 'react-router';
import type { FetcherWithComponents } from 'react-router';
import { Lock } from 'lucide-react';
import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS, primitives, ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import { CONTACT_SALES_URL, CROSSREF_MEMBERSHIP_URL, CURVENOTE_OWNER_NAME } from './doi.utils.js';
import type { DoiActionData } from './doi.utils.js';

function LockedLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium">
      {children}
      <Lock className="w-3 h-3 text-muted-foreground" aria-label="Read-only" />
    </label>
  );
}

function EnterpriseUpsell({ siteTitle }: { siteTitle: string }) {
  return (
    <div className="p-4 space-y-2 border border-dashed rounded-sm border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Lock className="w-4 h-4 text-muted-foreground" />
        Use your organization&apos;s own DOI prefix
        <ui.Badge variant="primary">Enterprise</ui.Badge>
      </div>
      <p className="text-sm font-light">
        This Site registers DOIs under Curvenote&apos;s prefix. Enterprise lets you register under a
        prefix owned by {siteTitle}, with your own Crossref membership.
      </p>
      <ui.Button asChild variant="outline" size="sm">
        <a href={CONTACT_SALES_URL} target="_blank" rel="noopener noreferrer">
          Contact Sales
        </a>
      </ui.Button>
    </div>
  );
}

type PrefixFormProps = {
  config: SiteDoiConfigDTO;
  editable: boolean;
  owner: string | null;
  fetcher: FetcherWithComponents<DoiActionData>;
};

/** Owns the prefix draft. The card owns the fetcher, so its success message survives the remount. */
function PrefixForm({ config, editable, owner, fetcher }: PrefixFormProps) {
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
          disabled={!editable || busy}
        />
        <p className="text-xs text-muted-foreground">
          Owner at Crossref: <span className="font-medium">{owner ?? 'Unknown'}</span>.
          {editable && ' Editable until the role is linked.'}
          {isCustom && !isPending && ' Contact Curvenote to change the prefix.'}
        </p>
      </div>
      {editable && (
        <div className="flex justify-end space-x-3">
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

type DoiAccountCardProps = {
  config: SiteDoiConfigDTO;
  siteTitle: string;
  customPrefixEnabled: boolean;
};

export function DoiAccountCard({ config, siteTitle, customPrefixEnabled }: DoiAccountCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  const isCustom = config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX;
  const isPending = config.status === SITE_DOI_CONFIG_STATUS.PENDING_ROLE;
  const editable = isCustom && isPending && customPrefixEnabled;
  const owner = isCustom ? config.prefix_owner : CURVENOTE_OWNER_NAME;

  return (
    <primitives.Card lift className="px-6 py-4 space-y-4" validateUsing={fetcher}>
      <h2>Registration account</h2>
      <p className="text-sm font-light">
        {isCustom
          ? 'Your organization’s DOI prefix and the Crossref role Curvenote deposits with.'
          : `Works are registered under Curvenote's prefix as ${config.prefix}/…`}
      </p>

      {/* Keyed by occ: a saved config remounts the form, which reseeds the draft without an effect. */}
      <PrefixForm
        key={config.occ}
        config={config}
        editable={editable}
        owner={owner}
        fetcher={fetcher}
      />

      {isCustom && (
        <div className="space-y-2">
          <LockedLabel htmlFor="doi-role">Crossref role</LockedLabel>
          <ui.Input
            id="doi-role"
            className="max-w-sm font-mono"
            value={config.role ?? ''}
            placeholder="Not linked yet"
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Set by Curvenote from the role your organisation grants at Crossref. You never enter it
            here.
          </p>
        </div>
      )}

      {isCustom && isPending && (
        <ui.SimpleAlert
          type="info"
          size="compact"
          message={
            <>
              <span className="font-medium">Need to grant access?</span> In your Crossref account,
              add Curvenote as a depositor for prefix {config.prefix}. Crossref emails us and we
              complete the link.{' '}
              <a
                className="underline"
                href={CROSSREF_MEMBERSHIP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Crossref&apos;s member setup guide
              </a>
            </>
          }
        />
      )}

      {!isCustom && !customPrefixEnabled && <EnterpriseUpsell siteTitle={siteTitle} />}
    </primitives.Card>
  );
}
