import { localArticleToWord } from 'myst-cli';
import { localExportWrapper } from '../utils/localExportWrapper.js';

export const oxaLinkToWord = localExportWrapper(localArticleToWord, {
  force: true,
  template: 'curvenote',
});
