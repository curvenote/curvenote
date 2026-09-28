import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { scopes } from '@curvenote/scms-core';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, userHasScope, withValidFormData } from '@curvenote/scms-server';

const SetDoiCustomPrefixSchema = zfd.formData({
  doiCustomPrefixEnabled: zfd.checkbox({ trueValue: 'doiCustomPrefixEnabled' }),
});

/**
 * Own DOI prefix is an Enterprise feature, switched per site by a Curvenote system admin.
 * The Advanced route only requires `site:update` and the menu entry is merely hidden from
 * site admins, so the system-admin check has to happen here, on the server.
 */
export async function actionSetDoiCustomPrefixEnabled(ctx: SiteContext, formData: FormData) {
  if (!userHasScope(ctx.user, scopes.system.admin)) {
    return data(
      { error: 'Only a Curvenote system admin can change this setting.' },
      { status: 403 },
    );
  }
  return withValidFormData(SetDoiCustomPrefixSchema, formData, async (payload) => {
    const prisma = await getPrismaClient();
    const existing = await prisma.site.findUnique({
      where: { id: ctx.site.id },
      select: { data: true },
    });
    const existingData = (existing?.data as Record<string, unknown> | null) ?? {};
    await prisma.site.update({
      where: { id: ctx.site.id },
      data: {
        data: { ...existingData, doiCustomPrefixEnabled: payload.doiCustomPrefixEnabled },
        date_modified: new Date().toISOString(),
      },
      select: { id: true },
    });
    return {
      info: payload.doiCustomPrefixEnabled
        ? 'Own DOI prefix enabled for this Site'
        : 'Own DOI prefix disabled for this Site',
    };
  });
}
