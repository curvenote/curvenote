import { Command } from 'commander';
import { logCheckReport, runChecks } from '../check/runner.js';
import type { ISession } from '../session/types.js';
import { clirun } from './utils.js';
import { abstractExists } from '../check/examples/abstractExists.js';

async function exampleChecks(session: ISession, file: string) {
  const report = await runChecks(session, file, [{ id: 'abstract-exists' }], [abstractExists]);
  logCheckReport(session, report);
}

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run some example checks on your MyST project')
    .argument('<file>', 'File to run checks on')
    .action(clirun(exampleChecks, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
