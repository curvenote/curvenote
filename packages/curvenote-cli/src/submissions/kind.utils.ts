import chalk from 'chalk';
import inquirer from 'inquirer';
import { plural } from 'myst-common';
import type {
  CollectionListingDTO,
  SubmissionKindDTO,
  SubmissionKindListingDTO,
} from '@curvenote/common';
import type { ISession } from '../session/types.js';
import { getFromJournals } from '../utils/api.js';

/**
 * Fetch `venue` kinds from API
 */
export async function listSubmissionKinds(
  session: ISession,
  venue: string,
): Promise<SubmissionKindListingDTO> {
  return getFromJournals(session, `/sites/${venue}/kinds`);
}

/**
 * Get list of collection names for collections that include kind as id
 */
function collectionsWithKind(kindId: string, collections: CollectionListingDTO) {
  return collections.items
    .filter((c) => {
      return c.kinds.map((k) => k.id).includes(kindId);
    })
    .map((c) => c.name);
}

/**
 * Choose and return one kind based only on venue
 *
 * Successful cases include:
 * - `venue` with a single `kind`, which is returned
 * - `opts.yes` is `true` and the `venue` has a default `kind`, which is returned
 * - user interactively selects one of the available `kinds` on the `venue`
 *
 * On failure, this function will `process.exit(1)`. Failure cases include:
 * - Fetch for venue kinds fails (user is not authorized, venue does not exist, etc)
 * - Venue has no kinds
 * - `opts.yes` is `true` but there is no default `kind`
 *
 * This function also takes `collections`. These have no effect on the `kind` determination,
 * but they can improve messaging during interactive selection.
 */
export async function determineKindFromVenue(
  session: ISession,
  venue: string,
  collections?: CollectionListingDTO,
  opts?: { yes?: boolean },
): Promise<{ kind: SubmissionKindDTO; prompted?: boolean }> {
  let kinds: SubmissionKindDTO[];
  try {
    const resp = await listSubmissionKinds(session, venue);
    kinds = [...resp.items.filter((k) => k.default), ...resp.items.filter((k) => !k.default)];
  } catch {
    session.log.info(`${chalk.red(`⛔️ unable to get available kinds from venue "${venue}"`)}`);
    process.exit(1);
  }
  if (kinds.length === 0) {
    session.log.info(`${chalk.red(`⛔️ venue "${venue}" has no kinds`)}`);
    process.exit(1);
  }
  if (kinds.length === 1) {
    session.log.debug(`using only available kind ${kinds[0].name}`);
    return { kind: kinds[0] };
  }
  if (opts?.yes) {
    const defaultKind = kinds.find((k) => k.default);
    if (defaultKind) {
      session.log.debug(`using default kind ${defaultKind.name}`);
      return { kind: defaultKind };
    }
    session.log.info(`${chalk.red(`⛔️ kind must be specified for venue "${venue}"`)}`);
    process.exit(1);
  }
  const response = await inquirer.prompt([
    {
      name: 'kind',
      type: 'list',
      message: `Venue ${venue} has multiple kinds. Which do you want to select?`,
      choices: kinds.map((k) => {
        let suffix = '';
        if (collections) {
          const suffixCollections = collectionsWithKind(k.id, collections);
          if (suffixCollections) {
            suffix = ` (${plural('collection(s)', suffixCollections)}: ${suffixCollections.join(', ')})`;
          }
        }
        return {
          name: `${k.name}${suffix}`,
          value: k,
        };
      }),
    },
  ]);
  return { kind: response.kind, prompted: true };
}
