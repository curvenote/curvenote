import type { BuildOpts } from 'myst-cli';
import { build, startServer, buildSite, watchContent } from 'myst-cli';
import { addTransformersToOpts } from '../utils/utils.js';
import type { ISession } from '../session/types.js';

type StartOpts = BuildOpts & { watchOnly?: boolean };

export const curvenoteBuild = async (session: ISession, files: string[], opts: BuildOpts) => {
  await build(session, files, addTransformersToOpts(session, opts));
};

export const curvenoteStart = async (session: ISession, opts: StartOpts) => {
  if (opts.watchOnly) {
    await session.reload();
    const optsWithTransformers = addTransformersToOpts(session, opts);
    await buildSite(session, optsWithTransformers);
    watchContent(session, () => {}, optsWithTransformers);
    session.log.info('\n🤖 Watching for changes (no server started). Press Ctrl+C to stop.\n');
    return;
  }
  await startServer(session, addTransformersToOpts(session, opts));
};

export * from './deploy.js';
