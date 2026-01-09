export type WorkflowState = {
  name: string;
  label: string;
  messages?: {
    [key: string]: string | undefined;
  };
  tags: string[]; // ('ok' | 'error' | 'warning' | 'end')
  authorOnly: boolean;
  inbox: boolean;
  visible: boolean;
  published: boolean;
};

export type TransitionLabels = {
  button?: string;
  confirmation?: string;
  success?: string;
  action?: string;
  inProgress?: string;
};

export type TransitionOptions = {
  jobType?: string;
  setsPublishedDate?: boolean;
  updatesSlug?: boolean;
  [key: string]: string | boolean | undefined;
};

export type WorkflowTransition = {
  version: number;
  name: string;
  sourceStateName: string | null;
  targetStateName: string;
  labels: TransitionLabels;
  userTriggered: boolean;
  help: string;
  requiredScopes: string[];
  requiresJob: boolean;
  options?: TransitionOptions;
  state?: Record<string, any>;
};

export type TransitionActions = {
  name: string;
  requiredScopes: string[];
  requiresJob?: boolean;
  jobType?: string;
  setsPublishedDate?: boolean;
  updatesSlug?: boolean;
};

export type Workflow = {
  version: number;
  name: string;
  label: string;
  mermaid?: string;
  states: Record<string, WorkflowState>;
  transitions: WorkflowTransition[];
  initialState: string;
};

export interface WorkflowRegistration {
  workflows: Workflow[];
}
