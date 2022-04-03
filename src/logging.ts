import chalk from 'chalk';

export enum LogLevel {
  fatal = 60,
  error = 50,
  warn = 40,
  info = 30,
  debug = 20,
  trace = 10,
}

export type Logger = Pick<typeof console, 'debug' | 'info' | 'warn' | 'error'>;

export function getLevel(logger: Logger, level: LogLevel): Logger['info'] {
  switch (level) {
    case LogLevel.trace:
    case LogLevel.debug:
      return logger.debug;
    case LogLevel.info:
      return logger.info;
    case LogLevel.warn:
      return logger.warn;
    case LogLevel.error:
    case LogLevel.fatal:
      return logger.error;
    default:
      throw new Error(`Level "${level}" not defined.`);
  }
}

export function basicLogger(level: LogLevel): Logger {
  const { log } = console;
  return {
    debug(...args: any) {
      if (level > LogLevel.debug) return;
      log(...args);
    },
    info(...args: any) {
      if (level > LogLevel.info) return;
      log(...args);
    },
    warn(...args: any) {
      if (level > LogLevel.warn) return;
      log(...args);
    },
    error(...args: any) {
      if (level > LogLevel.error) return;
      log(...args);
    },
  };
}

export function chalkLogger(level: LogLevel): Logger {
  const { log } = console;
  return {
    debug(...args: any) {
      if (level > LogLevel.debug) return;
      log(chalk.dim(...args));
    },
    info(...args: any) {
      if (level > LogLevel.info) return;
      log(chalk.reset(...args));
    },
    warn(...args: any) {
      if (level > LogLevel.warn) return;
      log(chalk.yellow(...args));
    },
    error(...args: any) {
      if (level > LogLevel.error) return;
      log(chalk.red(...args));
    },
  };
}
