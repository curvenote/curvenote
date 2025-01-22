import chalk from 'chalk';
import type { Logger } from 'myst-cli-utils';
import type { getTokens } from '../tokens.js';
import { decodeTokenAndCheckExpiry, getCurrentTokenRecord, summarizeAsString } from '../tokens.js';

export function showCurrentTokenRecord(log: Logger, tokens?: ReturnType<typeof getTokens>) {
  const active = getCurrentTokenRecord(tokens);
  if (active) {
    const { expired } = decodeTokenAndCheckExpiry(active?.token, log, false, 'user');
    let message = `\nActive token:\n${summarizeAsString(active)}`;
    if (expired === 'soon') {
      message = chalk.yellow(message);
    } else if (expired) {
      message = chalk.red(message);
    } else {
      message = chalk.green(message);
    }
    log.info(chalk.bold(message));
  }
  return active;
}
