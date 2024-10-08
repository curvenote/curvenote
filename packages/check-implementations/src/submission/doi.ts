import type { Check, CheckResult } from '@curvenote/check-definitions';
import { getCheckDefinition, CheckStatus } from '@curvenote/check-definitions';
import { doi } from 'doi-utils';
import { doiOrgResolves, getCitation, selectFile, selectors } from 'myst-cli';
import type { ISession, LocalProjectPage } from 'myst-cli';
import { plural } from 'myst-common';
import { VFile } from 'vfile';
import type { CheckInterface } from '../types.js';

const RULE_ID = 'doi-exists';
const RULE_ALIASES = ['dois-exist'];

/**
 * Assess if two citation JSON values match
 *
 * For now, this just compares title.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function citationsMatch(a?: Record<string, any>, b?: Record<string, any>) {
  if (a?.title && b?.title) return a?.title === b?.title;
  return false;
}

function ensurePrefix(citeDoi: string) {
  return citeDoi.startsWith('https://') ? citeDoi : `https://doi.org/${citeDoi}`;
}

export async function otherDoiProviderResolves(session: ISession, citeDoi?: string) {
  if (!citeDoi) return false;
  const openAlexUrl = `https://api.openalex.org/works/${ensurePrefix(citeDoi)}`;
  session.log.debug(`Resolving doi from OpenAlex: ${openAlexUrl}`);
  const openAlexResp = await session.fetch(openAlexUrl).catch(() => null);
  return !!openAlexResp?.ok;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function validateDoi(session: ISession, check: Check): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const state = session.store.getState();
  const projectPath = selectors.selectCurrentProjectPath(state);
  const config = selectors.selectCurrentProjectConfig(state);
  // pre-filter the exceptions if they exist.
  const error_rules = config?.error_rules?.filter((rule) => {
    return [RULE_ID, ...RULE_ALIASES].includes(rule.id);
  });
  const project = projectPath ? selectors.selectLocalProject(state, projectPath) : undefined;
  if (!project) {
    results.push({
      status: CheckStatus.error,
      message: 'DOI check failed - no project found',
    });
    return results;
  }
  const files = [
    project.file,
    ...project.pages
      .filter((page): page is LocalProjectPage => 'file' in page)
      .map((page) => page.file),
  ];
  session.log.debug(`Performing DOI check for ${plural('%s file(s)', files)}`);
  await Promise.all(
    files.map(async (file) => {
      const { references } = selectFile(session, file) ?? {};
      const doiLookup: Record<string, string> = {};
      references?.cite?.order.forEach((key) => {
        const citeDoi = references?.cite?.data[key].doi;
        if (!citeDoi) {
          const ignore = error_rules?.find(
            // The key needs to be explicitly included to ignore it
            (rule) => rule.key === key && rule.severity === 'ignore',
          );
          if (ignore) {
            results.push({
              status: CheckStatus.fail,
              message: `Citation without DOI explicitly ignored: ${key}`,
              help: `No DOI available for ${key} (skipped)`,
              optional: true,
            });
          } else {
            // Use openalex to try to find doi match
            results.push({
              status: CheckStatus.fail,
              message: `Citation does not have DOI: ${key}`,
              help: `Add a DOI for ${key} if it exists`,
            });
          }
        } else if (Object.keys(doiLookup).includes(citeDoi)) {
          results.push({
            status: CheckStatus.fail,
            message: `Two citations with duplicate DOIs: ${key} and ${doiLookup[citeDoi]}`,
            help: `Remove one of the duplicate citations: ${key} and ${doiLookup[citeDoi]}`,
            optional: true,
          });
        } else {
          doiLookup[citeDoi] = key;
        }
      });
      const vfile = new VFile();
      const checks = await Promise.all(
        Object.entries(doiLookup).map(([citeDoi, key]) =>
          session.doiLimiter(async () => {
            const citation = await getCitation(session, vfile, ensurePrefix(citeDoi), {
              type: 'cite',
            }).catch(() => null);
            let resolves = !!citation;
            if (!resolves) {
              resolves = await doiOrgResolves(session, ensurePrefix(citeDoi));
            }
            if (!resolves) {
              resolves = await otherDoiProviderResolves(session, ensurePrefix(citeDoi));
            }
            const normalized = doi.normalize(citeDoi);
            if (resolves) {
              return {
                status: CheckStatus.pass,
                message: `Citation has valid DOI: ${key}`,
                note: `Citation DOI: ${normalized}`,
                nice: 'citation valid 🔗',
              };
            }
            return {
              status: CheckStatus.fail,
              message: `DOI not found: ${ensurePrefix(citeDoi)} [${key}]`,
              help: `Check the citation DOI for ${key} (${ensurePrefix(citeDoi)}), it may not be correct`,
            };
          }),
        ),
      );
      // This way they are always in the same order!
      results.push(...checks);
      // also look at doi links
    }),
  );
  return results;
}

export const doiCheck: CheckInterface = {
  ...getCheckDefinition(RULE_ID),
  validate: validateDoi,
};

export const doiCheckRules = [doiCheck];
