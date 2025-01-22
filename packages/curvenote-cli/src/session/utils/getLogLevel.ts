import { LogLevel } from 'myst-cli-utils';

/**
 * Duplicated from myst-cli-utils, where function is not exported
 */
export function getLogLevel(level: LogLevel | boolean | string = LogLevel.info): LogLevel {
  if (typeof level === 'number') return level;
  const useLevel: LogLevel = level ? LogLevel.debug : LogLevel.info;
  return useLevel;
}
