import inquirer from 'inquirer';
import chalk from 'chalk';
import type { ProjectConfig } from 'myst-config';
import type { ISession } from '../../session/types.js';
import { lookupAuthor } from './author-lookup.js';

// ============================================================================
// TEMPLATE INITIALIZATION QUESTIONS
// These questions help users populate initial project metadata after cloning
// a template. The specification can later be overridden by template-specific
// configuration files.
// ============================================================================

export type TemplateQuestionType = 'text' | 'people' | 'list';

export interface TemplateQuestionSpec {
  id: string;
  field: string; // Path in project config (e.g., 'project.title', 'project.authors')
  enabled: boolean;
  type: TemplateQuestionType;
  message: string;
  placeholder?: string;
  hint?: string;
  default?: string; // If set, pressing Enter uses this value; if not set, pressing Enter returns undefined
  required: boolean;
}

/**
 * Default template initialization questions
 * This array defines the questions asked after cloning a GitHub template
 * Order matters - questions are asked sequentially
 */
export const DEFAULT_TEMPLATE_INIT_QUESTIONS: TemplateQuestionSpec[] = [
  {
    id: 'title',
    field: 'project.title',
    enabled: true,
    type: 'text',
    message: 'Project title:',
    placeholder: 'e.g., My Research Project',
    required: false,
  },
  {
    id: 'subtitle',
    field: 'project.subtitle',
    enabled: true,
    type: 'text',
    message: 'Subtitle:',
    placeholder: 'A concise, single line description',
    hint: 'Keep it short - this appears as a tagline',
    required: false,
  },
  {
    id: 'description',
    field: 'project.description',
    enabled: true,
    type: 'text',
    message: 'Description:',
    placeholder: 'A longer description suitable for social media and listings',
    hint: 'Used for social media and article listings',
    required: false,
  },
  {
    id: 'authors',
    field: 'project.authors',
    enabled: true,
    type: 'people',
    message: 'Add author(s):',
    placeholder: 'ORCID, GitHub username, or comma-separated list',
    hint: 'You can add multiple authors separated by commas',
    required: false,
  },
  {
    id: 'keywords',
    field: 'project.keywords',
    enabled: true,
    type: 'list',
    message: 'Keywords:',
    placeholder: 'e.g., science, research, data analysis',
    hint: 'Help others discover your project',
    required: false,
  },
];

/**
 * Prompt for a single text question
 */
async function promptTextQuestion(spec: TemplateQuestionSpec): Promise<string | undefined> {
  // Show hint before the question if available
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  // Build display text: placeholder + [default] if default exists
  let displayText = spec.placeholder || '';
  if (spec.default) {
    displayText = displayText ? `${displayText} [${spec.default}]` : `[${spec.default}]`;
  }

  // Add "(optional)" or "(press Enter to skip)" to message if not required
  let message = spec.message;
  if (!spec.required && !spec.default) {
    message = `${spec.message} ${chalk.dim('(press Enter to skip)')}`;
  }

  const response = await inquirer.prompt([
    {
      name: 'value',
      type: 'input',
      message,
      default: spec.default, // Use default if provided
      transformer: (input: string) => {
        // Show placeholder + [default] when empty
        if (!input && displayText) {
          return chalk.dim(displayText);
        }
        return input;
      },
      validate: (input: string) => {
        if (spec.required && !input.trim()) {
          return `${spec.id} is required`;
        }
        return true;
      },
    },
  ]);

  // If default exists, return default or entered value
  // If no default, return undefined when empty
  const trimmed = response.value?.trim();
  if (!trimmed && !spec.default) {
    return undefined;
  }
  return trimmed || spec.default;
}

/**
 * Prompt for people (authors, editors, contributors) with ORCID/GitHub username lookup + manual entry
 * This can be used for any field that accepts a list of people (authors, editors, contributors, etc.)
 * Accepts comma-separated list or interactive one-by-one entry
 */
async function promptPeopleQuestion(
  session: ISession,
  spec: TemplateQuestionSpec,
): Promise<any[] | undefined> {
  // Show hint before the question if available
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  const people: any[] = [];

  // Build display text: placeholder + [default] if default exists
  let displayText = spec.placeholder || '';
  if (spec.default) {
    displayText = displayText ? `${displayText} [${spec.default}]` : `[${spec.default}]`;
  }

  // Add "(press Enter to skip)" to message if not required
  let message = spec.message;
  if (!spec.required && !spec.default) {
    message = `${spec.message} ${chalk.dim('(press Enter to skip)')}`;
  }

  // First prompt - can accept comma-separated list or single identifier
  const identifierPrompt = await inquirer.prompt([
    {
      name: 'identifier',
      type: 'input',
      message,
      default: spec.default,
      transformer: (input: string) => {
        if (!input && displayText) {
          return chalk.dim(displayText);
        }
        return input;
      },
      validate: (input: string) => {
        // Empty is OK (skip) only if no default
        if (!input.trim() && !spec.default) return true;
        return true;
      },
    },
  ]);

  if (!identifierPrompt.identifier?.trim()) {
    // User pressed Enter without input - skip
    return undefined;
  }

  // Check if this is a comma-separated list
  const identifiers = identifierPrompt.identifier
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean);

  // Look up all identifiers
  console.log(chalk.bold('\n📝 Looking up people...\n'));

  for (const identifier of identifiers) {
    const person = await lookupAuthor(session, identifier);

    if (person) {
      // Show what was found and confirm
      console.log(chalk.green(`  ✓ Found: ${person.name}`));
      if (person.orcid) console.log(chalk.dim(`    ORCID: ${person.orcid}`));
      if (person.github) console.log(chalk.dim(`    GitHub: ${person.github}`));
      if (person.email) console.log(chalk.dim(`    Email: ${person.email}`));

      const confirm = await inquirer.prompt([
        {
          name: 'add',
          type: 'confirm',
          message: 'Add this person?',
          default: true,
        },
      ]);

      if (confirm.add) {
        people.push(person);
      }
    } else {
      // Lookup failed - offer manual entry
      console.log(chalk.yellow(`  Could not find person information for: ${identifier}`));
      const manualPrompt = await inquirer.prompt([
        {
          name: 'manual',
          type: 'confirm',
          message: 'Enter person information manually?',
          default: false,
        },
      ]);

      if (manualPrompt.manual) {
        const manualPerson = await inquirer.prompt([
          {
            name: 'name',
            type: 'input',
            message: 'Name:',
            validate: (input: string) => (input.trim() ? true : 'Name is required'),
          },
          {
            name: 'email',
            type: 'input',
            message: 'Email (optional):',
          },
          {
            name: 'corresponding',
            type: 'confirm',
            message: 'Corresponding?',
            default: false,
            when: (answers: any) => !!answers.email,
          },
        ]);

        people.push({
          name: manualPerson.name,
          email: manualPerson.email || undefined,
          corresponding: manualPerson.corresponding || false,
        });
      }
    }
  }

  // After processing the initial list, ask if they want to add more
  if (people.length > 0) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const continuePrompt = await inquirer.prompt([
        {
          name: 'addMore',
          type: 'confirm',
          message: 'Add another person?',
          default: false,
        },
      ]);

      if (!continuePrompt.addMore) {
        break;
      }

      // Single identifier entry for additional people
      const additionalPrompt = await inquirer.prompt([
        {
          name: 'identifier',
          type: 'input',
          message: 'Enter ORCID or GitHub username:',
        },
      ]);

      if (!additionalPrompt.identifier?.trim()) {
        break;
      }

      const person = await lookupAuthor(session, additionalPrompt.identifier);

      if (person) {
        console.log(chalk.green(`  ✓ Found: ${person.name}`));
        if (person.orcid) console.log(chalk.dim(`    ORCID: ${person.orcid}`));
        if (person.github) console.log(chalk.dim(`    GitHub: ${person.github}`));
        if (person.email) console.log(chalk.dim(`    Email: ${person.email}`));

        const confirm = await inquirer.prompt([
          {
            name: 'add',
            type: 'confirm',
            message: 'Add this person?',
            default: true,
          },
        ]);

        if (confirm.add) {
          people.push(person);
        }
      } else {
        console.log(chalk.yellow('  Could not find person information.'));
        const manualPrompt = await inquirer.prompt([
          {
            name: 'manual',
            type: 'confirm',
            message: 'Enter person information manually?',
            default: false,
          },
        ]);

        if (manualPrompt.manual) {
          const manualPerson = await inquirer.prompt([
            {
              name: 'name',
              type: 'input',
              message: 'Name:',
              validate: (input: string) => (input.trim() ? true : 'Name is required'),
            },
            {
              name: 'email',
              type: 'input',
              message: 'Email (optional):',
            },
            {
              name: 'corresponding',
              type: 'confirm',
              message: 'Corresponding?',
              default: false,
              when: (answers: any) => !!answers.email,
            },
          ]);

          people.push({
            name: manualPerson.name,
            email: manualPerson.email || undefined,
            corresponding: manualPerson.corresponding || false,
          });
        }
      }
    }
  }

  return people.length > 0 ? people : undefined;
}

/**
 * Prompt for a comma-separated list question (e.g., keywords, tags, etc.)
 */
async function promptListQuestion(spec: TemplateQuestionSpec): Promise<string[] | undefined> {
  // Show hint before the question if available
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  // Build display text: placeholder + [default] if default exists
  let displayText = spec.placeholder || '';
  if (spec.default) {
    displayText = displayText ? `${displayText} [${spec.default}]` : `[${spec.default}]`;
  }

  // Add "(press Enter to skip)" to message if not required
  let message = spec.message;
  if (!spec.required && !spec.default) {
    message = `${spec.message} ${chalk.dim('(press Enter to skip)')}`;
  }

  const response = await inquirer.prompt([
    {
      name: 'value',
      type: 'input',
      message,
      default: spec.default,
      transformer: (input: string) => {
        if (!input && displayText) {
          return chalk.dim(displayText);
        }
        return input;
      },
    },
  ]);

  const value = response.value?.trim() || spec.default;

  if (!value) {
    return undefined;
  }

  // Split by comma and clean up
  const keywords = value
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);

  return keywords.length > 0 ? keywords : undefined;
}

/**
 * Run template initialization questions and return collected metadata
 * @param session The session object
 * @param targetPath The directory to check for template.yml (optional, defaults to checking current directory)
 * @param questionSpecs Optional custom question specifications (if not provided, will try to load from template.yml or use defaults)
 */
export async function runTemplateInitQuestions(
  session: ISession,
  targetPath?: string,
  questionSpecs?: TemplateQuestionSpec[],
): Promise<Partial<ProjectConfig>> {
  // If no specs provided and targetPath given, try to load from template.yml
  let questions = questionSpecs;
  if (!questions && targetPath) {
    const { loadTemplateFile } = await import('./template-file.js');
    questions = loadTemplateFile(session, targetPath);
  }

  // Fall back to defaults if still no questions
  if (!questions) {
    questions = DEFAULT_TEMPLATE_INIT_QUESTIONS;
  }

  console.log(chalk.bold("\n📝 Let's set up your project metadata...\n"));

  const metadata: any = {};

  for (const spec of questions) {
    if (!spec.enabled) {
      continue;
    }

    let value: any;

    switch (spec.type) {
      case 'text':
        value = await promptTextQuestion(spec);
        break;
      case 'people':
        value = await promptPeopleQuestion(session, spec);
        break;
      case 'list':
        value = await promptListQuestion(spec);
        break;
      default:
        session.log.warn(`Unknown question type: ${spec.type}`);
        continue;
    }

    // Store the value if provided
    if (value !== undefined) {
      // Parse the field path and set the value
      const fieldParts = spec.field.split('.');
      if (fieldParts[0] === 'project') {
        const fieldName = fieldParts[1];
        metadata[fieldName] = value;
      }
    }
  }

  return metadata;
}
