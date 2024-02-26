import { localArticleToTypst } from 'myst-cli';
import { localExportWrapper } from './utils/localExportWrapper.js';

export const oxaLinkToTypst = localExportWrapper(localArticleToTypst, { force: true });
