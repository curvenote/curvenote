import type { Logger } from 'myst-cli-utils';
import CLIENT_VERSION from '../../version.js';
import type { JsonObject } from '@curvenote/blocks';
import type { Response as FetchResponse } from 'node-fetch';
import chalk from 'chalk';
import boxen from 'boxen';

export function logUpdateRequired({
  current,
  minimum,
  upgradeCommand,
  twitter,
}: {
  current: string;
  minimum: string;
  upgradeCommand: string;
  twitter: string;
}) {
  return boxen(
    `Upgrade Required! ${chalk.dim(`v${current}`)} ≫ ${chalk.green.bold(
      `v${minimum} (minimum)`,
    )}\n\nRun \`${chalk.cyanBright.bold(
      upgradeCommand,
    )}\` to update.\n\nFollow ${chalk.yellowBright(
      `@${twitter}`,
    )} for updates!\nhttps://twitter.com/${twitter}`,
    {
      padding: 1,
      margin: 1,
      borderColor: 'red',
      borderStyle: 'round',
      textAlignment: 'center',
    },
  );
}

/**
 * This requires the body to be decoded as json and so is called later in the response handling chain
 *
 * @param log
 * @param response
 * @param body
 */
export function checkForCurvenoteAPIClientVersionRejection(
  log: Logger,
  response: FetchResponse,
  body: JsonObject,
) {
  // Check for client version rejection api.curvenote.com
  if (response.status === 400) {
    log.debug(`Request failed: ${JSON.stringify(body)}`);
    if (body?.errors?.[0].code === 'outdated_client') {
      logUpdateRequired({
        current: CLIENT_VERSION,
        minimum: 'latest',
        upgradeCommand: 'npm i -g curvenote@latest',
        twitter: 'curvenote',
      });
    }
  }
}

/**
 * This should be called immedately after the fetch
 *
 * @param log
 * @param response
 */
export function checkForPlatformAPIClientVersionRejection(log: Logger, response: FetchResponse) {
  // Check for client version rejection sites.curvenote.com
  if (response.status === 403) {
    const minimum = response.headers.get('x-minimum-client-version');
    if (minimum != null) {
      log.debug(response.statusText);
      log.error(
        logUpdateRequired({
          current: CLIENT_VERSION,
          minimum,
          upgradeCommand: 'npm i -g curvenote@latest',
          twitter: 'curvenote',
        }),
      );
      process.exit(1);
    }
  }
}
