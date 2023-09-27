import type { TemplateOptionDefinition } from 'myst-templates';
import type { ISession } from '../session/types.js';
import type { Position } from 'unist';

export type CheckOptionDefinition = TemplateOptionDefinition;

export type CheckDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  options?: CheckOptionDefinition[];
  url?: string;
  example?: string;
};

export enum CheckStatus {
  'pass' = 'pass',
  'fail' = 'fail',
  'error' = 'error',
}

export type CheckResult = {
  status: CheckStatus;
  message: string;
  file?: string;
  position?: Position;
};

export type CheckInterface = CheckDefinition & {
  validate: (session: ISession, options: Check) => Promise<CheckResult | CheckResult[]>;
};

export type Check = {
  id: string;
  // optional: boolean;
} & Record<string, any>;

export type CompiledCheckResults = (CheckDefinition & CheckResult)[];

export type CheckReport = {
  status: CheckStatus;
  results: {
    category: string;
    status: CheckStatus;
    checks: CompiledCheckResults;
  }[];
};
