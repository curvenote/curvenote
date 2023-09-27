import { Command } from 'commander';
import { logCheckReport, runChecks } from '../check/runner.js';
import type { ISession } from '../session/types.js';
import { clirun } from './utils.js';
import { abstractExists } from '../check/examples/abstractExists.js';
import { abstractLength } from '../check/examples/abstractLength.js';
import { availabilityExists } from '../check/examples/availabilityExists.js';
import { linksResolve } from '../check/examples/linksResolve.js';

async function exampleChecks(session: ISession) {
  const report = await runChecks(
    session,
    [
      { id: 'abstract-exists' },
      { id: 'abstract-length', max: '400' },
      { id: 'availability-exists' },
      { id: 'links-resolve' },
    ],
    [abstractExists, abstractLength, availabilityExists, linksResolve],
  );
  logCheckReport(session, report);
}

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run some example checks on your MyST project')
    .action(clirun(exampleChecks, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
