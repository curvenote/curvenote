import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { Lock } from 'lucide-react';
import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS, ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import { DoiConfirmAction } from './DoiConfirmAction.js';
import { DoiPrefixForm } from './DoiPrefixForm.js';
import { LockedLabel } from './LockedLabel.js';
import { CONTACT_SALES_URL, CROSSREF_MEMBERSHIP_URL, CURVENOTE_OWNER_NAME } from './doi.utils.js';
import type { DoiActionData } from './doi.utils.js';

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

type DoiAccountCardProps = {
  config: SiteDoiConfigDTO;
  siteTitle: string;
  customPrefixEnabled: boolean;
  /** The depositor a customer grants access to at Crossref, from api.crossref config. */
  depositorEmail: string;
  isSystemAdmin: boolean;
  roleBoundBy?: { name: string; date: string };
};

export function DoiAccountCard({
  config,
  siteTitle,
  customPrefixEnabled,
  depositorEmail,
  isSystemAdmin,
  roleBoundBy,
}: DoiAccountCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);
  const isCustom = config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX;
  const isPending = config.status === SITE_DOI_CONFIG_STATUS.PENDING_ROLE;
  const editable = isCustom && isPending && customPrefixEnabled;
  const owner = isCustom ? config.prefix_owner : CURVENOTE_OWNER_NAME;
  // A system admin waiting for the role gets the field on their own card, so repeating it here
  // read-only would show two fields for the same thing.
  const showRole = isCustom && !(isSystemAdmin && isPending);
  // Undoing your own setup is yours until Curvenote links a role. A system admin has the same
  // action in Advanced actions, so only one of the two ever shows.
  const canStartOver = !isSystemAdmin && !(isCustom && config.role);

  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <h2>Registration account</h2>
      <p className="text-sm font-light">
        {isCustom
          ? 'Your organization’s DOI prefix and the Crossref role Curvenote deposits with.'
          : `Works are registered under Curvenote's prefix as ${config.prefix}/…`}
      </p>

      {/* Keyed by occ: a saved config remounts the form, which reseeds the draft without an effect. */}
      <DoiPrefixForm
        key={config.occ}
        config={config}
        editable={editable}
        owner={owner}
        fetcher={fetcher}
      >
        {showRole && (
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
              {roleBoundBy && isSystemAdmin
                ? `Linked by ${roleBoundBy.name} on ${new Date(roleBoundBy.date).toLocaleDateString()}. Unlink it from Advanced actions.`
                : 'Set by Curvenote from the role your organization grants at Crossref. You never enter it here.'}
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
                add {depositorEmail} as a depositor for prefix {config.prefix}. Crossref emails us
                and we complete the link.{' '}
                {/* The alert is `prose`, which colors links for light mode only. */}
                <a
                  className="underline text-inherit"
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
      </DoiPrefixForm>

      {!isCustom && !customPrefixEnabled && <EnterpriseUpsell siteTitle={siteTitle} />}

      {canStartOver && (
        <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
          <DoiConfirmAction
            intent="reset"
            occ={config.occ}
            title="Start over"
            description={
              isCustom
                ? 'Removes the prefix and returns this Site to the first-time setup, so you can enter a different prefix or use Curvenote-managed registration.'
                : 'Returns this Site to the first-time setup, so you can choose a different registration method.'
            }
            confirmTitle="Start over?"
            confirmDescription={`This will remove the DOI setup of ${siteTitle} and return it to the first-time setup. No DOIs have been registered, so nothing is lost.`}
            buttonLabel="Start over"
            confirmVariant="destructive"
            fetcher={fetcher}
          />
        </div>
      )}
    </ui.Card>
  );
}
