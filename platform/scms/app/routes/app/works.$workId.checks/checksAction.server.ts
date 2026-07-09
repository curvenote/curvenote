import { data } from 'react-router';
import { userHasScope, userHasWorkScope, type WorkContext } from '@curvenote/scms-server';
import {
  getExtensionCheckServicesFromServerConfig,
  loadCheckMaintenanceByServiceId,
  scopes,
  type ExtensionCheckService,
  type ServerExtension,
} from '@curvenote/scms-core';

const CHECK_DISPATCH_INTENTS = new Set([
  'execute',
  'retry',
  'rerun',
  'run',
  'accept-eula',
  'start',
]);

export function isCheckDispatchIntent(intent: string): boolean {
  const normalized = intent.trim().toLowerCase();
  if (!normalized) return false;
  return CHECK_DISPATCH_INTENTS.has(normalized) || normalized.includes('retry');
}

export function rejectCheckDispatch() {
  return data(
    {
      error: {
        type: 'general',
        message: 'You do not have permission to dispatch checks for this work',
      },
    },
    { status: 403 },
  );
}

function resolveCheckServiceFromForm(
  formData: FormData,
  checkServices: ExtensionCheckService[],
): ExtensionCheckService | undefined {
  const kind =
    formData.get('checkServiceId')?.toString() ||
    formData.get('checkKind')?.toString() ||
    formData.get('kind')?.toString();
  if (!kind) return undefined;
  return checkServices.find((service) => service.id === kind);
}

export async function handleChecksRouteAction({
  ctx,
  formData,
  serverExtensions,
}: {
  ctx: WorkContext;
  formData: FormData;
  serverExtensions: ServerExtension[];
}) {
  if (!userHasScope(ctx.user, scopes.app.works.checks.feature)) {
    return data(
      { error: { type: 'general', message: 'Checks are not available' } },
      { status: 404 },
    );
  }

  const intent = formData.get('intent')?.toString() ?? '';
  if (!intent) {
    return data({ error: { type: 'general', message: 'Intent is required' } }, { status: 400 });
  }

  const canDispatchChecks = userHasWorkScope(ctx.user, scopes.work.id.checks.dispatch, ctx.work.id);
  if (isCheckDispatchIntent(intent) && !canDispatchChecks) {
    return rejectCheckDispatch();
  }

  const checkServices = getExtensionCheckServicesFromServerConfig(ctx.$config, serverExtensions);
  const service = resolveCheckServiceFromForm(formData, checkServices);
  if (!service?.handleAction) {
    return data(
      { error: { type: 'general', message: 'Check service not found' } },
      { status: 404 },
    );
  }

  const workVersionId = formData.get('workVersionId')?.toString();
  if (!workVersionId) {
    return data(
      { error: { type: 'general', message: 'Work version ID is required' } },
      { status: 400 },
    );
  }

  if (isCheckDispatchIntent(intent)) {
    const maintenance = await loadCheckMaintenanceByServiceId(ctx, serverExtensions, service.id);
    if (maintenance?.underMaintenance) {
      return data(
        {
          error: {
            type: 'maintenance',
            message: maintenance.message,
          },
        },
        { status: 503 },
      );
    }
  }

  const checkRunId = formData.get('checkRunId')?.toString();
  const result = await service.handleAction({
    intent,
    workVersionId,
    formData,
    ctx,
    checkRunId,
    serverExtensions,
  });

  if (!result.success || result.error) {
    return data(
      {
        error: result.error ?? {
          type: 'general',
          message: 'Check action failed',
        },
      },
      { status: result.status ?? 500 },
    );
  }

  return data({ success: true, updated: result.updated ?? false });
}
