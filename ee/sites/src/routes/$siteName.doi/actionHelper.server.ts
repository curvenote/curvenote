import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { scopes } from '@curvenote/scms-core';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { getPrismaClient, userHasScope, validateFormData } from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { getSiteWithAppData } from '../../backend/db.server.js';
import {
  configureCurvenote,
  configureCustom,
  updatePrefix,
} from '../../backend/doi/configure.server.js';
import { bindRole, resetConfig, unlinkRole } from '../../backend/doi/role.server.js';
import { DOI_INTENTS } from '../../backend/doi/types.js';
import type { DoiDeps, DoiIntent, DoiResult } from '../../backend/doi/types.js';

const IntentSchema = zfd.formData({ intent: z.enum(DOI_INTENTS) });
const Occ = zfd.numeric(z.number().int().min(0));
// Empty text arrives as undefined; the service owns the "enter a prefix/role" message.
const Text = zfd.text(z.string().max(200).optional());
const PrefixSchema = zfd.formData({ prefix: Text });
const PrefixOccSchema = zfd.formData({ prefix: Text, occ: Occ });
const RoleOccSchema = zfd.formData({ role: Text, occ: Occ });
const OccSchema = zfd.formData({ occ: Occ });

const INFO: Record<DoiIntent, string> = {
  'configure-curvenote': 'DOI registration is set up with Curvenote-managed registration.',
  'configure-custom': 'Prefix saved. Curvenote will link your Crossref role.',
  'update-prefix': 'Prefix updated.',
  'bind-role': 'Role validated and linked. This Site can now register DOIs.',
  'unlink-role': 'Role unlinked. The Site is waiting for a role again.',
  reset: 'DOI setup was reset.',
};

const badRequest = (error: any) =>
  data({ error: error?.message ?? 'Invalid form data' }, { status: 400 });

async function dispatch(
  intent: DoiIntent,
  ctx: SiteContextWithUser,
  formData: FormData,
  deps: DoiDeps,
): Promise<DoiResult> {
  const siteId = ctx.site.id;
  // The form never says who the caller is: the scope check is the only source.
  const actor = {
    userId: ctx.user.id,
    isSystemAdmin: userHasScope(ctx.user, scopes.system.admin),
  };
  if (intent === 'configure-curvenote') {
    return configureCurvenote(deps, { siteId, actor });
  }
  if (intent === 'configure-custom' || intent === 'update-prefix') {
    const site = await getSiteWithAppData(ctx.site.name);
    const customPrefixEnabled = site?.data?.doiCustomPrefixEnabled ?? false;
    if (intent === 'configure-custom') {
      const { prefix } = validateFormData(PrefixSchema, formData);
      return configureCustom(deps, { siteId, actor, customPrefixEnabled, prefix: prefix ?? '' });
    }
    const { prefix, occ } = validateFormData(PrefixOccSchema, formData);
    return updatePrefix(deps, { siteId, actor, customPrefixEnabled, prefix: prefix ?? '', occ });
  }
  if (intent === 'bind-role') {
    const { role, occ } = validateFormData(RoleOccSchema, formData);
    return bindRole(deps, { siteId, actor, role: role ?? '', occ });
  }
  const { occ } = validateFormData(OccSchema, formData);
  if (intent === 'unlink-role') {
    return unlinkRole(deps, { siteId, actor, occ });
  }
  return resetConfig(deps, { siteId, actor, occ });
}

export async function runDoiIntent(ctx: SiteContextWithUser, formData: FormData) {
  let intent: DoiIntent;
  try {
    intent = validateFormData(IntentSchema, formData).intent;
  } catch (error) {
    return badRequest(error);
  }
  let deps: DoiDeps;
  try {
    deps = {
      prisma: await getPrismaClient(),
      creds: crossrefCredentialsFromConfig(ctx.$config),
    };
  } catch (error: any) {
    console.error('[doi]', error?.message);
    return data(
      { error: 'DOI registration is not configured on this deployment.' },
      { status: 500 },
    );
  }
  let result: DoiResult;
  try {
    result = await dispatch(intent, ctx, formData, deps);
  } catch (error: any) {
    // validateFormData throws a plain object with `issues`; anything else is a real failure.
    if (error?.issues) {
      return badRequest(error);
    }
    throw error;
  }
  if (!result.ok) {
    return data(
      { error: result.error, ...(result.field ? { field: result.field } : {}) },
      { status: result.status },
    );
  }
  return { info: INFO[intent] };
}
