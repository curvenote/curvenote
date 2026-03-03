import { getPrismaClient } from '../prisma.server.js';
import { verifyEmailVerificationToken } from '../sign.tokens.server.js';
import { getConfig } from '../../app-config.server.js';

/**
 * Verifies the email verification token and sets the user's email_verified to true.
 * Token must be valid and not expired (1 day expiry).
 */
export async function dbVerifyEmailWithToken(token: string) {
  const config = await getConfig();
  const resendConfig = config.api.resend;
  if (!resendConfig?.apiKey) {
    throw new Error('Resend API key not configured');
  }
  const { user_id, email } = verifyEmailVerificationToken(token, resendConfig.apiKey);
  const prisma = await getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: user_id },
  });
  if (!user) {
    throw new Error('User not found');
  }
  if (user.email !== email) {
    throw new Error('Email does not match');
  }

  await prisma.user.update({
    where: { id: user_id },
    data: { email_verified: true, date_modified: new Date().toISOString() },
  });
  return { email };
}
