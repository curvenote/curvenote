import pLimit from 'p-limit';
import { checkLink, loadProjectFromDisk, selectFile, selectors } from 'myst-cli';
import type { GenericNode } from 'myst-common';
import { selectAll } from 'unist-util-select';
import { getCheckDefinition, CheckStatus } from '@curvenote/check-definitions';
import { doi } from 'doi-utils';
import type { CheckInterface } from '../types.js';
import { fail, pass } from '../utils.js';
import { otherDoiProviderResolves } from './doi.js';

const limitOutgoingConnections = pLimit(25);

const RULE_ID = 'links-resolve';
const RULE_ALIASES = ['link-resolves'];

export const linksResolve: CheckInterface = {
  ...getCheckDefinition(RULE_ID),
  validate: async (session) => {
    const { file } = await loadProjectFromDisk(session);
    const { mdast } = selectFile(session, file) ?? {};
    if (!mdast) {
      return { status: CheckStatus.error, message: `Error loading content from ${file}` };
    }
    const config = selectors.selectCurrentProjectConfig(session.store.getState());
    // pre-filter the exceptions if they exist.
    const error_rules = config?.error_rules?.filter((rule) => {
      return [RULE_ID, ...RULE_ALIASES].includes(rule.id);
    });
    const linkNodes = (selectAll('link,linkBlock,card', mdast) as GenericNode[]).filter(
      (link) => !(link.internal || link.static),
    );
    if (linkNodes.length === 0) return [];
    const linkResults = await Promise.all(
      linkNodes.map(async (node) =>
        limitOutgoingConnections(async () => {
          const check = await checkLink(session, node.url);
          const ignore = error_rules?.find(
            // The url needs to be explicitly included to ignore it
            (rule) => rule.key === node.url && rule.severity === 'ignore',
          );
          if (doi.normalize(node.url)) {
            const doiResolves =
              check.ok || (await otherDoiProviderResolves(session, doi.normalize(node.url)));
            const message = `${node.url} (${doiResolves ? 'Valid' : 'Invalid'} DOI)`;
            if (ignore) {
              const help = doiResolves
                ? `DOI "${node.url}" as link, not citation, ignored`
                : `Request to "${node.url}" failed (skipped)`;
              return fail(message, {
                file,
                position: node.position,
                help,
                optional: true,
              });
            }
            const help = doiResolves
              ? `DOI link "${node.url}" did not resolve to a citation`
              : `Check that "${node.url}" is correct`;
            return fail(message, {
              file,
              position: node.position,
              help,
            });
          }
          if (check.ok || check.skipped) {
            return pass(node.url, { file, position: node.position, nice: 'Links are valid 🔗' });
          }
          const status = check.status
            ? ` (${ignore ? 'Ignored: ' : ''}${check.status}, ${check.statusText})`
            : ignore
              ? '(Ignored)'
              : '';
          const help = ignore
            ? `Request to "${node.url}" failed (skipped)`
            : `Check that "${node.url}" is correct`;
          return fail(`${node.url}${status}`, {
            file,
            position: node.position,
            help,
            optional: !!ignore,
          });
        }),
      ),
    );
    return linkResults;
  },
};

export const linksRules = [linksResolve];
