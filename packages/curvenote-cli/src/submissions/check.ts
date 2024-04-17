import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';
import { logCheckReport, runChecks } from '../check/runner.js';
import { writeJsonLogs } from '../utils/utils.js';
import type { ISession } from '../session/types.js';
import type { SubmissionKindDTO } from '@curvenote/common';
import type { Check } from '@curvenote/check-definitions';
import { checkVenueAccess, checkVenueExists, determineCollectionAndKind } from './submit.utils.js';

//
// get checks
//
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

function getCheckImplementations(session: ISession) {
  return [...submissionRuleChecks, ...(session.plugins?.checks ?? [])];
}

async function getChecks(session: ISession, opts: CheckOpts): Promise<Check[]> {
  if (opts.venue) {
    await checkVenueExists(session, opts.venue);
    const collections = await checkVenueAccess(session, opts.venue);
    const { kind } = await determineCollectionAndKind(session, opts.venue, collections, {
      ...opts,
      allowClosedCollection: true,
    });
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
