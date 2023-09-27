import chalk from 'chalk';
import { build } from 'myst-cli';
import { incrementOptions } from 'simple-validators';
import type { ISession } from '../session/types.js';
import { CheckStatus } from './types.js';
import type {
  Check,
  CheckDefinition,
  CheckInterface,
  CheckReport,
  CheckResult,
  CompiledCheckResults,
} from './types.js';
import { validateCheck } from './validators.js';

export async function runChecks(
  session: ISession,
  checks: Check[],
  checkDefinitions: CheckInterface[],
): Promise<CompiledCheckResults> {
  const opts = { property: 'checks', messages: {} };
  await build(session, [], { all: true, checkLinks: true });
  const completedChecks = await Promise.all(
    checks.map(async (check, index) => {
      const validCheck = validateCheck(
        session,
        check,
        checkDefinitions,
        incrementOptions(`${index}`, opts),
      );
      if (!validCheck) return undefined;
      const checkDefinition = checkDefinitions.find((def) => check.id === def.id);
      let result = await checkDefinition?.validate(session, validCheck);
      if (!result) return;
      if (!Array.isArray(result)) result = [result];
      return result.map((res) => {
        return { ...checkDefinition, ...res };
      });
    }),
  );
  return completedChecks.flat().filter((check): check is CheckDefinition & CheckResult => !!check);
}

export function sortCheckResults(completedChecks: CompiledCheckResults) {
  let finalStatus = CheckStatus.pass;
  const checkCategories: Record<string, CheckReport['results'][0]> = {};
  completedChecks.forEach((check) => {
    const { category, status } = check;
    if (!checkCategories[category]) {
      checkCategories[category] = {
        category,
        status,
        checks: [check],
      };
    } else {
      checkCategories[category].checks.push(check);
    }
    if (status !== CheckStatus.pass) {
      checkCategories[category].status = CheckStatus.fail;
      finalStatus = CheckStatus.fail;
    }
  });
  return { status: finalStatus, results: Object.values(checkCategories) };
}

export function logCheckReport(session: ISession, completedChecks: CompiledCheckResults) {
  const report = sortCheckResults(completedChecks);
  const checkFail = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.red(`${prefix ?? ''}${icon ? '❌' : ''} ${msg}`);
  };
  const checkError = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.yellow(`${prefix ?? ''}${icon ? '⚠️' : ''}  ${msg}`);
  };
  const checkPass = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.green(`${prefix ?? ''}${icon ? '✅' : ''} ${msg}`);
  };
  if (report.status === CheckStatus.pass) {
    session.log.info(chalk.bold(checkPass('All checks passed:')));
  } else {
    session.log.error(chalk.bold(checkFail('Failed checks:')));
  }
  report.results.forEach((result) => {
    const { status, category, checks } = result;
    if (status === CheckStatus.pass) {
      session.log.info(
        checkPass(
          `${chalk.bold(category)} (${checks.length}/${checks.length} tests passed)`,
          true,
          '  ',
        ),
      );
    } else {
      session.log.error(
        checkFail(
          `${chalk.bold(category)} (${checks.filter((c) => c.status === CheckStatus.pass).length}/${
            checks.length
          } tests passed)`,
          false,
          '    ',
        ),
      );
    }
    checks.forEach((check) => {
      const { message, file, position } = check;
      const fileSuffix = file ? ` - ${file}` : '';
      const line = file && position?.start.line ? `:${position.start.line}` : '';
      const column =
        file && line && position?.start.column && position?.start.column > 1
          ? `:${position.start.column}`
          : '';
      const messageWithTitle = `${chalk.bold(
        check.title,
      )}: ${message}${fileSuffix}${line}${column}`;
      if (check.status === CheckStatus.pass) {
        session.log.debug(checkPass(messageWithTitle, true, '        '));
      } else if (check.status === CheckStatus.error) {
        session.log.error(checkError(messageWithTitle, true, '        '));
      } else {
        session.log.error(checkFail(messageWithTitle, true, '        '));
      }
    });
  });
}
