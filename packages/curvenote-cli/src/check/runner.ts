import chalk from 'chalk';
import { incrementOptions } from 'simple-validators';
import type { ISession } from '../session/types.js';
import type { CheckReport, CompiledCheckResults } from './types.js';
import { validateCheck, type CheckInterface } from '@curvenote/check-implementations';
import {
  type CheckResult,
  type Check,
  type CheckDefinition,
  CheckStatus,
} from '@curvenote/check-definitions';

export async function runChecks(
  session: ISession,
  checks: Check[],
  implementations: CheckInterface[],
): Promise<CompiledCheckResults> {
  const opts = { property: 'checks', messages: {} };
  const completedChecks = await Promise.all(
    checks.map(async (check, index) => {
      const validCheck = validateCheck(
        session,
        check,
        implementations,
        incrementOptions(`${index}`, opts),
      );
      if (!validCheck) {
        // Validates the journal options against the check definition
        // TODO! - send this as an error back anyways
        console.error(`Check with ID: ${check.id} was not found or is invalid`);
        console.log(opts.messages);
        return undefined;
      }
      const { validate, ...def } = implementations.find(({ id }) => check.id === id) ?? {};
      if (!validate) {
        // TODO! - send this as an error back anyways
        console.error(`Check with ID: ${check.id} did not have a validate function`);
        return undefined;
      }
      const result = await validate(session, validCheck);
      if (!result) return;
      const allResults = Array.isArray(result) ? result : [result];
      return allResults.map((res) => {
        return {
          ...def, // The unopinionated check (has id, title, description, etc.)
          ...check, // The "journal" can override the category, description, source, example, etc.
          ...res, // The specific results adds "status" (pass, fail, error), a message/note/file/position, and may also add "optional"
        };
      });
    }),
  );
  // TODO: clean the messages and make file links relative in the file, message, note fields.
  return completedChecks.flat().filter((check): check is CheckDefinition & CheckResult => !!check);
}

export function sortCheckResults(completedChecks: CompiledCheckResults) {
  let finalStatus = CheckStatus.pass;
  const checkCategories: Record<string, CheckReport['results'][0]> = {};
  completedChecks.forEach((check) => {
    const { tags, status, optional } = check;
    const tag = tags[0];
    if (!checkCategories[tag]) {
      checkCategories[tag] = {
        category: tag,
        status,
        checks: [check],
      };
    } else {
      checkCategories[tag].checks.push(check);
    }
    if (status !== CheckStatus.pass && optional !== true) {
      checkCategories[tag].status = CheckStatus.fail;
      finalStatus = CheckStatus.fail;
    }
  });
  return { status: finalStatus, results: Object.values(checkCategories) };
}

export function logCheckReport(
  session: ISession,
  completedChecks: CompiledCheckResults,
  exitOnFailure = true,
) {
  const report = sortCheckResults(completedChecks);
  const checkFail = (msg: string, icon?: boolean, prefix?: string, optional?: boolean) => {
    return chalk[optional ? 'yellow' : 'red'](
      `${prefix ?? ''}${icon ? (optional ? '↓' : '×') : ''} ${msg}`,
    );
  };
  const checkError = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.yellow(`${prefix ?? ''}${icon ? '↓' : ''} ${msg}`);
  };
  const checkPass = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.green(`${prefix ?? ''}${icon ? '✓' : ''} ${msg}`);
  };
  session.log.info(`\n\n${chalk.bold.bgBlueBright(' Curvenote Checks ')} ✓✓✓ 🚀\n`);
  report.results.forEach((result) => {
    const { status, category, checks } = result;
    const numPassed = checks.filter((c) => c.status === CheckStatus.pass).length;
    const numOptional = checks.filter((c) => c.status !== CheckStatus.pass && c.optional).length;
    if (status === CheckStatus.pass && numPassed === checks.length) {
      session.log.info(
        checkPass(`❯ ${chalk.bold(category)} (${numPassed}/${checks.length} tests passed)`, false),
      );
    } else if (status === CheckStatus.pass) {
      session.log.info(
        checkFail(
          `❯ ${chalk.bold(category)} (${numPassed}/${checks.length} tests passed, ${numOptional} optional)`,
          false,
          '',
          true,
        ),
      );
    } else {
      session.log.error(
        checkFail(
          `❯ ${chalk.bold(category)} (${numPassed}/${checks.length} tests passed${numOptional > 0 ? `, ${numOptional} optional` : ''})`,
          false,
        ),
      );
    }
    checks.forEach((check) => {
      const { message, file, position, optional } = check;
      const line = file && position?.start.line ? `:${position.start.line}` : '';
      const column =
        file && line && position?.start.column && position?.start.column > 1
          ? `:${position.start.column}`
          : '';
      const fileSuffix = file ? `(${file}${line}${column})` : '';
      const messageWithTitle = [
        `${chalk.bold(check.title)}${message ? ':' : ''}`,
        message ?? '',
        fileSuffix,
      ]
        .filter((m) => !!m)
        .join(' ');
      if (check.status === CheckStatus.pass) {
        session.log.info(checkPass(messageWithTitle, true, '    '));
      } else if (check.status === CheckStatus.error) {
        session.log.error(checkError(messageWithTitle, true, '    '));
      } else {
        session.log.error(checkFail(messageWithTitle, true, '    ', optional));
      }
    });
  });
  if (report.status !== CheckStatus.pass && exitOnFailure) process.exit(1);
}
