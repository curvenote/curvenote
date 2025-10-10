import chalk from 'chalk';
import fs from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { ISession } from '../../session/types.js';
import { TEMPLATE_YML } from './types.js';
import {
  DEFAULT_TEMPLATE_INIT_QUESTIONS,
  type TemplateQuestionSpec,
} from './template-init-questions.js';

const TEMPLATE_HEADER = `# Curvenote Init Template Configuration
# This file customizes the questions asked during 'cn init'
#
# CUSTOMIZATION:
# - Set 'enabled: false' to skip a question
# - Change message, placeholder, hint text
# - Set 'default: "value"' to provide a default answer (removes undefined)
# - Set 'required: true' to make a question mandatory
#
# QUESTION TYPES:
# - text: Single-line text input
# - list: Comma-separated list (e.g., keywords, tags)
# - authors: Special type for ORCID/GitHub author lookup
#
# ADDING CUSTOM QUESTIONS:
# You can add custom text or list questions:
#
# - id: my_custom_field          # Unique identifier
#   field: project.my_field      # Where to store in curvenote.yml
#   enabled: true
#   type: text                   # or 'list' for comma-separated
#   message: "My custom question:"
#   placeholder: "Example answer"
#   hint: "Optional hint shown before the question"
#   default: undefined           # Optional default value
#   required: false
#
# Note: Custom fields will be added to your curvenote.yml under 'project'

`;

interface TemplateFile {
  name: string;
  version: number;
  questions: TemplateQuestionSpec[];
}

/**
 * Convert a TemplateQuestionSpec to a plain object with all fields,
 * including undefined values for clarity
 */
function specToPlainObject(spec: TemplateQuestionSpec): Record<string, any> {
  return {
    id: spec.id,
    field: spec.field,
    enabled: spec.enabled,
    type: spec.type,
    message: spec.message,
    placeholder: spec.placeholder !== undefined ? spec.placeholder : undefined,
    hint: spec.hint !== undefined ? spec.hint : undefined,
    default: spec.default !== undefined ? spec.default : undefined,
    required: spec.required,
  };
}

/**
 * Write the default template questions to template.yml
 */
export async function writeTemplateFile(session: ISession, targetPath: string): Promise<void> {
  const templatePath = join(targetPath, TEMPLATE_YML);

  // Check if file already exists
  if (fs.existsSync(templatePath)) {
    throw new Error(
      `${TEMPLATE_YML} already exists at ${templatePath}. Remove it first if you want to regenerate it.`,
    );
  }

  // Convert all specs to plain objects with explicit undefined values
  const questions = DEFAULT_TEMPLATE_INIT_QUESTIONS.map(specToPlainObject);

  const templateData = {
    name: 'curvenote init',
    version: 1,
    questions,
  };

  // Convert to YAML with null representing undefined
  const yamlContent = yaml.dump(templateData, {
    lineWidth: -1, // Don't wrap lines
    noRefs: true, // Don't use references
    sortKeys: false, // Keep order
  });

  // Write with header comment
  const fullContent = TEMPLATE_HEADER + yamlContent;

  fs.writeFileSync(templatePath, fullContent, 'utf-8');

  session.log.info(chalk.green(`\n✓ Created ${chalk.bold(TEMPLATE_YML)} at ${templatePath}\n`));
  session.log.info(chalk.dim('  Edit this file to customize initialization questions.'));
  session.log.info(
    chalk.dim('  Run ') + chalk.bold('cn init --github <url>') + chalk.dim(' to use it.'),
  );
}

/**
 * Load and validate template questions from template.yml
 * Returns the questions array, or undefined if file doesn't exist or is invalid
 */
export function loadTemplateFile(
  session: ISession,
  targetPath: string,
): TemplateQuestionSpec[] | undefined {
  const templatePath = join(targetPath, TEMPLATE_YML);

  // Check if template file exists
  if (!fs.existsSync(templatePath)) {
    return undefined;
  }

  try {
    session.log.debug(`Loading template from ${templatePath}`);

    const fileContent = fs.readFileSync(templatePath, 'utf-8');
    const templateData = yaml.load(fileContent) as any;

    // Validate structure
    if (!templateData || typeof templateData !== 'object') {
      session.log.warn(
        chalk.yellow(
          `⚠️  Invalid ${TEMPLATE_YML}: Root should be an object. Using default questions.`,
        ),
      );
      return undefined;
    }

    if (templateData.name !== 'curvenote init') {
      session.log.warn(
        chalk.yellow(
          `⚠️  Invalid ${TEMPLATE_YML}: name should be "curvenote init". Using default questions.`,
        ),
      );
      return undefined;
    }

    if (templateData.version !== 1) {
      session.log.warn(
        chalk.yellow(`⚠️  Invalid ${TEMPLATE_YML}: version should be 1. Using default questions.`),
      );
      return undefined;
    }

    if (!Array.isArray(templateData.questions)) {
      session.log.warn(
        chalk.yellow(
          `⚠️  Invalid ${TEMPLATE_YML}: questions should be an array. Using default questions.`,
        ),
      );
      return undefined;
    }

    // Validate each question
    const questions: TemplateQuestionSpec[] = [];
    for (const [index, q] of templateData.questions.entries()) {
      if (!q || typeof q !== 'object') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping invalid question at index ${index}: not an object`),
        );
        continue;
      }

      // Required fields
      if (!q.id || typeof q.id !== 'string') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping question at index ${index}: missing or invalid 'id'`),
        );
        continue;
      }

      if (!q.field || typeof q.field !== 'string') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping question '${q.id}': missing or invalid 'field'`),
        );
        continue;
      }

      if (typeof q.enabled !== 'boolean') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping question '${q.id}': missing or invalid 'enabled'`),
        );
        continue;
      }

      if (!['text', 'list', 'authors'].includes(q.type)) {
        session.log.warn(
          chalk.yellow(
            `⚠️  Skipping question '${q.id}': invalid type '${q.type}' (must be 'text', 'list', or 'authors')`,
          ),
        );
        continue;
      }

      if (!q.message || typeof q.message !== 'string') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping question '${q.id}': missing or invalid 'message'`),
        );
        continue;
      }

      if (typeof q.required !== 'boolean') {
        session.log.warn(
          chalk.yellow(`⚠️  Skipping question '${q.id}': missing or invalid 'required'`),
        );
        continue;
      }

      // Build validated question spec
      const spec: TemplateQuestionSpec = {
        id: q.id,
        field: q.field,
        enabled: q.enabled,
        type: q.type,
        message: q.message,
        placeholder: q.placeholder || undefined,
        hint: q.hint || undefined,
        default: q.default || undefined,
        required: q.required,
      };

      questions.push(spec);
    }

    if (questions.length === 0) {
      session.log.warn(
        chalk.yellow(`⚠️  No valid questions found in ${TEMPLATE_YML}. Using default questions.`),
      );
      return undefined;
    }

    session.log.info(
      chalk.green(`✓ Loaded ${questions.length} question(s) from ${chalk.bold(TEMPLATE_YML)}`),
    );
    return questions;
  } catch (error) {
    session.log.warn(
      chalk.yellow(
        `⚠️  Error loading ${TEMPLATE_YML}: ${(error as Error).message}. Using default questions.`,
      ),
    );
    return undefined;
  }
}
