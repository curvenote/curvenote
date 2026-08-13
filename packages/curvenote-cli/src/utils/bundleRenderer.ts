import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Metafile } from 'esbuild';
import type { ISession } from '../session/types.js';

const REACT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

export type RendererBundleResult = {
  outfile: string;
  /** Absolute paths of files that contributed to the bundle (entry + imports). */
  inputs: string[];
};

type BundleSidecar = {
  hash: string;
  inputs: string[];
};

/** Minimal esbuild surface used for renderer bundling (loaded lazily at runtime). */
type EsbuildModule = {
  build: (options: Record<string, unknown>) => Promise<{ metafile?: Metafile }>;
};

/** Cached esbuild module, or false after a failed load (do not retry this process). */
let esbuildModule: EsbuildModule | false | undefined;

export function needsRendererBundle(sourcePath: string): boolean {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.tsx' || ext === '.jsx') return true;
  if (ext === '.ts' && !sourcePath.endsWith('.d.ts')) return true;
  return false;
}

function hashSidecarPath(outfile: string): string {
  return `${outfile}.hash`;
}

function hashFileContents(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

/** Content hash over a sorted list of absolute input paths. */
export function hashRendererInputs(inputPaths: string[]): string {
  const hash = createHash('sha256');
  for (const inputPath of [...inputPaths].sort()) {
    hash.update(inputPath);
    hash.update('\0');
    hash.update(hashFileContents(inputPath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function readBundleSidecar(outfile: string): BundleSidecar | undefined {
  const sidecar = hashSidecarPath(outfile);
  if (!fs.existsSync(sidecar)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf-8')) as BundleSidecar;
    if (typeof parsed?.hash !== 'string' || !Array.isArray(parsed.inputs)) return undefined;
    return {
      hash: parsed.hash,
      inputs: parsed.inputs.filter((p): p is string => typeof p === 'string'),
    };
  } catch {
    return undefined;
  }
}

function writeBundleSidecar(outfile: string, sidecar: BundleSidecar): void {
  fs.writeFileSync(hashSidecarPath(outfile), `${JSON.stringify(sidecar)}\n`);
}

/**
 * True when outfile exists and every previously recorded input still hashes to
 * the sidecar digest (covers transitive imports, not just the entry file).
 */
export function isRendererBundleFresh(outfile: string): boolean {
  if (!fs.existsSync(outfile)) return false;
  const sidecar = readBundleSidecar(outfile);
  if (!sidecar?.inputs.length) return false;
  for (const inputPath of sidecar.inputs) {
    if (!fs.existsSync(inputPath)) return false;
  }
  return hashRendererInputs(sidecar.inputs) === sidecar.hash;
}

/** Inputs recorded for a prior successful bundle, if any. */
export function readRendererBundleInputs(outfile: string): string[] {
  return readBundleSidecar(outfile)?.inputs ?? [];
}

/**
 * Load esbuild only when a TS/TSX/JSX renderer must be bundled.
 * Returns undefined after a failed load (soft-fail; caller should skip bundling).
 */
export async function loadEsbuild(session: ISession): Promise<EsbuildModule | undefined> {
  if (esbuildModule === false) return undefined;
  if (esbuildModule) return esbuildModule;
  try {
    esbuildModule = (await import('esbuild')) as EsbuildModule;
    return esbuildModule;
  } catch (error) {
    esbuildModule = false;
    const message = error instanceof Error ? error.message : String(error);
    session.log.error(
      `esbuild is required to bundle TS/TSX/JSX site renderers but could not be loaded.\n` +
        `${message}\n` +
        `Site build/start will continue, but TypeScript renderer bundles will be skipped. ` +
        `Reinstall the curvenote CLI (or ensure the platform-specific @esbuild/* package installed) to fix this.`,
    );
    return undefined;
  }
}

/** Test helper: reset the lazy esbuild cache. */
export function resetEsbuildLoaderForTests(): void {
  esbuildModule = undefined;
}

function collectMetafileInputs(metafile: Metafile | undefined, entrySource: string): string[] {
  const inputs = new Set<string>([path.resolve(entrySource)]);
  if (metafile?.inputs) {
    for (const inputPath of Object.keys(metafile.inputs)) {
      // Skip esbuild virtual inputs (e.g. "<stdin>", data: URLs).
      if (inputPath.startsWith('<')) continue;
      const absolute = path.resolve(inputPath);
      try {
        if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
          inputs.add(absolute);
        }
      } catch {
        // Ignore unreadable metafile entries.
      }
    }
  }
  return [...inputs];
}

/**
 * Bundle a TS/TSX/JSX renderer into ESM under `_build/renderers/`, with React
 * left external for the theme host import map. Skips esbuild when the full
 * input graph hash matches the previous build (avoids config-watch self-rebundles
 * while still invalidating on transitive import changes).
 */
export async function bundleRendererSource(
  session: ISession,
  opts: { name: string; source: string },
): Promise<RendererBundleResult | undefined> {
  const outDir = path.join(session.buildPath(), 'renderers');
  fs.mkdirSync(outDir, { recursive: true });
  const safeName = opts.name.replace(/[^a-zA-Z0-9_-]/g, '-');
  const outfile = path.join(outDir, `${safeName}.mjs`);

  if (isRendererBundleFresh(outfile)) {
    session.log.debug(`♻️ Skipping unchanged renderer bundle "${opts.name}"`);
    return { outfile, inputs: readRendererBundleInputs(outfile) };
  }

  const esbuild = await loadEsbuild(session);
  if (!esbuild) {
    session.log.error(
      `Skipping renderer bundle "${opts.name}" (${opts.source}): esbuild unavailable.`,
    );
    return undefined;
  }

  try {
    const result = await esbuild.build({
      entryPoints: [opts.source],
      outfile,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      bundle: true,
      metafile: true,
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      logLevel: 'silent',
      external: REACT_EXTERNALS,
    });
    const inputs = collectMetafileInputs(result.metafile, opts.source);
    writeBundleSidecar(outfile, { hash: hashRendererInputs(inputs), inputs });
    session.log.info(
      `📦 Bundled renderer "${opts.name}" → ${path.relative(process.cwd(), outfile)}`,
    );
    return { outfile, inputs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    session.log.error(
      `Failed to bundle renderer "${opts.name}" from ${opts.source}:\n${message}\n` +
        `Continuing without this renderer.`,
    );
    return undefined;
  }
}
