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
  category?: string; // Optional task category used for dashboard grouping
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

/** Arguments for handleAction (upload `execute` and extension-owned action routes). */
export interface ExtensionCheckHandleActionArgs {
  intent: string;
  workVersionId: string;
  /** Server extensions allowing this extension to interact with other extensions. */
  serverExtensions: ServerExtension[];
  /** Form data for multi-field intents (e.g. refresh report URL). */
  formData?: FormData;
  /** Work version metadata when needed by an intent (e.g. upload integration). */
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

/** Result of handleAction: success with optional status, or error (message string or object with type/message). */
export type ExtensionCheckHandleActionResult = {
  success?: boolean;
  error?: {
    type: string;
    message: string;
    status?: number;
  };
  status?: number;
};

/**
 * Props the platform passes to `ExtensionCheckService.sectionActivityComponent`.
 * `metadata` is extension-defined (typically derived from check run `serviceData` / work checks state).
 * Optional fields support fetcher-based flows (e.g. manual status refresh) that need routing context.
 */
export type ExtensionCheckSectionActivityProps = {
  checkRunId?: string;
  workVersionId?: string;
  metadata: any;
  /** POST target for check UI mutations (extension-owned route or legacy work checks path). */
  remoteStatusActionPath?: string;
  /**
   * When true, this check run is the most recently modified run for its `kind` on this work version
   * (e.g. latest Proofig run). Used for one-shot behaviours such as hydrating remote status on
   * work details load. Omitted on routes that do not compute it (treated as false).
   */
  isLatestRunForKind?: boolean;
};

/**
 * Props for `ExtensionCheckService.checkRunTimelineMountComponent`.
 * Rendered on work-details timelines **outside** the expandable tray so extensions can run
 * mount-only logic (e.g. one-shot remote sync) without the user opening the panel.
 * `metadata` is the check run’s `serviceData`; shape is extension-defined.
 */
export type ExtensionCheckRunTimelineMountProps = {
  checkRunId: string;
  workVersionId: string;
  /** Check service id from the run row (e.g. `proofig`). */
  checkKind: string;
  metadata: unknown;
  /** POST target for check UI mutations. */
  remoteStatusActionPath: string;
  /** See `ExtensionCheckSectionActivityProps.isLatestRunForKind`. */
  isLatestRunForKind?: boolean;
};

/**
 * Props for `ExtensionCheckService.sectionSummaryTitleComponent`.
 * Rendered in the work-version timeline title row before the fixed “checks” label (same line);
 * platform constrains height so overflow does not break the row layout.
 */
export type ExtensionCheckSectionSummaryTitleProps = {
  /** Check run `serviceData` (extension-defined shape), same as `sectionSummaryBadgeComponent`. */
  metadata: any;
};

export interface ExtensionCheckService {
  id: string; // e.g., 'curvenote-structure'
  name: string; // Display name
  description: string; // Display description
  /**
   * App-absolute path for extension-owned check actions (e.g. `/app/extensions/proofig/actions`).
   * When set, the platform uses this for `remoteStatusActionPath` on the checks page and work timeline.
   */
  checksActionPath?: string;
  // Client-side component to render on checks screen
  sectionHeaderComponent: React.ComponentType<{ tag: React.ReactNode }>;
  sectionActivityComponent: React.ComponentType<ExtensionCheckSectionActivityProps>;
  /** Optional summary badge for timeline (e.g. "All clear", "2 problems", "Awaiting review"). Same metadata as sectionActivityComponent. */
  sectionSummaryBadgeComponent?: React.ComponentType<{ metadata: any }>;
  /**
   * Optional title region for the timeline row (e.g. service logo). When set, replaces the default
   * `{name}` segment; the platform always appends the word “checks” on the same line with spacing.
   */
  sectionSummaryTitleComponent?: React.ComponentType<ExtensionCheckSectionSummaryTitleProps>;
  /**
   * Optional component mounted for each matching check run row on the work timeline even when the
   * tray is collapsed. Use for extension-specific side effects keyed off loader data.
   *
   * **Why a component (not a plain `onMount` callback):** timeline side effects often need React
   * Router primitives (`useFetcher`, `useRevalidator`, etc.). Those are hooks and must run inside
   * a component rendered under the router. A registered function called from the platform’s
   * `useEffect` cannot use those hooks unless the platform injects submit/revalidate callbacks for
   * every extension. A small headless component (`return null`) keeps the platform generic while
   * letting extensions own full fetch/revalidate behaviour.
   */
  checkRunTimelineMountComponent?: React.ComponentType<ExtensionCheckRunTimelineMountProps>;
  /** Server-side action handler. Used from upload flow (intent `execute` + job enqueue). */
  handleAction?: (
    args: ExtensionCheckHandleActionArgs,
  ) => Promise<ExtensionCheckHandleActionResult>;
  /** Get current status of a check run. */
  handleStatus?: (args: ExtensionCheckStatusArgs) => Promise<Response>;
}

export type ClientExtensionCheckService = Omit<
  ExtensionCheckService,
  'handleAction' | 'handleStatus'
>;

/** Props for the optional extension admin card component (platform extensions page). Aligned with ExtensionAdminCardFallback. */
export type ExtensionAdminCardProps = {
  /** Extension display name (e.g. config key). */
  name: string;
  /** Extension metadata from deployment config (e.g. capabilities). */
  extension: { capabilities: string[] };
  /** Obfuscated/sanitized admin config to display. */
  record?: Record<string, unknown>;
  /** Optional icon component; extensions may render it next to the name. */
  ExtensionIcon?: React.ComponentType<{ className?: string }>;
};

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
  /** Optional component to render extension admin card content; receives sanitized config. */
  getExtensionAdminCard?: () => React.ComponentType<ExtensionAdminCardProps>;
}

export interface ExtensionAdminActionHandler {
  name: string;
  handler: (ctx: Context, formData: FormData) => Promise<ExtensionCheckHandleActionResult>;
}

export interface ServerExtension extends ClientExtension {
  registerRoutes?: (appConfig: AppConfig) => Promise<RouteRegistration[]>;
  getJobs?: () => JobRegistration[];
  /**
   * Returns the effective configuration for this extension.
   * If not provided, the platform uses the extension's slice of app config.
   * Implement to merge overrides (e.g. from DB) or customise resolution.
   */
  getExtensionConfiguration?: (ctx: Context) => Promise<Record<string, unknown> | undefined>;
  /** Returns safe admin config for platform UI; must obfuscate secrets. Only called server-side. */
  getSafeAdminConfig?: (config: Record<string, unknown>) => Record<string, unknown>;
  getExtensionAdminActionHandlers?: () => ExtensionAdminActionHandler[];
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
