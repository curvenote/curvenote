import chalk from 'chalk';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';
import { logCheckReport, runChecks } from '../check/runner.js';
import { writeJsonLogs } from '../utils/utils.js';
import type { ISession } from '../session/types.js';
import type { SubmissionKindDTO } from '@curvenote/common';
import type { Check } from '@curvenote/check-definitions';
import {
  checkVenueExists,
  determineCollectionAndKind,
  getSubmissionKind,
  getVenueCollections,
} from './submit.utils.js';
import { determineKindFromVenue } from './kind.utils.js';

/**
 * Return list of checks from `kind` object and print log message
 */
export function prepareChecksForSubmission(
  session: ISession,
  venue: string,
  kind: SubmissionKindDTO,
): Check[] {
  const checks = kind.checks;
  const numChecks = checks?.length ?? 0;
  if (numChecks === 0) {
    session.log.info(`✅ "${venue}" does not require checks for "${kind.name}"`);
  } else {
    session.log.info(`🚦 "${venue}" specifies ${checks?.length ?? 0} checks for "${kind.name}"`);
  }
  return checks ?? [];
}

type CheckOpts = {
  venue?: string;
  kind?: string;
  collection?: string;
  yes?: boolean;
};

/**
 * Combine available checks from @curvenote/check-implementations and local plugins
 */
function getCheckImplementations(session: ISession) {
  return [...submissionRuleChecks, ...(session.plugins?.checks ?? [])];
}

/**
 * Get checks to run based on venue and other optional inputs
 *
 * If no `venue` is supplied, this just returns a default list of checks.
 *
 * If `venue` is supplied, this only needs a valid `kind` to get checks;
 * `kind` may be provided explicitly or selected interactively.
 *
 * This function also accepts `collection`. In this case, if `kind` is not provided,
 * the interactive selection will only present the collection's kinds.
 * If `collection` and `kind` are provided, `kind` will be used to get
 * the checks, but there may be warnings logged if the `collection` and
 * `kind` are incompatible.
 *
 * Invalid `kind` or `venue` fail with `process.exit(1)`.
 */
async function getChecks(session: ISession, opts: CheckOpts): Promise<Check[]> {
  if (opts.venue) {
    await checkVenueExists(session, opts.venue);
    const collections = await getVenueCollections(session, opts.venue, false);
    let kind: SubmissionKindDTO;
    let prompted = false;
    if (opts.kind) {
      try {
        kind = await getSubmissionKind(session, opts.venue, opts.kind);
      } catch (err: any) {
        session.log.error(err.message);
        process.exit(1);
      }
      if (opts.collection) {
        const collection = collections.items.find((c) => c.name === opts.collection);
        if (!collection) {
          session.log.info(
            `${chalk.red(`Unknown collection "${opts.collection}" for venue "${opts.venue}"`)}`,
          );
        } else {
          if (!collection.open) {
            session.log.info(
              `${chalk.red(`Collection "${opts.collection}" is not open for submissions`)}`,
            );
          }
          if (!collection.kinds.find((k) => k.id === kind.id)) {
            session.log.info(
              `${chalk.red(`Collection "${opts.collection}" does not support kind "${opts.kind}"`)}`,
            );
          }
        }
      }
    } else if (opts.collection) {
      const result = await determineCollectionAndKind(session, opts.venue, collections, {
        ...opts,
        allowClosedCollection: true,
      });
      kind = result.kind;
      prompted = result.prompted || prompted;
    } else {
      const result = await determineKindFromVenue(session, opts.venue, collections, opts);
      kind = result.kind;
      prompted = result.prompted || prompted;
    }
    session.log.info(
      `${chalk.green(`🏃‍♂️ Running checks against kind "${kind.name}" from venue "${opts.venue}"`)}`,
    );
    if (prompted) {
      session.log.info(
        `${chalk.bold.green(`👉 You may rerun these same checks with: \`curvenote check ${opts.venue} --kind ${kind.name}\``)}`,
      );
    }
    return prepareChecksForSubmission(session, opts.venue, kind);
  }
  session.log.warn('No venue provided, running basic submission checks');
  const allChecks = getCheckImplementations(session);
  return allChecks.map(({ id }) => ({ id }));
}

export async function check(session: ISession, venue: string | undefined, opts: CheckOpts) {
  const checks = await getChecks(session, { venue, ...opts });
  const implementations = getCheckImplementations(session);
  await build(session, [], { all: true, checkLinks: true });
  const report = await runChecks(session, checks, implementations);
  const checkLog = { input: {}, venue, kind: opts.kind ?? null, report };
  writeJsonLogs(session, 'curvenote.checks.json', checkLog);
  logCheckReport(session, report);
}
