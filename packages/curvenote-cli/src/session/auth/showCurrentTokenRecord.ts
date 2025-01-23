import chalk from 'chalk';
import type { Logger } from 'myst-cli-utils';
import { summarizeAsString } from '../tokens.js';
import type { TokenData } from '../types.js';

export function applyExpiryChalk(message: string, expired: boolean | 'soon', revoked?: boolean) {
  if (expired === 'soon' && !revoked) {
    message = chalk.yellow(message);
  } else if (expired || revoked) {
    message = chalk.red(message);
  } else {
    message = chalk.green(message);
  }
  return message;
}

export function showActiveTokenRecord(
  log: Logger,
  active: TokenData,
  expired: boolean | 'soon',
  revoked?: boolean,
) {
  let message = `\nActive token:\n${summarizeAsString(active)}`;
  message = applyExpiryChalk(message, expired, revoked);
  log.info(chalk.bold(message));
}
