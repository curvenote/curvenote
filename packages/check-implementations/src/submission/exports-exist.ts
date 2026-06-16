import fs from 'node:fs';
import path from 'node:path';
import { collectExportOptions, filterPages, loadProjectFromDisk } from 'myst-cli';
import { ExportFormats } from 'myst-frontmatter';
import { getCheckDefinition } from '@curvenote/check-definitions';
import type { CheckInterface } from '../types.js';
import { fail, pass } from '../utils.js';

export const exportsExist: CheckInterface = {
  ...getCheckDefinition('exports-exist'),
  validate: async (session) => {
    const project = await loadProjectFromDisk(session);
    const files = filterPages(project).map((page) => page.file);
    const exports = await collectExportOptions(session, files, Object.values(ExportFormats), {
      projectPath: project.path,
    });
    if (exports.length === 0) return [];
    return exports.map((exp) => {
      const { output, format, $file: file } = exp;
      const displayOutput = path.relative(process.cwd(), output) || output;
      if (fs.existsSync(output)) {
        return pass(`${displayOutput} (${format})`, {
          file,
          nice: `Export "${displayOutput}" exists 📦`,
        });
      }
      return fail(`Missing export: ${displayOutput} (${format})`, {
        file,
        help: 'Run "curvenote build --all" to build declared exports, or check your export configuration',
      });
    });
  },
};

export const exportsExistRules = [exportsExist];
