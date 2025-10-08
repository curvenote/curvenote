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
};

export const CURVENOTE_YML = 'curvenote.yml';
