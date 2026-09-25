import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { DOI_CONTENT_TYPE, scopes } from '@curvenote/scms-core';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { getPrismaClient, userHasScope, validateFormData } from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { getSiteWithAppData } from '../../backend/db.server.js';
import {
  configureCurvenote,
  configureCustom,
  updatePrefix,
} from '../../backend/doi/configure.server.js';
import { updateKindMapping } from '../../backend/doi/kinds.server.js';
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
const KindMappingSchema = zfd.formData({
  kinds: zfd.json(
    z
      .array(
        z.object({
          kindId: z.string().min(1).max(100),
          doiContentType: z.enum(DOI_CONTENT_TYPE).nullable(),
        }),
      )
      .max(500),
  ),
});

// Setup and reset swap the card that submitted them, so the new page is the confirmation: a
// success message there would only flash before the card unmounts.
const INFO: Partial<Record<DoiIntent, string>> = {
  'update-prefix': 'Prefix updated.',
  'bind-role': 'Role validated and linked. This Site can now register DOIs.',
  'unlink-role': 'Role unlinked. The Site is waiting for a role again.',
  'update-kind-mapping': 'Eligible Submission Kinds saved.',
};

async function isCustomPrefixEnabled(ctx: SiteContextWithUser) {
  const site = await getSiteWithAppData(ctx.site.name);
  return site?.data?.doiCustomPrefixEnabled ?? false;
}

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
  switch (intent) {
    case 'configure-curvenote':
      return configureCurvenote(deps, { siteId, actor });
    case 'configure-custom': {
      const { prefix } = validateFormData(PrefixSchema, formData);
      const customPrefixEnabled = await isCustomPrefixEnabled(ctx);
      return configureCustom(deps, { siteId, actor, customPrefixEnabled, prefix: prefix ?? '' });
    }
    case 'update-prefix': {
      const { prefix, occ } = validateFormData(PrefixOccSchema, formData);
      const customPrefixEnabled = await isCustomPrefixEnabled(ctx);
      return updatePrefix(deps, { siteId, actor, customPrefixEnabled, prefix: prefix ?? '', occ });
    }
    case 'bind-role': {
      const { role, occ } = validateFormData(RoleOccSchema, formData);
      return bindRole(deps, { siteId, actor, role: role ?? '', occ });
    }
    case 'unlink-role': {
      const { occ } = validateFormData(OccSchema, formData);
      return unlinkRole(deps, { siteId, actor, occ });
    }
    case 'reset': {
      const { occ } = validateFormData(OccSchema, formData);
      return resetConfig(deps, { siteId, actor, occ });
    }
    case 'update-kind-mapping': {
      const { kinds } = validateFormData(KindMappingSchema, formData);
      return updateKindMapping(deps, { siteId, actor, kinds });
    }
    default:
      // A new intent must get its own case: never fall through to a destructive one.
      throw new Error(`Unhandled DOI intent: ${intent satisfies never}`);
  }
}

export async function runDoiIntent(ctx: SiteContextWithUser, formData: FormData) {
  // `site:doi:configure` (checked by withAppSiteContext) opens the door to any site admin;
  // app:sites:doi:feature is the per-user preview flag, granted through a Role (e.g.
  // doi-preview), that actually gates the screen while it is in preview.
  if (!userHasScope(ctx.user, scopes.app.sites.doi.feature)) {
    return data({ error: 'DOI registration is not available for this account.' }, { status: 403 });
  }
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
    return data({ error: result.error }, { status: result.status });
  }
  const info = INFO[intent];
  return info ? { info } : {};
}
