import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext, validateFormData, withValidFormData } from '@curvenote/scms-server';
import {
  SystemAdminBadge,
  PageFrame,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import type { Domain } from './db.server.js';
import { dbCreateDomain, dbDeleteDomain, dbGetDomains, dbSetDefaultDomain } from './db.server.js';
import { ListTable } from './ListTable.js';
import { DomainRow } from './DomainRow.js';
import { AddDomainForm } from './AddDomainForm.js';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import type { SiteDTO } from '@curvenote/common';

interface LoaderData {
  site: SiteDTO;
  domains: Domain[];
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
  return { site: ctx.siteDTO, domains: dbo };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    siteScopes.domains.create,
    siteScopes.domains.delete,
    siteScopes.domains.update,
  ]);

  const formData = await ctx.request.formData();
  const intent = formData.get('intent');

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
  return [{ title: joinPageTitle('Domains', loaderData?.site?.title, branding.title) }];
};

export default function Domains({ loaderData }: { loaderData: LoaderData }) {
  const { site, domains } = loaderData;

  // Sort domains by date_created, most recent first
  const sortedDomains = [...domains].sort((a, b) => {
    return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
  });

  return (
    <PageFrame title="Domains" subtitle={`Manage the domains that are accepted by ${site.title}`}>
      <div className="flex flex-col space-y-5">
        <SystemAdminBadge />
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
      </div>
    </PageFrame>
  );
}
