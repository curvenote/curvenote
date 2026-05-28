import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';
import { formatDate, primitives, ui } from '@curvenote/scms-core';
import { formatDistanceToNow } from 'date-fns';

export type ServiceAccountRole = 'ADMIN' | 'SUBMITTER';

const ROLE_LABELS: Record<ServiceAccountRole, string> = {
  ADMIN: 'Admin',
  SUBMITTER: 'Submitter',
};

const ROLE_DESCRIPTIONS: Record<ServiceAccountRole, string> = {
  ADMIN: 'Full site access: manage settings, submissions, and publishing on behalf of the site.',
  SUBMITTER: 'Submit only: can create and update submissions but cannot manage other site data.',
};

export interface ServiceAccountTokenDTO {
  id: string;
  description: string;
  date_created: string;
  date_expires: string | null;
  last_used: string | null;
  expired: boolean;
}

export interface ServiceAccountData {
  user: { id: string; display_name: string | null; role: ServiceAccountRole | null } | null;
  tokens: ServiceAccountTokenDTO[];
}

export interface ServiceAccountPermissions {
  canRead: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canCreateTokens: boolean;
  canDeleteTokens: boolean;
}

type TokenResponse =
  | { error: string }
  | ({ token: string } & ServiceAccountTokenDTO)
  | { count: number };

function isTokenSuccess(resp: TokenResponse): resp is { token: string } & ServiceAccountTokenDTO {
  return typeof resp === 'object' && resp != null && 'token' in resp;
}

function ServiceAccountNameField({
  name,
  className = 'max-w-md',
}: {
  name: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor="service.account.name"
        className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Account name
      </label>
      <ui.Input id="service.account.name" className="w-full" disabled value={name} />
    </div>
  );
}

export function ServiceAccountForm({
  serviceAccount,
  permissions,
  defaultServiceAccountName,
  tokenDone,
  setTokenDone,
}: {
  serviceAccount: ServiceAccountData | null;
  permissions: ServiceAccountPermissions;
  defaultServiceAccountName: string;
  tokenDone: boolean;
  setTokenDone: (done: boolean) => void;
}) {
  // `canRead` should already be true if we got data, but defend against the
  // edge case where a parent rendered us anyway.
  if (!permissions.canRead || !serviceAccount) {
    return (
      <p className="text-sm font-light">
        You do not have permission to view this site's service account.
      </p>
    );
  }

  const hasServiceAccount = serviceAccount.user != null;

  return (
    <div className="space-y-6 max-w-4xl">
      {hasServiceAccount ? (
        <>
          <h2 className="m-0 font-medium text-md">Service Account Active</h2>
          <p className="text-sm font-light">
            Manage this site’s service account and its API tokens. Tokens give full access to the
            service account and should be kept secret.
          </p>
          <div className="space-y-4">
            <ServiceAccountDetails
              user={serviceAccount.user!}
              displayName={serviceAccount.user!.display_name ?? defaultServiceAccountName}
              canDelete={permissions.canDelete}
            />
            <ServiceAccountTokens
              tokens={serviceAccount.tokens}
              canCreate={permissions.canCreateTokens}
              canDelete={permissions.canDeleteTokens}
              tokenDone={tokenDone}
              setTokenDone={setTokenDone}
            />
          </div>
        </>
      ) : (
        <>
          <h3 className="m-0 font-medium text-md">Create a New Service Account</h3>
          <p className="text-sm font-light">
            Create a site-scoped service account and manage its API tokens. Tokens give full access
            to this service account and should be kept secret.
          </p>
          <CreateServiceAccountForm
            canCreate={permissions.canCreate}
            defaultName={defaultServiceAccountName}
          />
        </>
      )}
    </div>
  );
}

type CreateServiceAccountResponse = { ok?: boolean; userId?: string; error?: string };

function CreateServiceAccountForm({
  canCreate,
  defaultName,
}: {
  canCreate: boolean;
  defaultName: string;
}) {
  const [selectedRole, setSelectedRole] = useState<ServiceAccountRole>('SUBMITTER');
  const fetcher = useFetcher<CreateServiceAccountResponse>();

  if (!canCreate) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to create a service account.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <fetcher.Form method="POST" className="flex flex-col gap-4">
        <input type="hidden" name="formAction" value="create-service-account" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-none md:min-w-[220px]">
            <label
              htmlFor="service.account.role"
              className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Role
            </label>
            <select
              className="px-3 py-2 w-full text-sm bg-white rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              id="service.account.role"
              name="role"
              required
              disabled={fetcher.state === 'submitting'}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ServiceAccountRole)}
            >
              <option value="SUBMITTER">Submitter</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <ServiceAccountNameField name={defaultName} className="flex-1 min-w-0" />
          <div className="flex-none pb-[1px]">
            <ui.StatefulButton
              type="submit"
              busy={fetcher.state === 'submitting'}
              busyMessage="Creating..."
            >
              Create
            </ui.StatefulButton>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[selectedRole]}</p>
      </fetcher.Form>
      {fetcher.state === 'idle' && fetcher.data?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{fetcher.data.error}</p>
      )}
    </div>
  );
}

function ServiceAccountDetails({
  user,
  displayName,
  canDelete,
}: {
  user: NonNullable<ServiceAccountData['user']>;
  displayName: string;
  canDelete: boolean;
}) {
  const deleteFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const deleting = deleteFetcher.state === 'submitting';

  return (
    <div className="flex gap-4 justify-between items-start">
      <div className="space-y-3">
        <ServiceAccountNameField name={displayName} />
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Service account user</div>
          <div className="font-mono text-sm">{user.id}</div>
        </div>
        {user.role && (
          <div className="text-sm">
            <span className="text-muted-foreground">Site role: </span>
            <span className="font-medium">{ROLE_LABELS[user.role] ?? user.role}</span>
          </div>
        )}
      </div>
      {canDelete && (
        <deleteFetcher.Form
          method="POST"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            if (deleting) {
              e.preventDefault();
              return;
            }
            const confirmed = confirm(
              'Delete this service account? Existing tokens will be revoked and the account will lose access to this site. This cannot be undone.',
            );
            if (!confirmed) e.preventDefault();
          }}
        >
          <input type="hidden" name="formAction" value="delete-service-account" />
          <ui.StatefulButton
            type="submit"
            variant="outline"
            busy={deleting}
            disabled={deleting}
            busyMessage="Deleting..."
          >
            Delete service account
          </ui.StatefulButton>
        </deleteFetcher.Form>
      )}
    </div>
  );
}

function ServiceAccountTokens({
  tokens,
  canCreate,
  canDelete,
  tokenDone,
  setTokenDone,
}: {
  tokens: ServiceAccountTokenDTO[];
  canCreate: boolean;
  canDelete: boolean;
  tokenDone: boolean;
  setTokenDone: (done: boolean) => void;
}) {
  const createFetcher = useFetcher<TokenResponse>();
  const deleteFetcher = useFetcher<TokenResponse>();
  const revalidator = useRevalidator();
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null);
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
      {canCreate && (
        <div className="space-y-3">
          <createFetcher.Form
            ref={formRef}
            method="POST"
            className="space-y-3"
            onSubmit={() => setTokenDone(false)}
          >
            <h3 className="m-0 font-medium text-md">Create a new token</h3>
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
                  <option value="ONE_YEAR">1 year</option>
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

          {createFetcher.state === 'idle' &&
            createFetcher.data &&
            !isTokenSuccess(createFetcher.data) &&
            'error' in createFetcher.data && (
              <p className="text-sm text-red-600 dark:text-red-400">{createFetcher.data.error}</p>
            )}
          {!tokenDone &&
            createFetcher.state === 'idle' &&
            createFetcher.data &&
            isTokenSuccess(createFetcher.data) && (
              <div className="p-4 space-y-4 text-green-900 bg-green-100 border border-green-600 rounded-md dark:bg-green-950 dark:text-green-200">
                <h4 className="font-bold">Copy Token Now</h4>
                <p className="mb-2">
                  Make sure to copy your <strong>"{createFetcher.data.description}"</strong> token
                  now. You won't be able to see it again.
                </p>
                <pre
                  className="p-4 font-mono break-words border border-green-900 dark:border-green-100 text-wrap rounded-sm"
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
                      setTokenDone(true);
                      revalidator.revalidate();
                    }}
                  >
                    Done
                  </ui.Button>
                  <ui.Button type="button" onClick={copyToClipboard}>
                    Copy
                  </ui.Button>
                </div>
              </div>
            )}
        </div>
      )}

      {tokens.length > 0 && (
        <div className="overflow-hidden rounded-sm border bg-background">
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
                  {canDelete && (
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
                            setTokenDone(true);
                            deleteFetcher.submit(formData, { method: 'POST' });
                          }
                        }}
                      >
                        <ui.StatefulButton
                          type="submit"
                          variant="outline"
                          busy={
                            deleteFetcher.state === 'submitting' && deletingTokenId === token.id
                          }
                          disabled={deleteFetcher.state === 'submitting'}
                          busyMessage="Deleting..."
                        >
                          Delete
                        </ui.StatefulButton>
                      </deleteFetcher.Form>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
