import { credit } from 'credit-roles';
import type { CheckInterface } from '../types.js';
import { getCheckDefinition } from '@curvenote/check-definitions';
import { pass, fail, error } from '../utils.js';
import { getFrontmatter } from './utils.js';

export const authorsDefined: CheckInterface = {
  ...getCheckDefinition('authors-exist'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'authors');
    const authors = config?.authors ?? [];
    if (authors.length === 0) {
      return fail('No authors found', { file, help: 'Add authors to your project' });
    }
    return pass(`Found ${authors.length} authors`, { file, nice: 'Authors found 👋' });
  },
};

export const correspondingAuthor: CheckInterface = {
  ...getCheckDefinition('authors-corresponding'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'authors');
    const authors = config?.authors ?? [];
    const help = 'Add an email to one of the authors';
    if (authors.length === 0) {
      return error('No authors found', { file, cause: authorsDefined.id, help });
    }
    const authorsWithEmails = authors.filter((a) => !!a.email);
    if (authorsWithEmails.length === 0) {
      return fail('No authors provided an email', {
        file,
        help,
        note: `There were ${authors.length} authors found, none of them had emails`,
      });
    }
    return authorsWithEmails.map(({ name, email }) =>
      pass(`${name} provided an email: <${email}>`, {
        file,
        nice: 'Corresponding author is set 📧',
      }),
    );
  },
};

export const authorsHaveAffiliations: CheckInterface = {
  ...getCheckDefinition('authors-have-affiliations'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'authors');
    const authors = config?.authors ?? [];
    const help = 'Add an affiliation to each author';
    if (authors.length === 0) {
      return error('No authors found', { file, cause: authorsDefined.id, help });
    }
    return authors.map(({ name, affiliations }) =>
      affiliations && affiliations.length > 0
        ? pass(`${name} has an affiliation`, { file, nice: 'All authors have affiliations 🏫' })
        : fail(`${name} does not have an affiliation`, {
            file,
            help,
          }),
    );
  },
};

export const authorsHaveOrcid: CheckInterface = {
  ...getCheckDefinition('authors-have-orcid'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'authors');
    const authors = config?.authors ?? [];
    const help = 'Add an ORCID to each author';
    if (authors.length === 0) {
      return error('No authors found', { file, cause: authorsDefined.id, help });
    }
    return authors.map(({ name, orcid }) =>
      orcid
        ? pass(`${name} has an ORCID`, {
            file,
            nice: 'Thanks for adding ORCIDs, robots love orchids 🤖💚🌸',
          })
        : fail(`${name} does not have an ORCID`, { file, help }),
    );
  },
};

export const authorsHaveCreditRoles: CheckInterface = {
  ...getCheckDefinition('authors-have-credit-roles'),
  validate: async (session) => {
    const { file, config } = await getFrontmatter(session, 'authors');
    const authors = config?.authors ?? [];
    const help = 'Add CRediT roles to each author';
    if (authors.length === 0) {
      return error('No authors found', { file, cause: authorsDefined.id, help });
    }
    return authors
      .map(({ name, roles }) => {
        if (!roles || roles.length === 0) {
          return fail(`${name} does not have any CRediT Roles`, {
            file,
            help,
          });
        }
        return roles.map((role) =>
          credit.validate(role)
            ? pass(`${name} has valid CRediT role of "${role}"`, {
                file,
                nice: 'All CRediT roles look good 🥳',
              })
            : fail(`${name} has an invalid CRediT role of "${role}"`, {
                file,
                help: `Change the role "${role}" to a valid CRediT role`,
              }),
        );
      })
      .flat();
  },
};

export const authorRules = [
  authorsDefined,
  correspondingAuthor,
  authorsHaveAffiliations,
  authorsHaveOrcid,
  authorsHaveCreditRoles,
];
