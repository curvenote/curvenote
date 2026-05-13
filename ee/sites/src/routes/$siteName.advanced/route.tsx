import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data, useFetcher } from 'react-router';
import {
  withAppSiteContext,
  userHasSiteScope,
  validateFormData,
  createUserToken,
} from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import {
  SystemAdminBadge,
  PageFrame,
  formatDate,
  primitives,
  ui,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  error404,
} from '@curvenote/scms-core';
import {
  actionSaveSiteRestriction,
  actionUpdateSiteByJson,
  actionUpdateSiteSettings,
} from './actionHelper.server.js';
import { SubmissionSettingsForm } from './SubmissionSettingsForm.js';
import { SiteMetadataForm } from './SiteMetadataForm.js';
import { SiteSettingsForm } from './SiteSettingsForm.js';
import type { SiteDTO } from '@curvenote/common';
import { getSiteWithAppData } from '../../backend/db.server.js';
import type { SiteWithAppData } from '../../backend/db.server.js';
import { formatDistanceToNow } from 'date-fns';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import {
  dbCreateSiteServiceAccount,
  dbCreateTokenForUser,
  dbDeleteTokenForUser,
  dbGetSiteServiceAccount,
  dbListTokensForUser,
} from './serviceAccount.server.js';

interface LoaderData {
  site: SiteDTO;
  siteWithAppData: SiteWithAppData;
  metadata: Prisma.JsonObject;
  serviceAccount: {
    user: { id: string; display_name: string | null } | null;
    tokens: Array<{
      id: string;
      description: string;
      date_created: string;
      date_expires: string | null;
      last_used: string | null;
      expired: boolean;
    }>;
  };
}

function dtoUserToken(dbo: {
  id: string;
  description: string;
  date_created: string;
  date_expires: string | null;
  date_last_used: string | null;
}) {
  const expired = dbo.date_expires ? new Date() > new Date(dbo.date_expires) : false;
  return {
    id: dbo.id,
    description: dbo.description,
    date_created: dbo.date_created,
    date_expires: dbo.date_expires,
    last_used: dbo.date_last_used,
    expired,
  };
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.update], {
    redirectTo: '/app',
    redirect: true,
  });

  // Get site with app-specific data (not exposed via public API)
  const siteWithAppData = await getSiteWithAppData(ctx.site.name);
  if (!siteWithAppData) throw error404('Site not found');

  const metadata = typeof ctx.site.metadata === 'object' ? ctx.site.metadata : {};

  // Filter out fields that are duplicated in the site table
  const {
    id, // eslint-disable-line @typescript-eslint/no-unused-vars
    name, // eslint-disable-line @typescript-eslint/no-unused-vars
    title, // eslint-disable-line @typescript-eslint/no-unused-vars
    description, // eslint-disable-line @typescript-eslint/no-unused-vars
    private: privateField, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...filteredMetadata
  } = metadata as Prisma.JsonObject;

  const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
  const tokensDBO = serviceUser ? await dbListTokensForUser(serviceUser.id) : [];

  return {
    site: ctx.siteDTO,
    siteWithAppData,
    metadata: filteredMetadata,
    serviceAccount: {
      user: serviceUser ? { id: serviceUser.id, display_name: serviceUser.display_name } : null,
      tokens: tokensDBO.map((t) => dtoUserToken(t)),
    },
  };
}

const FormActionSchema = zfd.formData({
  formAction: z.enum([
    'update-site',
    'restrict',
    'update-site-settings',
    'create-service-account',
    'create-service-token',
    'delete-service-token',
  ]),
});

const ServiceTokenCreateSchema = zfd.formData({
  formAction: z.literal('create-service-token'),
  description: zfd.text(z.string().trim()),
  expiry: zfd.text(
    z.union([
      z.literal('NEVER'),
      z.literal('FIVE_MINUTES'),
      z.literal('ONE_DAY'),
      z.literal('SEVEN_DAYS'),
      z.literal('THIRTY_DAYS'),
      z.literal('SIXTY_DAYS'),
      z.literal('NINETY_DAYS'),
      z.literal('ONE_YEAR'),
    ]),
  ),
});

function tokenExpiryToDays(expiry?: string) {
  switch (expiry) {
    case 'FIVE_MINUTES':
      return (5 * 60) / 24 / 3600;
    case 'ONE_DAY':
      return 1;
    case 'SEVEN_DAYS':
      return 7;
    case 'THIRTY_DAYS':
      return 30;
    case 'SIXTY_DAYS':
      return 60;
    case 'NINETY_DAYS':
      return 90;
    case 'ONE_YEAR':
      return 365;
    default:
      return undefined;
  }
}

function tokenExpiryToTimestamp(expiry?: string) {
  const days = tokenExpiryToDays(expiry);
  if (!days) return undefined;
  return Date.now() + days * 24 * 3600 * 1000;
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.update]);

  const formData = await ctx.request.formData();

  // Validate formAction
  let payload: { formAction: string };
  try {
    payload = validateFormData(FormActionSchema, formData);
  } catch (error: any) {
    return data({ error: error.message ?? 'Invalid form action' }, { status: 400 });
  }

  const { formAction } = payload;

  if (formAction === 'update-site') {
    return actionUpdateSiteByJson(ctx, formData);
  } else if (formAction === 'restrict') {
    return actionSaveSiteRestriction(ctx, formData);
  } else if (formAction === 'update-site-settings') {
    return actionUpdateSiteSettings(ctx, formData);
  } else if (formAction === 'create-service-account') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.create, ctx.site.id)) {
      return data({ error: 'Not authorized to create service accounts' }, { status: 403 });
    }
    const existing = await dbGetSiteServiceAccount(ctx.site.id);
    if (existing) return data({ error: 'Service account already exists' }, { status: 400 });
    const user = await dbCreateSiteServiceAccount({
      id: ctx.site.id,
      name: ctx.site.name,
      title: ctx.site.title,
    });
    return data({ ok: true, userId: user.id });
  } else if (formAction === 'create-service-token') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.tokens.create, ctx.site.id)) {
      return data({ error: 'Not authorized to create service account tokens' }, { status: 403 });
    }
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    if (!serviceUser) return data({ error: 'Service account not found' }, { status: 404 });
    let tokenPayload: z.infer<typeof ServiceTokenCreateSchema>;
    try {
      tokenPayload = validateFormData(ServiceTokenCreateSchema, formData);
    } catch (error: any) {
      return data({ error: error.message ?? 'Invalid token form data' }, { status: 422 });
    }
    const timestampExpires = tokenExpiryToTimestamp(tokenPayload.expiry);
    const dateExpires = timestampExpires ? new Date(timestampExpires).toISOString() : undefined;
    const token = await dbCreateTokenForUser(serviceUser.id, tokenPayload.description, dateExpires);
    const signedToken = createUserToken(
      serviceUser,
      token.id,
      ctx.$config.api.userTokenAudience,
      ctx.$config.api.userTokenIssuer,
      tokenPayload.description,
      ctx.$config.api.tokenConfigUrl,
      ctx.$config.api.jwtSigningSecret,
      timestampExpires ? timestampExpires / 1000 : undefined,
    );
    const dto = dtoUserToken(token);
    return data({ token: signedToken, ...dto });
  } else if (formAction === 'delete-service-token') {
    if (!userHasSiteScope(ctx.user, siteScopes.serviceAccount.tokens.delete, ctx.site.id)) {
      return data({ error: 'Not authorized to delete service account tokens' }, { status: 403 });
    }
    const serviceUser = await dbGetSiteServiceAccount(ctx.site.id);
    if (!serviceUser) return data({ error: 'Service account not found' }, { status: 404 });
    const tokenId = formData.get('tokenId');
    if (typeof tokenId !== 'string') return data({ error: 'Invalid token id' }, { status: 400 });
    return dbDeleteTokenForUser(serviceUser.id, tokenId);
  }

  return data({ error: 'Invalid form action' }, { status: 400 });
}

export const meta: MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Site Settings', branding.title) }];
};

export default function Settings({ loaderData }: { loaderData: LoaderData }) {
  const { site, siteWithAppData, metadata, serviceAccount } = loaderData;

  return (
    <PageFrame title="Site Settings" subtitle={`Manage the settings for ${site.title}`}>
      <div className="flex flex-col space-y-5">
        <SystemAdminBadge />
        <primitives.Card lift className="px-6 py-4 space-y-4 max-w-4xl">
          <h2>Site Information</h2>
          <p className="text-sm font-light">These fields cannot be changed.</p>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Site ID</label>
              <ui.Input className="max-w-sm font-mono" disabled value={site.id} />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Site Name</label>
              <ui.Input className="max-w-sm" disabled value={site.name} />
            </div>
          </div>
        </primitives.Card>
        <SiteSettingsForm site={site} siteWithAppData={siteWithAppData} />
        <SubmissionSettingsForm site={site} />
        <SiteMetadataForm site={site} metadata={metadata} />
        <primitives.Card lift className="px-6 py-4 space-y-4 max-w-4xl">
          <h2>Service Account</h2>
          <p className="text-sm font-light">
            Create a site-scoped service account and manage its API tokens. Tokens give full access
            to this service account and should be kept secret.
          </p>
          {!serviceAccount.user ? (
            <form method="POST" className="space-y-3">
              <input type="hidden" name="formAction" value="create-service-account" />
              <ui.Button type="submit">Create service account</ui.Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Service account user</div>
                <div className="font-mono text-sm">{serviceAccount.user.id}</div>
                {serviceAccount.user.display_name && (
                  <div className="text-sm">{serviceAccount.user.display_name}</div>
                )}
              </div>
              <ServiceAccountTokens tokens={serviceAccount.tokens} />
            </div>
          )}
        </primitives.Card>
      </div>
    </PageFrame>
  );
}

type TokenDTO = LoaderData['serviceAccount']['tokens'][number];

type TokenResponse = { error: string } | ({ token: string } & TokenDTO) | { count: number };

function isTokenSuccess(data: TokenResponse): data is { token: string } & TokenDTO {
  return typeof data === 'object' && data != null && 'token' in data;
}

function ServiceAccountTokens({ tokens }: { tokens: TokenDTO[] }) {
  const createFetcher = useFetcher<TokenResponse>();
  const deleteFetcher = useFetcher<TokenResponse>();
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (deleteFetcher.state === 'idle') setDeletingTokenId(null);
  }, [deleteFetcher.state]);

  const copyToClipboard = useCallback(() => {
    if (!createFetcher.data || !isTokenSuccess(createFetcher.data)) return;
    navigator.clipboard.writeText(createFetcher.data.token).catch((err) => console.error(err));
  }, [createFetcher.data]);

  const handleSelectText = useCallback(() => {
    if (!preRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(preRef.current);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  return (
    <div className="space-y-6">
      <primitives.Card className="px-4 py-4">
        <createFetcher.Form
          ref={formRef}
          method="POST"
          className="space-y-3"
          onSubmit={() => setDone(false)}
        >
          <h3 className="m-0">Create a new token</h3>
          <input type="hidden" name="formAction" value="create-service-token" />
          <div className="flex items-center space-x-4">
            <div className="grow max-w-[300px]">
              <primitives.TextField
                id="service.token.description"
                name="description"
                label=""
                placeholder="Token description"
                disabled={createFetcher.state === 'submitting'}
                required
              />
            </div>
            <div className="flex-none">
              <select
                className="bg-slate-50 dark:bg-slate-800"
                id="service.token.expiry"
                name="expiry"
                defaultValue="NEVER"
                disabled={createFetcher.state === 'submitting'}
              >
                <option value="NEVER">Never expires</option>
                <option value="NINETY_DAYS">90 days</option>
                <option value="SIXTY_DAYS">60 days</option>
                <option value="THIRTY_DAYS">30 days</option>
                <option value="SEVEN_DAYS">7 days</option>
                <option value="ONE_DAY">1 day</option>
                <option value="FIVE_MINUTES">5 minutes</option>
              </select>
            </div>
            <div className="flex-none">
              <ui.StatefulButton
                className="disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                type="submit"
                busy={createFetcher.state === 'submitting'}
                busyMessage="Creating..."
              >
                Create
              </ui.StatefulButton>
            </div>
          </div>
        </createFetcher.Form>

        {!done &&
          createFetcher.state === 'idle' &&
          createFetcher.data &&
          isTokenSuccess(createFetcher.data) && (
            <primitives.Card className="py-4 mt-4 space-y-4 text-green-900 bg-green-100 border border-green-600 dark:bg-green-950 dark:text-green-200">
              <h4 className="font-bold">Copy Token Now</h4>
              <p className="mb-2">
                Make sure to copy your <strong>"{createFetcher.data.description}"</strong> token
                now. You won't be able to see it again.
              </p>
              <pre
                className="p-4 font-mono break-words border border-green-900 dark:border-green-100 text-wrap"
                ref={preRef}
                onClick={handleSelectText}
              >
                {createFetcher.data.token}
              </pre>
              <div className="flex gap-2 justify-end">
                <ui.Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    formRef.current?.reset();
                    setDone(true);
                  }}
                >
                  Done
                </ui.Button>
                <ui.Button type="button" onClick={copyToClipboard}>
                  Copy
                </ui.Button>
              </div>
            </primitives.Card>
          )}
      </primitives.Card>

      {tokens.length > 0 && (
        <primitives.Card lift>
          <ul className="divide-y divide-stone-600 dark:divide-stone-300">
            {tokens.map((token) => (
              <li key={token.id} className="px-4 py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="m-0">{token.description}</h4>
                    <p
                      className="text-sm"
                      title={
                        token.date_expires
                          ? formatDate(token.date_expires, 'HH:mm:ss MMM dd, y')
                          : undefined
                      }
                    >
                      <span>
                        {token.expired && token.date_expires && (
                          <span className="font-medium text-red-400">
                            Expired: {formatDate(token.date_expires)}
                          </span>
                        )}
                        {!token.expired && token.date_expires && (
                          <span className="">Expires: {formatDate(token.date_expires)}</span>
                        )}
                        {!token.expired && !token.date_expires && <span>Never expires</span>}
                      </span>
                      <span className="inline-block mx-1 font-bold">·</span>
                      <span>
                        {token.last_used
                          ? `Last used: ${formatDistanceToNow(new Date(token.last_used))}`
                          : 'never used'}
                      </span>
                    </p>
                    <p className="text-sm">Created: {formatDate(token.date_created)}</p>
                  </div>
                  <div>
                    <deleteFetcher.Form
                      method="POST"
                      onSubmit={(e: FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        if (deleteFetcher.state === 'submitting') return;
                        const formData = {
                          formAction: 'delete-service-token',
                          tokenId: token.id,
                        };
                        if (
                          token.expired ||
                          confirm(`Are you sure you want to delete "${token.description}" token?`)
                        ) {
                          setDeletingTokenId(token.id);
                          deleteFetcher.submit(formData, { method: 'POST' });
                        }
                      }}
                    >
                      <ui.StatefulButton
                        type="submit"
                        variant="outline"
                        busy={deleteFetcher.state === 'submitting' && deletingTokenId === token.id}
                        disabled={deleteFetcher.state === 'submitting'}
                        busyMessage="Deleting..."
                      >
                        Delete
                      </ui.StatefulButton>
                    </deleteFetcher.Form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </primitives.Card>
      )}
    </div>
  );
}
