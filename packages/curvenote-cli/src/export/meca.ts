import { localProjectToMeca } from 'myst-cli';
import { localExportWrapper } from './utils/localExportWrapper.js';

export const oxaLinkToMeca = localExportWrapper(localProjectToMeca, { force: true });
