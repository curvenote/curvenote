import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';
import { logCheckReport, runChecks } from '../check/runner.js';
import { writeJsonLogs } from '../utils/utils.js';
import type { ISession } from '../session/types.js';
import type { SubmissionKindDTO } from '@curvenote/common';
import type { Check } from '@curvenote/check-definitions';
import { listSubmissionKinds } from './submit.utils.js';

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
    const kinds = await listSubmissionKinds(session, opts.venue);
    const kind = opts.kind
      ? kinds.items.find((k) => k.name === opts.kind)
      : kinds.items.find((k) => k.default);
    if (!kind) throw new Error(`Could not find kind for "${opts.kind}"`);
    return prepareChecksForSubmission(session, opts.venue, kind);
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
