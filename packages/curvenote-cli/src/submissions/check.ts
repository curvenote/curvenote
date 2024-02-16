import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';
import { logCheckReport, runChecks } from '../check/runner.js';
import { writeJsonLogs } from '../utils/utils.js';
import type { ISession } from '../session/types.js';
import { getFromJournals } from './utils.js';
import type { SubmissionKindsDTO } from '@curvenote/common';
import type { Check } from '@curvenote/check-definitions';
import { determineSubmissionKind } from './submit.utils.js';

//
// get checks
//
export async function getChecksForSubmission(
  session: ISession,
  venue: string,
  kind?: string,
): Promise<Check[]> {
  const kinds = (await getFromJournals(session, `sites/${venue}/kinds`)) as SubmissionKindsDTO;
  kind = await determineSubmissionKind(session, venue, { kind });
  const checks = !kind ? kinds.items[0].checks : kinds.items.find((k) => k.name === kind)?.checks;
  const numChecks = checks?.length ?? 0;
  if (numChecks === 0) {
    session.log.info(`✅ "${venue}" does not require checks for "${kind}"`);
  } else {
    session.log.info(`🚦 "${venue}" specifies ${checks?.length ?? 0} checks for "${kind}"`);
  }
  return checks ?? [];
}

type CheckOpts = {
  venue?: string;
  kind?: string;
};

function getCheckImplementations(session: ISession) {
  return [...submissionRuleChecks, ...(session.plugins?.checks ?? [])];
}

async function getChecks(session: ISession, opts: CheckOpts): Promise<Check[]> {
  if (opts.venue) {
    return await getChecksForSubmission(session, opts.venue, opts.kind);
  }
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
