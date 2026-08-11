import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import type { ISession } from '../session/types.js';

const REACT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

export function needsRendererBundle(sourcePath: string): boolean {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.tsx' || ext === '.jsx') return true;
  if (ext === '.ts' && !sourcePath.endsWith('.d.ts')) return true;
  return false;
}

/**
 * Bundle a TS/TSX/JSX renderer into ESM under `_build/renderers/`, with React
 * left external for the theme host import map.
 */
export async function bundleRendererSource(
  session: ISession,
  opts: { name: string; source: string },
): Promise<string> {
  const outDir = path.join(session.buildPath(), 'renderers');
  fs.mkdirSync(outDir, { recursive: true });
  const safeName = opts.name.replace(/[^a-zA-Z0-9_-]/g, '-');
  const outfile = path.join(outDir, `${safeName}.mjs`);

  try {
    await esbuild.build({
      entryPoints: [opts.source],
      outfile,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      bundle: true,
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      logLevel: 'silent',
      external: REACT_EXTERNALS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    session.log.error(`Failed to bundle renderer "${opts.name}" from ${opts.source}:\n${message}`);
    throw error;
  }

  session.log.info(`📦 Bundled renderer "${opts.name}" → ${path.relative(process.cwd(), outfile)}`);
  return outfile;
}
