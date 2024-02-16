import { localArticleToTex } from 'myst-cli';
import { localExportWrapper } from '../utils/localExportWrapper.js';

export { multipleArticleToTex } from './multiple.js';

export const oxaLinkToTex = localExportWrapper(localArticleToTex, { force: true });
