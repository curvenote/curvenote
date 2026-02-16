import type { RouteConfigEntry } from '@react-router/dev/routes';
import type { MenuContents } from '../../components/navigation/types.js';
import type { Context, ExtensionEmailTemplate, StorageBackend } from '../../backend/types.js';
import type { CreateJob } from '../../backend/loaders/jobs/types.js';
import type { WorkflowRegistration } from '../../workflow/types.js';

export type TaskComponent = React.ComponentType<any>;
export type IconComponent = React.ComponentType<{ className?: string }>;
export type Icon = IconComponent;

export type IconTag = 'default' | 'light' | 'dark' | 'text';

export type Task = {
  name: string;
};

export interface ExtensionTask {
  id: string;
  name: string;
  description: string;
  component: TaskComponent;
  scopes?: string[]; // Optional list of scopes that the task is allowed to be accessed under
}

export interface ExtensionIcon {
  id: string;
  component: IconComponent;
  tags?: IconTag[];
}

export interface ExtensionAnalyticsEvents {
  events: Record<string, string>;
  descriptions: Record<string, string>;
}

/** Arguments for the execute check action (e.g. enqueue job). */
export interface ExtensionCheckExecuteArgs {
  ctx: Context;
  workVersionId: string;
  checkRunId: string;
  /** Create a job; platform provides this so extensions can enqueue without knowing extension list. */
  createJob: (jobType: string, payload: Record<string, unknown>) => Promise<unknown>;
}

/** Result of execute check action. */
export interface ExtensionCheckExecuteResult {
  success: boolean;
  error?: string;
}

export type CheckServiceRunData<T extends object> = {
  status: string;
  serviceData?: T;
  serviceDataSchema?: Record<string, any>;
};

/** Arguments for the status check action. */
export interface ExtensionCheckStatusArgs {
  ctx: Context;
  checkRunId: string;
}

/** Arguments for handleAction. Used from both upload flow (execute) and checks page (form intents). */
export interface ExtensionCheckHandleActionArgs {
  intent: string;
  workVersionId: string;
  /** Server extensions allowing this extension to interact with other extensions. */
  serverExtensions: ServerExtension[];
  /** Form data when invoked from checks page. */
  formData?: FormData;
  /** Work version metadata when invoked from checks page. */
  metadata?: any; // WorkVersionMetadata & ChecksMetadataSection
  /** Context when invoked from upload flow (execute). Enables job creation. */
  ctx?: Context;
  /** Check run id when invoked from upload flow (execute). */
  checkRunId?: string;
  /**
   * Optional transport / submit mode for checks that support multiple backends
   * (e.g. 'service' for external container, 'stream' for in-process streaming job).
   */
  submitMode?: 'service' | 'stream';
}

export interface ExtensionCheckService {
  id: string; // e.g., 'curvenote-structure'
  name: string; // Display name
  description: string; // Display description
  // Client-side component to render on checks screen
  sectionHeaderComponent: React.ComponentType<{ tag: string }>;
  sectionActivityComponent: React.ComponentType<{
    metadata: any; // WorkVersionMetadata & ChecksMetadataSection
  }>;
  /** Server-side action handler. Used from upload flow (intent 'execute' + ctx + checkRunId + createJob) and checks page (intent + formData + metadata). */
  handleAction?: (args: ExtensionCheckHandleActionArgs) => Promise<Response>;
  /** Get current status of a check run. */
  handleStatus?: (args: ExtensionCheckStatusArgs) => Promise<Response>;
}

export type ClientExtensionCheckService = Omit<
  ExtensionCheckService,
  'handleAction' | 'handleStatus'
>;

export interface ClientExtension {
  id: string;
  name: string;
  description: string;
  getTasks?: () => ExtensionTask[];
  getIcons?: () => ExtensionIcon[];
  getAnalyticsEvents?: () => ExtensionAnalyticsEvents;
  getEmailTemplates?: () => ExtensionEmailTemplate[];
  getWorkflows?: () => WorkflowRegistration;
  getChecks?: () => ClientExtensionCheckService[];
  registerNavigation: NavigationRegistrationFn;
}

export interface ServerExtension extends ClientExtension {
  registerRoutes?: (appConfig: AppConfig) => Promise<RouteRegistration[]>;
  getJobs?: () => JobRegistration[];
}

export type RouteRegistration = {
  attachTo: string;
  register: () => RouteConfigEntry[];
};

export type RouteRegistrationFn = () => RouteRegistration[];

export type NavigationRegistration = {
  attachTo: string;
  replace: boolean;
  register: (baseUrl: string) => MenuContents;
};

export type NavigationRegistrationFn = () => NavigationRegistration[];

export type JobRegistration = {
  jobType: string;
  handler: (ctx: Context, data: CreateJob, storageBackend?: StorageBackend) => Promise<any>;
  requiresStorageBackend?: boolean;
};

export interface InboundEmail {
  enabled?: boolean;
  password?: string;
  /**
   * A list of email addresses (or regular expressions)that are allowed to send emails to the
   * site
   */
  senders?: string[];
  username?: string;
}

// TODO is there a way not to have to maintain this alongside AppConfig?
// i.e. it would be good to be able to define the shape of the extension
// more generically within the app-config schema
export interface ExtensionConfig {
  dataModels?: boolean;
  inboundEmail?: InboundEmail;
  navigation?: boolean;
  routes?: boolean;
  task?: boolean;
  workflows?: boolean;
  checks?: boolean;
}
