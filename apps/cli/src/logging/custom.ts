import chalk from 'chalk';
import { ISession } from '../session/types';
import { Logger } from './index';

type LoggerDE = Pick<Logger, 'debug' | 'error'>;

export function getGitLogger(session: ISession): LoggerDE {
  const logger = {
    debug(data: string) {
      const line = data.trim();
      if (!line) return;
      session.log.debug(data);
    },
    error(data: string) {
      const line = data.trim();
      if (!line) return;
      if (line.startsWith('Cloning into') || line.startsWith('Submodule')) {
        session.log.debug(line);
        return;
      }
      session.log.error(data);
    },
  };
  return logger;
}

export function getNpmLogger(session: ISession): LoggerDE {
  const logger = {
    debug(data: string) {
      const line = data.trim();
      if (!line) return;
      session.log.debug(data);
    },
    error(data: string) {
      const line = data.trim();
      if (!line) return;
      if (line.includes('deprecated') || line === 'npm' || line.includes('WARN')) {
        session.log.debug(line);
        return;
      }
      session.log.error(data);
    },
  };
  return logger;
}

export function getServerLogger(session: ISession): LoggerDE {
  const logger = {
    debug(data: string) {
      const line = data.trim();
      if (!line || line.startsWith('>') || line.startsWith('Watching')) return;
      if (line.includes('File changed: app/content')) return; // This is shown elsewhere
      if (line.includes('started at http://')) {
        const [, ipAndPort] = line.split('http://');
        const port = ipAndPort.split(':')[1].replace(/[^0-9]/g, '');
        const local = `http://localhost:${port}`;
        session.log.info(
          `\nš Server started on port ${port}!š„³ š\n\n\n\tš  ${chalk.green(local)}  š\n\n`,
        );
        return;
      }
      session.log.info(
        line
          .replace(/šæ/g, 'š')
          .replace(/(GET) /, 'š $1  ')
          .replace(/(POST) /, 'š¦ $1 '),
      );
    },
    error(data: string) {
      const line = data.trim();
      if (!line) return;
      // This is a spurious Remix warning https://github.com/remix-run/remix/issues/2677
      if (line.includes('is not listed in your package.json dependencies')) return;
      if (line.startsWith('Done in')) {
        session.log.info(`ā”ļø ${line.replace('Done', 'Compiled')}`);
        return;
      }
      session.log.error(data);
    },
  };
  return logger;
}
