import { localArticleToWord } from 'myst-cli';
import { localExportWrapper } from '../utils/localExportWrapper';

export const oxaLinkToWord = localExportWrapper(localArticleToWord, {
  force: true,
  template: 'curvenote',
});
