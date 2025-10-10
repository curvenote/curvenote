import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadProjectFromDisk, selectors, writeConfigs } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { Contributor } from 'myst-frontmatter';
import type { ISession } from '../../session/types.js';
import { isORCID, isGitHubUsername, lookupAuthor } from './author-lookup.js';
import { cleanProjectConfigForWrite } from '../utils.js';

// ============================================================================
// PROJECT MODIFICATION HANDLERS
// These functions operate on EXISTING projects (require projectConfig)
// Add new project modification operations here
// ============================================================================

/**
 * Helper to validate that a project config exists
 * Used by project modification operations
 */
export function validateExistingProject(session: ISession, currentPath: string): ProjectConfig {
  const projectConfig = selectors.selectCurrentProjectConfig(session.store.getState());
  if (!projectConfig) {
    throw Error(
      `No project config found at ${currentPath}. Run ${chalk.bold('curvenote init')} first.`,
    );
  }
  return projectConfig;
}

/**
 * Handle --write-toc option: Generate table of contents for existing project
 */
export async function handleWriteTOC(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  if (projectConfig.toc) {
    session.log.warn('Not writing the table of contents, it already exists!');
    return;
  }
  await loadProjectFromDisk(session, currentPath, { writeTOC: true });
}

// ============================================================================
// AUTHOR MANAGEMENT HELPERS
// ============================================================================

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Parse author string: "Name; Affiliation; Email"
 * Affiliation can be "null" to skip
 */
function parseAuthorString(authorStr: string): Partial<Contributor> {
  const parts = authorStr.split(';').map((p) => p.trim());
  const name = parts[0];
  const affiliation = parts[1] && parts[1].toLowerCase() !== 'null' ? parts[1] : undefined;
  const email = parts[2] || undefined;

  return {
    name,
    affiliations: affiliation ? [affiliation] : undefined,
    email,
    corresponding: !!email,
  };
}

/**
 * Match or add affiliations to the project
 * Does case-insensitive matching against existing affiliations
 */
function matchOrAddAffiliations(
  projectConfig: ProjectConfig,
  author: Partial<Contributor>,
): string[] | undefined {
  if (!author.affiliations || author.affiliations.length === 0) {
    return undefined;
  }

  // Get existing affiliations from project config
  const existingAffiliations = (projectConfig.affiliations as any[]) || [];

  const matchedAffiliations: string[] = [];

  for (const newAffiliation of author.affiliations) {
    // Try to find a case-insensitive match
    const matchedExisting = existingAffiliations.find((existing) => {
      const existingName = existing.name || existing.id || '';
      return existingName.toLowerCase() === newAffiliation.toLowerCase();
    });

    if (matchedExisting) {
      // Use the ID of the existing affiliation
      const affiliationId = matchedExisting.id || matchedExisting.name;
      matchedAffiliations.push(affiliationId);
    } else {
      // No match found - add as new affiliation
      // Use the affiliation string as-is (will be created by MyST)
      matchedAffiliations.push(newAffiliation);
    }
  }

  return matchedAffiliations.length > 0 ? matchedAffiliations : undefined;
}

/**
 * Interactive prompt for adding an author
 */
async function promptForAuthor(session: ISession): Promise<Contributor | null> {
  const identifierPrompt = await inquirer.prompt([
    {
      name: 'identifier',
      message: 'Enter ORCID or GitHub username (or leave blank to enter manually):',
      type: 'input',
      validate: (input: string) => {
        if (!input) return true;
        const trimmed = input.trim();
        // Check if it's a valid ORCID or GitHub username
        if (isORCID(trimmed) || isGitHubUsername(trimmed)) {
          return true;
        }
        return 'Invalid format. Please enter an ORCID ID (xxxx-xxxx-xxxx-xxxx) or a GitHub username';
      },
    },
  ]);

  if (identifierPrompt.identifier) {
    const author = await lookupAuthor(session, identifierPrompt.identifier);
    if (author) {
      session.log.info(`\n${chalk.bold('Found author information:')}`);
      session.log.info(`  Name: ${author.name}`);
      if (author.orcid) session.log.info(`  ORCID: ${author.orcid}`);
      if (author.github) session.log.info(`  GitHub: ${author.github}`);
      if (author.email) session.log.info(`  Email: ${author.email}`);
      if (author.affiliations?.length) {
        session.log.info(`  Affiliations: ${author.affiliations.join(', ')}`);
      }

      const confirm = await inquirer.prompt([
        {
          name: 'confirm',
          message: 'Add this author?',
          type: 'confirm',
          default: true,
        },
      ]);

      if (confirm.confirm) {
        return author as Contributor;
      }
    }
  }

  // Manual entry
  const manualPrompt = await inquirer.prompt([
    {
      name: 'name',
      message: 'Author name:',
      type: 'input',
      validate: (input: string) => !!input.trim() || 'Name is required',
    },
    {
      name: 'affiliation',
      message: 'Affiliation (optional):',
      type: 'input',
    },
    {
      name: 'email',
      message: 'Email (optional):',
      type: 'input',
      validate: (input: string) => {
        if (!input) return true;
        return validateEmail(input) || 'Invalid email format';
      },
    },
  ]);

  return {
    name: manualPrompt.name,
    affiliations: manualPrompt.affiliation ? [manualPrompt.affiliation] : undefined,
    email: manualPrompt.email || undefined,
    corresponding: !!manualPrompt.email,
  };
}

/**
 * Handle --add-authors option: Add authors to existing project
 */
export async function handleAddAuthors(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
  authorsInput?: string,
): Promise<void> {
  const newAuthors: Contributor[] = [];

  if (!authorsInput || authorsInput === 'true') {
    // Pattern 1: Interactive flow
    session.log.info(chalk.bold('\n📝 Adding authors interactively...\n'));

    let addMore = true;
    while (addMore) {
      const author = await promptForAuthor(session);
      if (author) {
        newAuthors.push(author as Contributor);
      }

      const continuePrompt = await inquirer.prompt([
        {
          name: 'addMore',
          message: 'Add another author?',
          type: 'confirm',
          default: false,
        },
      ]);
      addMore = continuePrompt.addMore;
    }
  } else {
    // Check if this is pattern 2 (ORCID/GitHub lookup) or pattern 3 (name-based)
    const entries = authorsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    session.log.info(chalk.bold('\n📝 Looking up authors...\n'));

    for (const entry of entries) {
      // Try ORCID or GitHub lookup first
      if (isORCID(entry) || isGitHubUsername(entry)) {
        // Pattern 2: ORCID or GitHub lookup
        const author = await lookupAuthor(session, entry);
        if (author) {
          newAuthors.push(author as Contributor);
        } else {
          session.log.error(`Skipping ${entry} due to lookup failure`);
        }
      } else {
        // Pattern 3: Parse name-based entry
        const author = parseAuthorString(entry);
        if (author.name) {
          newAuthors.push(author as Contributor);
        }
      }
    }
  }

  if (newAuthors.length === 0) {
    session.log.warn('No authors were added');
    return;
  }

  // Process affiliations for all new authors
  newAuthors.forEach((author) => {
    session.log.debug(
      `Processing author ${author.name}: affiliations=${JSON.stringify(author.affiliations)}`,
    );
    if (author.affiliations) {
      author.affiliations = matchOrAddAffiliations(projectConfig, author);
      session.log.debug(
        `After matchOrAddAffiliations: affiliations=${JSON.stringify(author.affiliations)}`,
      );
    }
  });

  // Append to existing authors
  const existingAuthors = (projectConfig.authors as Contributor[]) || [];

  // Generate unique IDs for new authors to avoid collisions
  // Find the highest existing UID number
  const existingIds = existingAuthors
    .map((a) => a.id)
    .filter((id): id is string => !!id)
    .map((id) => {
      const match = id.match(/contributors-curvenote-generated-uid-(\d+)/);
      return match ? parseInt(match[1], 10) : -1;
    });
  let nextUid = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;

  // Assign IDs to new authors
  newAuthors.forEach((author) => {
    if (!author.id) {
      author.id = `contributors-curvenote-generated-uid-${nextUid++}`;
    }
  });

  const updatedAuthors = [...existingAuthors, ...newAuthors];
  session.log.debug(`Final authors before write: ${JSON.stringify(updatedAuthors, null, 2)}`);

  // Update project config
  const updatedProjectConfig: ProjectConfig = {
    ...projectConfig,
    authors: updatedAuthors,
  };

  await writeConfigs(session, currentPath, {
    projectConfig: cleanProjectConfigForWrite(updatedProjectConfig),
  });

  session.log.info(
    chalk.green(
      `\n✅ Added ${newAuthors.length} author${newAuthors.length > 1 ? 's' : ''} to project config`,
    ),
  );
  newAuthors.forEach((author, idx) => {
    const identifiers = [];
    if (author.orcid) identifiers.push(`ORCID: ${author.orcid}`);
    if (author.github) identifiers.push(`GitHub: ${author.github}`);
    const identifierStr = identifiers.length > 0 ? ` (${identifiers.join(', ')})` : '';
    session.log.info(`  ${idx + 1}. ${author.name}${identifierStr}`);
  });
}

// Add more project modification handlers here, following the same pattern:
// - export async function handleSomeOption(session, currentPath, projectConfig)
// - Validate preconditions (e.g., check if already exists)
// - Perform the operation
// - Log appropriately
