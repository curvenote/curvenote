export type Options = {
  branch?: string;
  force?: boolean;
  yes?: boolean;
  domain?: string;
  writeTOC?: boolean;
  addAuthors?: boolean | string; // true for interactive, or comma-separated list
  github?: string; // GitHub repository URL
  curvenote?: string; // Curvenote project URL
  output?: string; // Output folder for cloned/initialized project
  writeTemplate?: boolean; // Write template.yml with default questions
  improve?: boolean; // Update existing project by re-answering template questions
};

export const CURVENOTE_YML = 'curvenote.yml';
export const TEMPLATE_YML = 'template.yml';
