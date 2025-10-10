import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeConfigs } from 'myst-cli';
import type { ProjectConfig } from 'myst-config';
import type { ISession } from '../../session/types.js';
import { lookupAuthor } from './author-lookup.js';
import { cleanProjectConfigForWrite } from '../utils.js';
import { loadTemplateFile } from './template-file.js';
import {
  DEFAULT_TEMPLATE_INIT_QUESTIONS,
  type TemplateQuestionSpec,
} from './template-init-questions.js';

/**
 * Handle --improve: Update existing project by re-answering template questions
 */
export async function handleImproveProject(
  session: ISession,
  currentPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  session.log.info(chalk.bold('\n🔄 Improving existing project configuration...\n'));

  // Load template questions (from template.yml or defaults)
  let questionSpecs = loadTemplateFile(session, currentPath);
  if (!questionSpecs) {
    questionSpecs = DEFAULT_TEMPLATE_INIT_QUESTIONS;
  }

  const updates: Record<string, any> = {};
  const changes: string[] = [];

  for (const spec of questionSpecs) {
    if (!spec.enabled) {
      continue;
    }

    // Get current value from projectConfig
    const fieldParts = spec.field.split('.');
    let currentValue: any;
    if (fieldParts[0] === 'project' && fieldParts.length === 2) {
      currentValue = (projectConfig as any)[fieldParts[1]];
    }

    let newValue: any;

    switch (spec.type) {
      case 'text':
        newValue = await promptImproveTextQuestion(spec, currentValue);
        break;
      case 'list':
        newValue = await promptImproveListQuestion(spec, currentValue);
        break;
      case 'people':
        newValue = await promptImprovePeopleQuestion(session, spec, currentValue);
        break;
      default:
        session.log.warn(`Unknown question type: ${spec.type}`);
        continue;
    }

    // Store the value if it changed
    if (newValue !== undefined) {
      const fieldName = fieldParts[1];
      updates[fieldName] = newValue;

      // Track what changed
      if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
        changes.push(`  • ${spec.id}: ${formatChangeDescription(currentValue, newValue)}`);
      }
    }
  }

  // Show summary of changes
  if (changes.length === 0) {
    session.log.info(chalk.dim('\nNo changes were made.'));
    return;
  }

  console.log(chalk.bold('\n📋 Summary of changes:\n'));
  changes.map((change) => console.log(change));

  // Ask for confirmation
  const confirm = await inquirer.prompt([
    {
      name: 'proceed',
      type: 'confirm',
      message: '\nSave these changes to curvenote.yml?',
      default: true,
    },
  ]);

  if (!confirm.proceed) {
    session.log.info(chalk.dim('\nChanges discarded.'));
    return;
  }

  // Apply updates
  const updatedProjectConfig: ProjectConfig = {
    ...projectConfig,
    ...updates,
  };

  await writeConfigs(session, currentPath, {
    projectConfig: cleanProjectConfigForWrite(updatedProjectConfig),
  });

  session.log.info(chalk.green('\n✅ Project configuration updated successfully!'));
}

/**
 * Prompt for a text question with existing value as default
 */
async function promptImproveTextQuestion(
  spec: TemplateQuestionSpec,
  currentValue: string | undefined,
): Promise<string | undefined> {
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  const defaultValue = currentValue || spec.default;

  let message = spec.message;
  if (!spec.required) {
    if (defaultValue) {
      message = `${spec.message} ${chalk.dim('(press Enter to keep)')}`;
    } else {
      message = `${spec.message} ${chalk.dim('(press Enter to skip)')}`;
    }
  }

  const response = await inquirer.prompt([
    {
      name: 'value',
      type: 'input',
      message,
      default: defaultValue,
      validate: (input: string) => {
        if (spec.required && !input.trim() && !defaultValue) {
          return `${spec.id} is required`;
        }
        return true;
      },
    },
  ]);

  const trimmed = response.value?.trim();
  if (!trimmed && !defaultValue) {
    return undefined;
  }
  return trimmed || defaultValue;
}

/**
 * Prompt for a list question with existing values as default
 */
async function promptImproveListQuestion(
  spec: TemplateQuestionSpec,
  currentValue: string[] | undefined,
): Promise<string[] | undefined> {
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  const defaultValue = currentValue?.join(', ') || spec.default;

  let message = spec.message;
  if (!spec.required) {
    if (defaultValue) {
      message = `${spec.message} ${chalk.dim('(press Enter to keep)')}`;
    } else {
      message = `${spec.message} ${chalk.dim('(press Enter to skip)')}`;
    }
  }

  const response = await inquirer.prompt([
    {
      name: 'value',
      type: 'input',
      message,
      default: defaultValue,
      validate: (input: string) => {
        if (spec.required && !input.trim() && !defaultValue) {
          return `${spec.id} is required`;
        }
        return true;
      },
    },
  ]);

  const trimmed = response.value?.trim();
  if (!trimmed && !defaultValue) {
    return undefined;
  }

  const input = trimmed || defaultValue || '';
  const items = input
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

/**
 * Prompt for a people question - show existing people, then ask to add more
 */
async function promptImprovePeopleQuestion(
  session: ISession,
  spec: TemplateQuestionSpec,
  currentValue: any[] | undefined,
): Promise<any[] | undefined> {
  if (spec.hint) {
    console.log(chalk.gray(`\n${spec.hint}`));
  }

  // Show existing people
  if (currentValue && currentValue.length > 0) {
    console.log(chalk.bold('\nExisting people:'));
    currentValue.forEach((person, index) => {
      const name = person.name || 'Unknown';
      console.log(chalk.dim(`  ${index + 1}. ${name}`));
    });
  } else {
    console.log(chalk.dim('\nNo existing people.'));
  }

  // Ask if they want to add more
  const addMorePrompt = await inquirer.prompt([
    {
      name: 'addMore',
      type: 'confirm',
      message: 'Add more people?',
      default: false,
    },
  ]);

  if (!addMorePrompt.addMore) {
    return currentValue;
  }

  // Collect new people
  const newPeople: any[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const identifierPrompt = await inquirer.prompt([
      {
        name: 'identifier',
        type: 'input',
        message: 'Enter ORCID or GitHub username (or press Enter to finish):',
      },
    ]);

    if (!identifierPrompt.identifier?.trim()) {
      break;
    }

    const person = await lookupAuthor(session, identifierPrompt.identifier);

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
        newPeople.push(person);
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

        newPeople.push({
          name: manualPerson.name,
          email: manualPerson.email || undefined,
          corresponding: manualPerson.corresponding || false,
        });
      }
    }

    // Ask if they want to add more
    const continuePrompt = await inquirer.prompt([
      {
        name: 'continue',
        type: 'confirm',
        message: 'Add another person?',
        default: false,
      },
    ]);

    if (!continuePrompt.continue) {
      break;
    }
  }

  // Combine existing and new people
  if (newPeople.length > 0) {
    return [...(currentValue || []), ...newPeople];
  }

  return currentValue;
}

/**
 * Format a change description for display
 */
function formatChangeDescription(oldValue: any, newValue: any): string {
  if (oldValue === undefined || oldValue === null) {
    return `added "${formatValue(newValue)}"`;
  }
  if (newValue === undefined || newValue === null) {
    return `removed`;
  }
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length === 0) {
      return `added ${newValue.length} item(s)`;
    }
    if (newValue.length > oldValue.length) {
      return `added ${newValue.length - oldValue.length} item(s) (was ${oldValue.length}, now ${newValue.length})`;
    }
    if (newValue.length < oldValue.length) {
      return `removed ${oldValue.length - newValue.length} item(s) (was ${oldValue.length}, now ${newValue.length})`;
    }
    return `modified (${newValue.length} items)`;
  }
  return `changed from "${formatValue(oldValue)}" to "${formatValue(newValue)}"`;
}

/**
 * Format a value for display (truncate if too long)
 */
function formatValue(value: any): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    if (value.length > 3) return `${value.slice(0, 3).join(', ')}...`;
    return value.join(', ');
  }
  const str = String(value);
  if (str.length > 50) return str.substring(0, 47) + '...';
  return str;
}
