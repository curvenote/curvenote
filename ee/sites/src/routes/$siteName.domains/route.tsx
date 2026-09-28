import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data, useFetcher } from 'react-router';
import { withAppSiteContext, validateFormData, withValidFormData } from '@curvenote/scms-server';
import {
  SystemAdminBadge,
  PageFrame,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  clientCheckSiteScopes,
  coerceToObject,
  primitives,
  SectionWithHeading,
  ui,
} from '@curvenote/scms-core';
import type { Domain } from './db.server.js';
import { dbCreateDomain, dbDeleteDomain, dbGetDomains, dbSetDefaultDomain } from './db.server.js';
import { ListTable } from './ListTable.js';
import { DomainRow } from './DomainRow.js';
import { AddDomainForm } from './AddDomainForm.js';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import type { SiteDTO } from '@curvenote/common';
import { useEffect, useState } from 'react';
import { GlobeIcon, Route as RouteIcon, TriangleAlert } from 'lucide-react';
import type { SiteThemeConfig, ThemeRedirectsConfig } from '../../themeConfig/types.js';
import { redirectsError, redirectsWarnings } from '../../themeConfig/validate.js';
import { RedirectsField, configFromState, stateFromConfig } from './RedirectsField.js';
import { RedirectTester } from './RedirectTester.js';
import { $actionUpdateRedirects } from './redirects.server.js';
import {
  ERROR_TOOLTIP_CLASS,
  UnsavedChangesGuard,
} from '../$siteName.website/UnsavedChangesGuard.js';

interface LoaderData {
  site: SiteDTO;
  domains: Domain[];
  scopes: string[];
  redirects: ThemeRedirectsConfig | undefined;
}

function isValidDomain(hostname: string): boolean {
  // Domain validation regex
  const domainRegex = /^([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(hostname);
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.domains.list], {
    redirectTo: '/app',
    redirect: true,
  });
  const dbo = await dbGetDomains(ctx.site.id);
  const themeConfig = coerceToObject(ctx.site.metadata)?.theme_config as
    SiteThemeConfig | undefined;
  return { site: ctx.siteDTO, domains: dbo, scopes: ctx.scopes, redirects: themeConfig?.redirects };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    siteScopes.domains.create,
    siteScopes.domains.delete,
    siteScopes.domains.update,
  ]);

  const formData = await ctx.request.formData();
  const intent = formData.get('intent');

  if (intent === 'redirects.update') {
    // Redirects are site design, not domain records: same scope as Website & Design
    const editCtx = await withAppSiteContext(args, [siteScopes.update]);
    const hostnames = (await dbGetDomains(editCtx.site.id)).map((domain) => domain.hostname);
    return $actionUpdateRedirects(editCtx, formData, hostnames);
  }

  // use a zod form data schema to validate the intent
  try {
    const IntentSchema = zfd.formData({ intent: z.enum(['create', 'delete', 'set-default']) });
    validateFormData(IntentSchema, formData);
  } catch (error: any) {
    return data({ error: error.message ?? 'Invalid form data' }, { status: 400 });
  }

  try {
    if (intent === 'create') {
      const IntentSchema = zfd.formData({
        hostname: z.string().min(6).max(255),
        site_name: z.string().min(1).max(255),
        is_default: z.string().optional(),
      });
      return withValidFormData(IntentSchema, formData, async (payload) => {
        if (!isValidDomain(payload.hostname)) {
          return data(
            {
              error: {
                message:
                  'Invalid domain format. Please enter a valid domain name (e.g., example.com)',
              },
            },
            { status: 400 },
          );
        }

        await dbCreateDomain(payload.site_name, payload.hostname, payload.is_default === 'true');
        return { success: 'Domain created successfully' };
      });
    } else {
      return withValidFormData(zfd.formData({ domainId: z.uuid() }), formData, async (payload) => {
        if (intent === 'delete') {
          await dbDeleteDomain(payload.domainId);
          return { success: 'Domain deleted successfully' };
        } else if (intent === 'set-default') {
          await dbSetDefaultDomain(payload.domainId);
          return { success: 'Default domain set successfully' };
        } else {
          return data({ error: `Invalid intent: ${intent}` }, { status: 400 });
        }
      });
    }
  } catch (error) {
    console.error('Domain action error:', error);
    return data(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Domains & Redirects', loaderData?.site?.title, branding.title) }];
};

/** Edits `theme_config.redirects`, validated live against the site's own hostnames. */
function RedirectsSection({
  site,
  hostnames,
  redirects,
  canEdit,
}: {
  site: SiteDTO;
  hostnames: string[];
  redirects: ThemeRedirectsConfig | undefined;
  canEdit: boolean;
}) {
  const fetcher = useFetcher();
  const [state, setState] = useState(() => stateFromConfig(redirects));
  const current = configFromState(state);
  const saved = JSON.stringify(redirects ?? null);
  const dirty = JSON.stringify(current ?? null) !== saved;
  const problem = redirectsError(current, hostnames);
  const warnings = redirectsWarnings(current);
  const saveError = problem ? `Fix these before saving. ${problem}` : undefined;
  const canSave = canEdit && !saveError;
  const hostname = hostnames[0] ?? site.url?.replace(/^https?:\/\//, '') ?? 'example.org';

  const reset = () => setState(stateFromConfig(redirects));
  const save = () => {
    const formData = new FormData();
    formData.append('intent', 'redirects.update');
    formData.append('redirects', JSON.stringify(current ?? null));
    fetcher.submit(formData, { method: 'POST' });
  };

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    const result = fetcher.data as { success?: boolean; error?: string };
    if (result.error) ui.toastError(result.error);
    else if (result.success) ui.toastSuccess('Redirects saved');
  }, [fetcher.state, fetcher.data]);

  // Re-seed from the loader after a save lands, so "dirty" is measured against what is stored
  useEffect(() => {
    setState(stateFromConfig(redirects));
  }, [redirects]);

  return (
    <SectionWithHeading
      heading={
        <span className="flex items-center gap-3">
          Redirects
          {!canEdit && (
            <ui.Badge variant="outline" className="text-xs font-normal">
              Read only
            </ui.Badge>
          )}
        </span>
      }
      icon={RouteIcon}
    >
      <primitives.Card lift className="px-6 py-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Send a page, or the whole site, somewhere else. Redirects happen before the page loads.
        </p>

        <RedirectsField value={state} onChange={setState} disabled={!canEdit} />

        {warnings.length > 0 && (
          <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        )}

        <RedirectTester config={current} hostname={hostname} />

        <div className="flex justify-end gap-2">
          <ui.Button variant="outline" onClick={reset} disabled={!dirty || !canEdit}>
            Reset
          </ui.Button>
          {saveError ? (
            <ui.SimpleTooltip title={saveError} className={ERROR_TOOLTIP_CLASS}>
              <span className="inline-flex">
                <ui.Button disabled>Save changes</ui.Button>
              </span>
            </ui.SimpleTooltip>
          ) : (
            <ui.Button onClick={save} disabled={!dirty || !canSave}>
              Save changes
            </ui.Button>
          )}
        </div>

        <UnsavedChangesGuard
          dirty={dirty}
          fetcher={fetcher}
          canSave={canSave}
          saveError={saveError}
          description="You have unsaved changes to this site's redirects. Would you like to save them before leaving this page?"
          onSave={save}
          onDiscard={reset}
        />
      </primitives.Card>
    </SectionWithHeading>
  );
}

export default function Domains({ loaderData }: { loaderData: LoaderData }) {
  const { site, domains, scopes, redirects } = loaderData;
  const canEditRedirects = clientCheckSiteScopes(scopes, [siteScopes.update], site.name);

  // Sort domains by date_created, most recent first
  const sortedDomains = [...domains].sort((a, b) => {
    return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
  });
  const hostnames = [...domains]
    .sort((a, b) => Number(b.default) - Number(a.default))
    .map((domain) => domain.hostname);

  return (
    <PageFrame
      title="Domains & Redirects"
      subtitle={`Manage the domains that are accepted by ${site.title}, and where its URLs go`}
    >
      <div className="flex flex-col space-y-10">
        <SectionWithHeading
          heading={
            <span className="flex items-center gap-3">
              Domains
              <SystemAdminBadge />
            </span>
          }
          icon={GlobeIcon}
          className="flex flex-col space-y-5"
        >
          <AddDomainForm siteName={site.name} />
          <ListTable>
            {sortedDomains.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="py-4 text-sm text-center text-stone-500 dark:text-stone-400"
                >
                  No domains configured
                </td>
              </tr>
            ) : (
              sortedDomains.map((domain) => (
                <DomainRow key={domain.id} domain={domain} canDelete={sortedDomains.length > 1} />
              ))
            )}
          </ListTable>
        </SectionWithHeading>

        <RedirectsSection
          site={site}
          hostnames={hostnames}
          redirects={redirects}
          canEdit={canEditRedirects}
        />
      </div>
    </PageFrame>
  );
}
