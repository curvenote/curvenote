import chalk from 'chalk';
import { decodeTokenAndCheckExpiry, getCurrentTokenRecord } from '../tokens.js';
import type { ISession } from '../types.js';
import { showActiveTokenRecord } from './showCurrentTokenRecord.js';
import { formatDate } from '../../submissions/utils.js';
import { MyUser } from '../../models.js';

export async function checkUserTokenStatus(session: ISession) {
  if (session.isAnon) {
    session.log.error('Anonymous session, select a token.');
    return;
  }
  const active = getCurrentTokenRecord();
  if (!active) {
    session.log.error('No active token found');
    return;
  }

  const { decoded, expired } = decodeTokenAndCheckExpiry(active?.token, session.log, false, 'user');
  session.log.debug(`Token issued by ${active?.api}`); // active api == audience

  let revoked = false;
  if (expired !== true) {
    try {
      await session.refreshSessionToken({ checkStatusOnFailure: false });
    } catch (e: any) {
      revoked = true;
    }
  }

  showActiveTokenRecord(session.log, active, expired, revoked);

  session.log.info(
    `Expiry: ${decoded.exp && !decoded.ignoreExpiration ? formatDate(new Date(decoded.exp * 1000).toISOString()) : 'no expiry'}`,
  );
  let statusMessage = chalk.green('VERIFIED');
  if (revoked) {
    statusMessage = chalk.red('REVOKED');
  } else if (expired === 'soon' && !revoked) {
    statusMessage = chalk.yellow('VERIFIED BUT EXPIRING SOON');
  } else if (expired) {
    statusMessage = chalk.red('EXPIRED');
  }
  session.log.info(`Token status: ${statusMessage}`);

  if (expired !== true && !revoked) {
    const model = new MyUser(session);
    const me = await model.get();
    const name = me.data.username ? `@${me.data.username}` : me.data.display_name;
    const loginVerifiedMessage = `Login as ${name} <${me.data.email}> verified by ${model.$createUrl()}`;
    session.log.info(loginVerifiedMessage);
  }

  return true;
}
