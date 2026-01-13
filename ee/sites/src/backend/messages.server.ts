import type { Context } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';

export interface SiteRequestMessageData {
  name: string;
  email: string;
  labWebsite?: string;
  additionalInfo?: string;
  userId?: string;
  userEmail?: string;
}

/**
 * Creates a new site request message in the database
 */
export async function createSiteRequestMessage(
  ctx: Context,
  data: SiteRequestMessageData,
): Promise<string> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  let plain = '';
  if (data.labWebsite) {
    plain += `Current Website: ${data.labWebsite}${data.additionalInfo ? '\n\n' : ''}`;
  }
  if (data.additionalInfo) {
    plain += data.additionalInfo;
  }

  const message = await prisma.message.create({
    data: {
      id: uuidv7(),
      date_created: now,
      date_modified: now,
      module: 'SITES',
      type: 'site_request',
      status: 'PENDING',
      payload: {
        name: data.name,
        email: data.email,
        labWebsite: data.labWebsite,
        additionalInfo: data.additionalInfo,
        userId: data.userId,
        from: data.userEmail,
        subject: `Site Request for ${data.name} (${data.email})`,
        plain,
      },
      results: {
        name: data.name,
        email: data.email,
        labWebsite: data.labWebsite,
        additionalInfo: data.additionalInfo,
      },
    },
  });

  return message.id;
}
