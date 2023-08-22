import type { TemplateOptionDefinition } from 'myst-templates';
import type { ISession } from '../session/types.js';

export type CheckOptionDefinition = TemplateOptionDefinition;

export type CheckDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  options?: CheckOptionDefinition[];
  url?: string;
};

export enum CheckStatus {
  'pass' = 'pass',
  'fail' = 'fail',
  'error' = 'error',
}

export type CheckResult = {
  status: CheckStatus;
  message: string;
};

export type CheckInterface = CheckDefinition & {
  validate: (session: ISession, file: string, options: Check) => Promise<CheckResult>;
};

export type Check = {
  id: string;
  // optional: boolean;
} & Record<string, any>;

export type CheckReport = {
  status: CheckStatus;
  results: {
    category: string;
    status: CheckStatus;
    checks: (CheckDefinition & CheckResult)[];
  }[];
};
