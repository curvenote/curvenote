import { useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import type { SiteBackendConfig } from '../backend/db.server.js';
import type { SiteUserWithBluesky } from './backend.server.js';

const BACKEND_CURVENOTE_CDN = 'curvenote-cdn';
const BACKEND_ATPROTO = 'atproto';

export function BackendForm({
  siteId,
  currentBackend,
  siteUsersWithBluesky,
}: {
  siteId: string;
  currentBackend: SiteBackendConfig | undefined;
  siteUsersWithBluesky: SiteUserWithBluesky[];
}) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();
  const backendType = currentBackend?.type ?? BACKEND_CURVENOTE_CDN;
  const nominatedId =
    currentBackend?.type === 'atproto' ? currentBackend.nominatedUserLinkedAccountId : '';
  const canSelectAtproto = siteUsersWithBluesky.length > 0;

  return (
    <primitives.Card lift className="max-w-4xl px-6 py-4 space-y-4" validateUsing={fetcher}>
      <h2>Backend</h2>
      <p className="text-sm font-light">
        Choose where published content is served from. Curvenote CDN is the default.
      </p>

      <fetcher.Form method="POST" className="m-0 space-y-4">
        <input type="hidden" name="formAction" value="update-backend" />
        <input type="hidden" name="siteId" value={siteId} />

        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="backendType"
                value={BACKEND_CURVENOTE_CDN}
                defaultChecked={backendType === BACKEND_CURVENOTE_CDN}
                className="rounded-full border-input"
              />
              Curvenote CDN
            </label>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${!canSelectAtproto ? 'text-muted-foreground opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="backendType"
                value={BACKEND_ATPROTO}
                defaultChecked={backendType === BACKEND_ATPROTO}
                disabled={!canSelectAtproto}
                className="rounded-full border-input"
              />
              AT Protocol
            </label>
          </div>

          {!canSelectAtproto && (
            <p className="text-sm text-muted-foreground">
              No site members with a connected Bluesky account. Connect Bluesky in Settings →
              Linked accounts, then return here.
            </p>
          )}

          {canSelectAtproto && (
            <div className="space-y-2">
              <label htmlFor="nominatedUserLinkedAccountId" className="block text-sm font-medium">
                Nominated user (Bluesky account used for publishing)
              </label>
              <select
                id="nominatedUserLinkedAccountId"
                name="nominatedUserLinkedAccountId"
                className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue={nominatedId}
              >
                <option value="">— Select when using AT Protocol —</option>
                {siteUsersWithBluesky.map((u) => (
                  <option key={u.linkedAccountId} value={u.linkedAccountId}>
                    {u.displayName ?? u.userId} (@{u.handleOrDid})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <ui.Button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? 'Saving…' : 'Save backend'}
        </ui.Button>
      </fetcher.Form>
    </primitives.Card>
  );
}
