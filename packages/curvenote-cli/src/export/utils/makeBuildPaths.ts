import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'myst-cli-utils';
import { BUILD_FOLDER } from '../../utils/index.js';
import type { TexExportOptionsExpanded } from '../tex/types.js';

export function makeBuildPaths(log: Logger, opts: TexExportOptionsExpanded) {
  const outputPath = path.dirname(opts.filename ?? '');
  const outputFilename = path.basename(opts.filename ?? '');
  const buildPath =
    opts.useBuildFolder ?? (opts.template || opts.templatePath)
      ? path.join(outputPath, BUILD_FOLDER)
      : outputPath;
  log.debug(`Output Path ${outputPath}`);
  log.debug(`Filename ${outputFilename}`);
  log.debug(`Build path set to ${buildPath}`);
  if (!fs.existsSync(buildPath)) {
    log.debug(`Creating build path ${buildPath}`);
    fs.mkdirSync(buildPath, { recursive: true });
  }
  return {
    buildPath,
    outputPath,
    outputFilename,
  };
}
