import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../prisma.server.js';
import { verifyUnsubscribeToken } from '../sign.tokens.server.js';
import { getConfig } from '../../app-config.server.js';

export async function dbGetUnsubscribedEmail(email: string) {
  const prisma = await getPrismaClient();
  return await prisma.unsubscribedEmail.findUnique({
    where: { email },
  });
}

export async function dbToggleUnsubscribeWithToken(token: string, unsubscribe: boolean) {
  const config = await getConfig();
  const resendConfig = config.api.resend;
  if (!resendConfig?.apiKey) {
    throw new Error('Resend API key not configured');
  }
  const { email } = verifyUnsubscribeToken(token, resendConfig.apiKey);
  return dbToggleUnsubscribe(email, unsubscribe);
}

export async function dbToggleUnsubscribe(email: string, unsubscribe: boolean) {
  const prisma = await getPrismaClient();

  if (unsubscribe) {
    // Add to unsubscribe list
    await prisma.unsubscribedEmail.upsert({
      where: { email },
      update: {},
      create: {
        id: uuidv7(),
        email,
        date_created: new Date().toISOString(),
      },
    });
  } else {
    // Remove from unsubscribe list
    await prisma.unsubscribedEmail.deleteMany({
      where: { email },
    });
  }
  return email;
}
