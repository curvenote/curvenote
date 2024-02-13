import { Command, Option } from 'commander';
import { logCheckReport, runChecks, writeCheckReport } from '../check/runner.js';
import type { ISession } from '../session/types.js';
import { clirun } from './utils.js';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';

async function exampleChecks(session: ISession, opts?: { log?: boolean; logfile?: string }) {
  await build(session, [], { all: true, checkLinks: true });
  const checks = session.plugins?.checks?.length ? session.plugins.checks : submissionRuleChecks;
  const checkIds = checks.map(({ id }) => {
    return { id };
  });
  const report = await runChecks(session, checkIds, checks);
  if (opts?.log) {
    writeCheckReport(session, report, opts?.logfile);
  }
  logCheckReport(session, report);
}
export function makeLogfileOption() {
  return new Option(
    '--logfile <name>',
    'File to write check result logs; by default, a file will be written to the _build/temp directory',
  );
}

export function makeLogOption() {
  return new Option('--log', 'Write check results to file').default(true);
}

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run checks from plugins or example checks on your MyST project')
    .addOption(makeLogOption())
    .addOption(makeLogfileOption())
    .action(clirun(exampleChecks, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
