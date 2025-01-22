import chalk from 'chalk';
import { decodeTokenAndCheckExpiry } from '../tokens.js';
import type { ISession } from '../types.js';
import { showCurrentTokenRecord } from './showCurrentTokenRecord.js';
import { formatDate } from '../../submissions/utils.js';
import { MyUser } from '../../models.js';

export async function checkUserTokenStatus(session: ISession) {
  if (session.isAnon) {
    session.log.error('Anonymous session, select a token.');
    return;
  }

  const active = showCurrentTokenRecord(session.log);
  if (!active) {
    session.log.error('No active token found');
    return;
  }

  session.log.debug(`Token issued by ${active?.api}`); // active api == audience
  const { decoded, expired } = decodeTokenAndCheckExpiry(active.token, session.log, false);
  session.log.info(`\nToken status: ${expired ? chalk.red('EXPIRED') : chalk.green('CURRENT')}`);
  session.log.info(
    `Expiry: ${decoded.exp ? formatDate(new Date(decoded.exp * 1000).toISOString()) : 'no expiry'}`,
  );

  if (!expired) {
    const model = new MyUser(session);
    const me = await model.get();
    const name = me.data.username ? `@${me.data.username}` : me.data.display_name;
    session.log.info(`Login as ${name} <${me.data.email}> verified by ${model.$createUrl()}`);
  }
}
