import type { ISession } from '../session/types.js';

export const siteCommandWrapper =
  (
    siteCommand: (session: ISession, opts: Record<string, any>) => Promise<any>,
    defaultOptions: Record<string, any>,
  ) =>
  async (session: ISession, opts: Record<string, any>) => {
    await siteCommand(session, { ...defaultOptions, ...opts });
  };
