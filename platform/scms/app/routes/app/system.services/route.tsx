import type { Route } from './+types/route';
import { useFetcher } from 'react-router';
import { useEffect } from 'react';
import { withAppAdminContext } from '@curvenote/scms-server';
import {
  PageFrame,
  SystemAdminBadge,
  ui,
  primitives,
  obfuscateSecret,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { CheckCircle2 } from 'lucide-react';

const INTENT_TEST = 'checks-relay-test-connection';

const RELAY_FETCH_TIMEOUT_MS = 20_000;

function normalizeRelayBaseUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  return t.replace(/\/$/, '');
}

/** One entry per relay service; `data` is the raw object from the API for full-field inspection. */
function parseServicesForDisplay(json: unknown): { name: string; data: unknown }[] {
  if (!Array.isArray(json)) return [];
  return json.map((row, i) => {
    if (
      row !== null &&
      typeof row === 'object' &&
      typeof (row as { name?: unknown }).name === 'string'
    ) {
      return { name: (row as { name: string }).name, data: row };
    }
    return { name: `Service ${i + 1}`, data: row };
  });
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Services', 'System Administration', branding.title) }];
};

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args, { redirectTo: '/app' });
  const checks = ctx.$config.app?.checks;
  const base = normalizeRelayBaseUrl(checks?.relayBaseUrl);
  const apiKey = checks?.relayApiKey;
  const relayApiKeyDisplay = obfuscateSecret(apiKey);
  return {
    relayBaseUrl: base ?? '',
    relayApiKeyDisplay: relayApiKeyDisplay || '(not configured)',
    canAttemptHealth: Boolean(base),
    canListServices: Boolean(base && apiKey),
  };
}

type ActionSuccess = {
  healthOk: true;
  services: { name: string; data: unknown }[];
  listError?: string;
};

type ActionError = {
  error: string;
};

export async function action(args: Route.ActionArgs): Promise<ActionSuccess | ActionError> {
  const ctx = await withAppAdminContext(args);
  const formData = await args.request.formData();
  if (formData.get('intent') !== INTENT_TEST) {
    return { error: 'Invalid request' };
  }

  const checks = ctx.$config.app?.checks;
  const base = normalizeRelayBaseUrl(checks?.relayBaseUrl);
  const apiKey = checks?.relayApiKey;

  if (!base) {
    return { error: 'Checks relay base URL is not configured (app.checks.relayBaseUrl).' };
  }

  const healthUrl = `${base}/api/v1`;
  const servicesUrl = `${base}/api/v1/services`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), RELAY_FETCH_TIMEOUT_MS);

  try {
    const healthRes = await fetch(healthUrl, {
      method: 'GET',
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });

    if (!healthRes.ok) {
      return {
        error:
          `Relay health check failed (${healthRes.status} ${healthRes.statusText || ''}).`.trim(),
      };
    }

    let healthBody: unknown;
    try {
      healthBody = await healthRes.json();
    } catch {
      return { error: 'Relay health check returned a non-JSON response.' };
    }

    const statusOk =
      healthBody !== null &&
      typeof healthBody === 'object' &&
      (healthBody as { status?: string }).status === 'ok';
    if (!statusOk) {
      return { error: 'Relay health check did not return status "ok".' };
    }

    if (!apiKey) {
      return {
        healthOk: true,
        services: [],
        listError:
          'app.checks.relayApiKey is not set — health check passed, but registered services cannot be listed.',
      };
    }

    const servicesRes = await fetch(servicesUrl, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!servicesRes.ok) {
      const errText = await servicesRes.text().catch(() => '');
      return {
        error:
          `List services failed (${servicesRes.status}): ${errText.slice(0, 200) || servicesRes.statusText}`.trim(),
      };
    }

    let servicesJson: unknown;
    try {
      servicesJson = await servicesRes.json();
    } catch {
      return { error: 'List services returned a non-JSON response.' };
    }

    return { healthOk: true, services: parseServicesForDisplay(servicesJson) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.name === 'AbortError') {
      return { error: `Request timed out after ${RELAY_FETCH_TIMEOUT_MS / 1000}s.` };
    }
    return { error: message || 'Request failed.' };
  } finally {
    clearTimeout(t);
  }
}

export default function SystemServices({ loaderData }: Route.ComponentProps) {
  const { relayBaseUrl, relayApiKeyDisplay, canAttemptHealth, canListServices } = loaderData;
  const fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data && fetcher.data.error) {
      ui.toastError(fetcher.data.error);
    }
    if (
      fetcher.state === 'idle' &&
      fetcher.data &&
      'healthOk' in fetcher.data &&
      fetcher.data.healthOk
    ) {
      if (fetcher.data.listError) {
        ui.toastSuccess('Checks relay API is up.');
        ui.toastWarning(fetcher.data.listError);
      } else {
        ui.toastSuccess('Checks relay is reachable and services were loaded.');
      }
    }
  }, [fetcher.state, fetcher.data]);

  const result = fetcher.data && 'healthOk' in fetcher.data ? fetcher.data : null;
  const isTesting = fetcher.state !== 'idle';

  return (
    <PageFrame
      title="External services"
      description="Verify configured integrations from application config (read-only)."
    >
      <div className="flex gap-2 items-center mb-6">
        <SystemAdminBadge />
      </div>

      {!canAttemptHealth && (
        <ui.SimpleAlert
          type="warning"
          message="Set app.checks.relayBaseUrl in configuration to enable relay connectivity checks."
        />
      )}

      {canAttemptHealth && !canListServices && (
        <ui.SimpleAlert
          type="warning"
          message="Set app.checks.relayApiKey in configuration to list registered services after the health check."
        />
      )}

      <primitives.Card className="p-6 max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold">Checks relay</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Values come from <code className="text-xs">app.checks</code> in app config. Use Test
          connection to hit the relay from this server.
        </p>

        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="relay-base-url">
              Base URL
            </label>
            <ui.TextField
              id="relay-base-url"
              readOnly
              value={relayBaseUrl || '(not configured)'}
              className="w-full font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="relay-api-key">
              API key
            </label>
            <ui.TextField
              id="relay-api-key"
              readOnly
              type="password"
              value={relayApiKeyDisplay}
              className="w-full font-mono"
              autoComplete="off"
            />
          </div>
        </div>

        <fetcher.Form method="post" className="flex flex-wrap gap-4 items-center">
          <input type="hidden" name="intent" value={INTENT_TEST} />
          <ui.StatefulButton
            type="submit"
            disabled={!canAttemptHealth || isTesting}
            size="sm"
            overlayBusy
            busy={isTesting}
          >
            Test connection
          </ui.StatefulButton>
          {result?.healthOk && (
            <span className="inline-flex gap-2 items-center text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden />
              API is up
            </span>
          )}
        </fetcher.Form>

        {result?.healthOk && result.listError && (
          <ui.SimpleAlert type="warning" className="mt-6" message={result.listError} />
        )}

        {result?.healthOk && result.services.length > 0 && (
          <div className="pt-6 mt-6 border-t">
            <h3 className="mb-3 text-sm font-medium">Registered services</h3>
            <ul className="space-y-6">
              {result.services.map((svc, i) => (
                <li key={`${svc.name}-${i}`}>
                  <div className="mb-2 font-mono text-sm font-medium">{svc.name}</div>
                  <pre className="max-h-[32rem] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(svc.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result?.healthOk && result.services.length === 0 && !result.listError && (
          <p className="pt-6 mt-6 text-sm border-t text-muted-foreground">
            Health check passed; the relay returned an empty service list.
          </p>
        )}
      </primitives.Card>
    </PageFrame>
  );
}
