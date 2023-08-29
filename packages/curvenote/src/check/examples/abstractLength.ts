import path from 'node:path';
import { selectFile } from 'myst-cli';
import { TemplateOptionType, copyNode, extractPart, toText } from 'myst-common';
import { count } from '@wordpress/wordcount';
import type { ISession } from '../../session/types.js';
import { CheckStatus } from '../types.js';
import type { Check, CheckInterface } from '../types.js';

export const abstractLength: CheckInterface = {
  id: 'abstract-length',
  title: 'Abstract Length',
  description: 'Ensure abstract in MyST project is the correct length',
  category: 'abstract',
  options: [
    {
      id: 'max',
      title: 'Maximum word count for abstract',
      required: true,
      type: TemplateOptionType.string,
    },
  ],
  validate: async (session: ISession, file: string, options: Check) => {
    const { mdast } = selectFile(session, path.resolve(file)) ?? {};
    if (!mdast) {
      return { status: CheckStatus.error, message: `Error loading content`, file };
    }
    const abstract = extractPart(copyNode(mdast), 'abstract');
    if (!abstract) {
      return { status: CheckStatus.error, message: `No abstract found`, file };
    }
    const length = count(toText(abstract), 'words', {});
    if (length > +options.max) {
      return {
        status: CheckStatus.fail,
        message: `Abstract is too long: ${length}/${options.max} words`,
        file,
        position: abstract.position,
      };
    }
    return {
      status: CheckStatus.pass,
      message: `Abstract is correct length: ${length}/${options.max} words`,
      file,
      position: abstract.position,
    };
  },
};
