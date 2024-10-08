import type { TemplateOptionDefinition } from 'myst-templates';
import type { Position } from 'unist';

export enum CheckTags {
  'build' = 'build',
  'block' = 'block',
  'citation' = 'citation',
  'code' = 'code',
  'directive' = 'directive',
  'export' = 'export',
  'frontmatter' = 'frontmatter',
  'content' = 'content',
  'glossary' = 'glossary',
  'image' = 'image',
  'include' = 'include',
  'link' = 'link',
  'math' = 'math',
  'notebook' = 'notebook',
  'parse' = 'parse',
  'reference' = 'reference',
  'role' = 'role',
  'static' = 'static',
  'toc' = 'toc',
  'authors' = 'authors',
  'abstract' = 'abstract',
  'keywords' = 'keywords',
  'dataAvailability' = 'data-availability',
}

export type CheckOptionDefinition = TemplateOptionDefinition;

export type CheckDefinition = {
  id: string;
  title: string;
  /** This should be terse, for example, "ensures author exists" */
  purpose: string;
  tags: (CheckTags | string)[];
  options?: CheckOptionDefinition[];
};

export type Check = Partial<Omit<CheckDefinition, 'options'>> & {
  id: string;
  optional?: boolean;
} & Record<string, any>;

export enum CheckStatus {
  'pass' = 'pass',
  'fail' = 'fail',
  /** The check could not be run, if possible list the `cause` in the result. */
  'error' = 'error',
}

export type CheckResult = {
  status: CheckStatus;
  /** Terse message that can be used in the console and the UI. If undefined, the default description is used */
  message?: string;
  /** Detailed information about the check, e.g. having specific information about the check */
  note?: string;
  /** A short help message for this specific failure, e.g. "Add an abstract" */
  help?: string;
  /** Nice work, the check passed, e.g. "Abstract is a good length 💯", no ending punctuation and add an emoji at the end */
  nice?: string;
  /** File as an absolute path, this should be made relative later */
  file?: string;
  /** Node position with line/column information if available */
  position?: Position;
  /** Setting `optional` will override the journals choices when the checks are combined */
  optional?: boolean;
  /** If the cause of an error or failure has a known ID, list it here */
  cause?: string;
};
