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

export interface ExtensionCheckService {
  id: string; // e.g., 'curvenote-structure'
  name: string; // Display name
  description: string; // Display description
  // Client-side component to render on checks screen
  checksSectionComponent: React.ComponentType<{
    metadata: any; // WorkVersionMetadata & ChecksMetadataSection
  }>;
  // Optional: Server-side action handler
  handleAction?: (args: {
    intent: string;
    formData: FormData;
    workVersionId: string;
    metadata: any; // WorkVersionMetadata & ChecksMetadataSection
  }) => Promise<Response>;
}

export interface ClientExtension {
  id: string;
  name: string;
  description: string;
  getTasks?: () => ExtensionTask[];
  getIcons?: () => ExtensionIcon[];
  getAnalyticsEvents?: () => ExtensionAnalyticsEvents;
  getEmailTemplates?: () => ExtensionEmailTemplate[];
  getWorkflows?: () => WorkflowRegistration;
  getChecks?: () => ExtensionCheckService[];
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
