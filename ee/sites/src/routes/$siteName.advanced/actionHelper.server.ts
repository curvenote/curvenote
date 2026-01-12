import { data } from 'react-router';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, withValidFormData } from '@curvenote/scms-server';
import { zfd } from 'zod-form-data';
import { z } from 'zod';
import { dbSetSiteRestricted } from './db.server.js';

export { EditorView } from '@codemirror/view';

export async function actionUpdateSiteByJson(ctx: SiteContext, formData: FormData) {
  const metadata = formData.get('metadata');

  if (typeof metadata !== 'string') {
    return data({ error: 'Invalid form data' }, { status: 400 });
  }

  const prisma = await getPrismaClient();

  try {
    const parsedMetadata = JSON.parse(metadata);
    if (typeof parsedMetadata !== 'object') {
      return data({ error: 'Invalid metadata format, must be an object' }, { status: 400 });
    }

    // Remove fields that are duplicated in the site table
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      name,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      title,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      description,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      private: privateField,
      ...filteredMetadata
    } = parsedMetadata;

    await prisma.site.update({
      where: { name: ctx.site.name },
      data: {
        metadata: filteredMetadata,
        date_modified: new Date().toISOString(),
      },
    });

    return { info: 'Site metadata updated successfully' };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    return data({ error: 'Failed to parse metadata JSON' }, { status: 400 });
  }
}

const SaveSettingsObject = {
  restricted: zfd.checkbox({ trueValue: 'restricted' }),
};

export async function actionSaveSiteRestriction(ctx: SiteContext, formData: FormData) {
  const SaveSettingsSchema = zfd.formData(SaveSettingsObject);
  let payload;
  try {
    payload = SaveSettingsSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data(
      { message: 'unprocessable content', error: error?.issues?.[0]?.message },
      { status: 422 },
    );
  }
  const { restricted } = payload;
  console.log('restricted', restricted);
  await dbSetSiteRestricted(ctx.site.id, restricted);
  return { message: 'ok', info: 'site submission rules updated' };
}

const UpdateSiteSettingsSchema = zfd.formData({
  title: zfd.text(z.string().min(1, 'Title is required')),
  description: zfd.text(z.string().optional()),
  private: zfd.checkbox({ trueValue: 'private' }),
  magicLinksEnabled: zfd.checkbox({ trueValue: 'magicLinksEnabled' }),
});

export async function actionUpdateSiteSettings(ctx: SiteContext, formData: FormData) {
  return withValidFormData(UpdateSiteSettingsSchema, formData, async (payload) => {
    const prisma = await getPrismaClient();

    try {
      // Get existing site.data to preserve other fields
      const existingSite = await prisma.site.findUnique({
        where: { name: ctx.site.name },
        select: { data: true },
      });

      const existingData = (existingSite?.data as Record<string, unknown>) ?? {};
      const updatedData = {
        ...existingData,
        magicLinksEnabled: payload.magicLinksEnabled,
      };

      await prisma.site.update({
        where: { name: ctx.site.name },
        data: {
          title: payload.title,
          description: payload.description ?? null,
          private: payload.private,
          data: updatedData,
          date_modified: new Date().toISOString(),
        },
      });

      return { info: 'Site settings updated successfully' };
    } catch (error) {
      console.error('Failed to update site settings:', error);
      return data({ error: 'Failed to update site settings' }, { status: 500 });
    }
  });
}
