import chalk from 'chalk';
import type { AppServer } from 'myst-cli';
import type { Logger } from 'myst-cli-utils';
import { LogLevel, chalkLogger, silentLogger } from 'myst-cli-utils';
import { sep } from 'node:path';

type SendJsonFn = AppServer['contentServer']['sendJson'];

/**
 * Builds a composite {@link Logger} that fans out each log call to both a
 * chalk-styled terminal logger and, optionally, a websocket logger.
 *
 * For every level (`debug`, `info`, `warn`, `error`), the returned logger:
 * - Short-circuits when the message is below the configured {@link LogLevel}.
 * - Delegates first to {@link chalkLogger} for terminal output.
 * - Delegates to {@link websocketLogger} when `sendJson` is provided, otherwise
 *   falls back to {@link silentLogger} so websocket calls are no-ops.
 *
 * @param level - Minimum {@link LogLevel} to emit; lower-severity messages are
 *                discarded before either underlying logger is invoked.
 * @param cwd - Optional working directory whose prefix is stripped from string
 *              arguments so logged paths are displayed relative to it.
 * @param sendJson - Optional transport for forwarding log envelopes over a
 *                   websocket (typically `AppServer.contentServer.sendJson`).
 *                   When omitted, only terminal logging is active.
 * @returns A {@link Logger} that multiplexes log output to the terminal and
 *          (when configured) to websocket clients.
 */
export function compositeLoggerFactory(
  level: LogLevel,
  cwd?: string,
  sendJson?: SendJsonFn,
): Logger {
  const logChalk = chalkLogger(level, cwd);
  const logWebsocket = sendJson ? websocketLogger(sendJson, level, cwd) : silentLogger();
  return {
    debug(...args: any) {
      if (level > LogLevel.debug) return;
      logChalk.debug(...args);
      logWebsocket.debug(...args);
    },
    info(...args: any) {
      if (level > LogLevel.info) return;
      logChalk.info(...args);
      logWebsocket.info(...args);
    },
    warn(...args: any) {
      if (level > LogLevel.warn) return;
      logChalk.warn(...args);
      logWebsocket.warn(...args);
    },
    error(...args: any) {
      if (level > LogLevel.error) return;
      logChalk.error(...args);
      logWebsocket.error(...args);
    },
  };
}

/**
 * Strips the current working directory prefix from string arguments passed to
 * the logger, producing paths that are relative to `cwd` instead of absolute.
 *
 * Non-string arguments are returned untouched. If `cwd` is undefined, the
 * original arguments are returned as-is.
 *
 * @param cwd - The absolute working directory to strip from string args. When
 *              provided, occurrences of `cwd + sep` are removed from each string.
 * @param args - The array of log arguments (mixed types) to normalize.
 * @returns A new array with `cwd` prefixes removed from any string entries.
 *
 * @example
 * replaceCwd('/Users/me/proj', ['/Users/me/proj/src/a.ts', 42]);
 * // => ['src/a.ts', 42]
 */
function replaceCwd(cwd: string | undefined, args: any[]): any[] {
  if (!cwd) return args;
  return args.map((a) => {
    if (typeof a === 'string') {
      return a.replaceAll(cwd + sep, '');
    }
    return a;
  });
}

/**
 * Creates a {@link Logger} that forwards log messages over a websocket by
 * emitting `LOG` envelopes through the provided `sendJson` function.
 *
 * Each log method:
 * - Respects the configured {@link LogLevel}, dropping messages below it.
 * - Normalizes arguments with {@link replaceCwd} so absolute paths are shown
 *   relative to `cwd`.
 * - Applies a chalk style per level (`dim` for debug, `reset` for info,
 *   `yellow` for warn, `red` for error) before sending the serialized message.
 *
 * The emitted payload shape is:
 * `{ type: 'LOG', level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string }`.
 *
 * @param sendJson - Transport function used to deliver JSON log envelopes to
 *                   connected websocket clients (typically
 *                   `AppServer.contentServer.sendJson`).
 * @param level - Minimum {@link LogLevel} to forward; lower-severity messages
 *                are ignored.
 * @param cwd - Optional working directory whose prefix is stripped from string
 *              arguments before formatting.
 * @returns A {@link Logger} whose `debug`, `info`, `warn`, and `error` methods
 *          publish styled log messages over the websocket.
 */
export function websocketLogger(sendJson: SendJsonFn, level: LogLevel, cwd?: string): Logger {
  return {
    debug(...args: any) {
      if (level > LogLevel.debug) return;
      sendJson({ type: 'LOG', level: 'DEBUG', message: chalk.dim(...replaceCwd(cwd, args)) });
    },
    info(...args: any) {
      if (level > LogLevel.info) return;
      sendJson({ type: 'LOG', level: 'INFO', message: chalk.reset(...replaceCwd(cwd, args)) });
    },
    warn(...args: any) {
      if (level > LogLevel.warn) return;
      sendJson({ type: 'LOG', level: 'WARN', message: chalk.yellow(...replaceCwd(cwd, args)) });
    },
    error(...args: any) {
      if (level > LogLevel.error) return;
      sendJson({ type: 'LOG', level: 'ERROR', message: chalk.red(...replaceCwd(cwd, args)) });
    },
  };
}
