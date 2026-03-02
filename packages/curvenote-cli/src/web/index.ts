import type { BuildOpts } from 'myst-cli';
import { build, startServer } from 'myst-cli';
import { addTransformersToOpts } from '../utils/utils.js';
import type { ISession } from '../session/types.js';

export const curvenoteBuild = async (session: ISession, files: string[], opts: BuildOpts) => {
  await build(session, files, addTransformersToOpts(session, opts));
};

export const curvenoteStart = async (session: ISession, opts: BuildOpts) => {
  await startServer(session, addTransformersToOpts(session, opts));
};

export * from './deploy.js';
