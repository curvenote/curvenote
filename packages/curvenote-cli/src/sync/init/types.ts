export type Options = {
  branch?: string;
  force?: boolean;
  yes?: boolean;
  domain?: string;
  writeTOC?: boolean;
  addAuthors?: boolean | string; // true for interactive, or comma-separated list
  github?: string; // GitHub repository URL
};

export const CURVENOTE_YML = 'curvenote.yml';
