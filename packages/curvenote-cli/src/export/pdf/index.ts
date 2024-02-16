import { localArticleToPdf } from 'myst-cli';
import { localExportWrapper } from '../utils/localExportWrapper.js';

export { multipleArticleToPdf } from './multiple.js';
export { buildPdfOnly } from './build.js';

export const oxaLinkToPdf = localExportWrapper(localArticleToPdf, { force: true });
