import { localArticleToTex } from 'myst-cli';
import { localExportWrapper } from '../utils/localExportWrapper';

export { multipleArticleToTex } from './multiple';

export const oxaLinkToTex = localExportWrapper(localArticleToTex, { force: true });
