import chalk from 'chalk';
import fs from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { ISession } from '../../session/types.js';
import { TEMPLATE_YML } from './types.js';
import { DEFAULT_TEMPLATE_INIT_QUESTIONS } from './templateInitQuestions.js';
import { specToPlainObject } from './specToPlainObject.js';

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
# - people: Person list with ORCID/GitHub lookup (for authors, editors, contributors)
#
# USING THE 'PEOPLE' TYPE:
# The 'people' type can be used for authors, editors, or contributors:
#
# - id: editors
#   field: project.editors       # Use 'project.editors' or 'project.contributors'
#   enabled: true
#   type: people
#   message: "Add editor(s):"
#   placeholder: "ORCID, GitHub username, or comma-separated list"
#   hint: "You can add multiple editors separated by commas"
#   required: false
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
