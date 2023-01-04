import type { ISession } from '../session/types';

export const siteCommandWrapper =
  (
    siteCommand: (session: ISession, opts: Record<string, any>) => Promise<void>,
    defaultOptions: Record<string, any>,
  ) =>
  async (session: ISession, opts: Record<string, any>) => {
    await siteCommand(session, { ...defaultOptions, ...opts });
  };
