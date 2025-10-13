import chalk from 'chalk';
import fs from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { ISession } from '../../session/types.js';
import { TEMPLATE_YML, type TemplateQuestionSpec } from './types.js';

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

      if (!['text', 'list', 'people'].includes(q.type)) {
        session.log.warn(
          chalk.yellow(
            `⚠️  Skipping question '${q.id}': invalid type '${q.type}' (must be 'text', 'list', or 'people')`,
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
