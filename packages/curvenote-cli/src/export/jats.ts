import { localArticleToJats } from 'myst-cli';
import { localExportWrapper } from './utils/localExportWrapper.js';

export const oxaLinkToJats = localExportWrapper(localArticleToJats, { force: true });
