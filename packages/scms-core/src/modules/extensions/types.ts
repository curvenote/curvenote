import type { RouteConfigEntry } from '@react-router/dev/routes';
import type { MenuContents } from '../../components/navigation/types.js';
import type { Context, ExtensionEmailTemplate, StorageBackend } from '../../backend/types.js';
import type { CreateJob } from '../../backend/loaders/jobs/types.js';
import type { WorkflowRegistration } from '../../workflow/types.js';
import type { ScopeTree } from '../../scopes.js';

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

export type WorkCreateFormMode = 'standalone' | 'composite';

/** Declarative create-work entry registered by the platform or an extension. */
export interface WorkCreateOption {
  id: string;
  label: string;
  description?: string;
  /** Optional icon shown in create-work dropdown menu items. */
  icon?: IconComponent;
  /** Top-level workVersion.metadata key that identifies this flow on existing works. */
  metadataKey: string;
  /** App-absolute path that starts the create flow (e.g. `/app/works/new`). */
  startPath: string;
  mode?: WorkCreateFormMode;
  scopes?: string[];
  /** Present when the option is supplied by an extension. */
  extensionId?: string;
  order?: number;
}

/** @deprecated Use WorkCreateOption */
export type ExtensionWorkCreateOption = WorkCreateOption;

export interface ExtensionCreateWorkVersionArgs {
  ctx: Context;
  workId: string;
  sourceVersionMetadata: Record<string, unknown>;
  defaultTitle: string;
}

/**
 * Result of an extension-owned "create new work version" flow.
 *
 * When `createWorkVersion` creates a `WorkVersion` directly (via Prisma or a server helper),
 * it must set `WorkVersion.contains` for that version and merge those labels into `Work.contains`.
 * Use `resolveVersionContains` and `mergeWorkContains` from `@curvenote/scms-server`.
 */
export interface ExtensionCreateWorkVersionResult {
  success: boolean;
  redirectPath?: string;
  workVersionId?: string;
  error?: string;
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
  /** @deprecated Use CheckServiceRun.status column. */
  status?: string;
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
  /** True when a hydrate/sync intent mutated check run data (skip revalidation when false). */
  updated?: boolean;
  /** Optional acceptance gating for check execution flows. */
  requireEula?: boolean;
  requiresEula?: boolean;
  accepted?: boolean;
  version?: string;
  acceptedAt?: string;
  eula?: { version?: string; html?: string; url?: string };
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
  /**
   * When false, extensions must hide dispatch controls (run, retry, accept EULA, etc.).
   * The platform also omits `remoteStatusActionPath` so fetcher forms cannot post.
   */
  canDispatchChecks?: boolean;
  /** POST target for check UI mutations (extension-owned route or legacy work checks path). */
  remoteStatusActionPath?: string;
  /**
   * ISO timestamp from **check_service_run.date_modified** when displaying an existing run.
   * Extensions may use this (vs mount timers) to decide when to offer refresh / stale hints.
   */
  checkRunDateModified?: string;
  /**
   * When true, this check run's UI should be expanded/open by default on initial render.
   * Used for one-shot behaviours such as hydrating remote status on work details load.
   * Omitted on routes that do not compute it (treated as false).
   */
  defaultExpanded?: boolean;
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
  /** Check service id from the run row. */
  checkKind: string;
  metadata: unknown;
  /** POST target for check UI mutations. Omitted when the user cannot dispatch checks. */
  remoteStatusActionPath?: string;
  /** When false, mount-only sync must not enqueue or retry checks. */
  canDispatchChecks?: boolean;
  /** See `ExtensionCheckSectionActivityProps.defaultExpanded`. */
  defaultExpanded?: boolean;
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

/**
 * Props for compact check summary content rendered inside platform-owned work-list rows.
 * Extensions should render only the service-specific content (logo, score, status text/chip).
 * The platform owns row layout, link behaviour, spacing, and version tags.
 */
export type ExtensionCheckWorkListSummaryProps = {
  /** Check run `serviceData` (extension-defined shape). */
  metadata: any;
  checkRunId: string;
  workVersionId: string;
  /** Check service id from the run row. */
  checkServiceId: string;
  /** Display name from the registered check service. */
  checkServiceName: string;
  /** ISO timestamp from **check_service_run.date_modified**. */
  checkRunDateModified: string;
  /** Render a smaller version for compact contexts like timeline popovers. */
  compact?: boolean;
};

export type UploadCheckEligibilityStatus = 'eligible' | 'warning' | 'ineligible';

export interface UploadCheckEligibilityResult {
  status: UploadCheckEligibilityStatus;
  /** Advisory or hard-fail copy from the extension. */
  message?: string;
}

/** Props for per-check upload option cards on the work upload page. */
export interface UploadCheckOptionProps {
  workVersionId: string;
  enabled: boolean;
  /** Files on the draft do not meet this check's requirements; card cannot be enabled. */
  disabled?: boolean;
  /** Check is selected but uploaded files no longer meet requirements. */
  invalid?: boolean;
  /** Advisory state: card renders with warning chrome but does not block submission. */
  warning?: boolean;
  /** Message shown when `warning` is true (from extension eligibility evaluation). */
  warningMessage?: string;
  /** Facts derived from upload preview/analysis; extensions may use for custom copy. */
  eligibilityContext?: UploadCheckEligibilityContext;
  /** Service manifest logo URL when available. */
  logoUrl?: string;
  /** Platform persists selection via `toggle-check` on the upload route. */
  setEnabled: (enabled: boolean) => Promise<void>;
  /** True while this check's `toggle-check` action is in flight. */
  toggleBusy?: boolean;
}

export type UploadFactPresence = 'present' | 'absent' | 'unknown';

export interface UploadCheckEligibilityContext {
  document: {
    images: UploadFactPresence;
  };
  metadata: {
    title: UploadFactPresence;
    authors: UploadFactPresence;
    affiliations: UploadFactPresence;
  };
}

export interface ExtensionCheckService {
  id: string; // e.g., 'curvenote-structure'
  name: string; // Display name
  description: string; // Display description
  /**
   * App-absolute path for extension-owned check actions.
   * When set, the platform uses this for `remoteStatusActionPath` on the checks page and work timeline.
   */
  checksActionPath?: string;
  // Client-side component to render on checks screen
  sectionHeaderComponent: React.ComponentType<{
    tag: React.ReactNode;
    /**
     * Optional action slot (e.g. "Run on latest version" button) justified to the far right of
     * the header. Supplied by the platform when contextually appropriate; extensions should render
     * it in their header layout.
     */
    action?: React.ReactNode;
    /**
     * Same shape as {@link ExtensionCheckSectionActivityProps.metadata} — the `serviceData`
     * of the run being displayed at the top card. Extensions can read run-stamped branding
     * (e.g. a service manifest snapshot) from here without needing admin config access.
     * `undefined` when no run exists yet for this service.
     */
    metadata?: any;
  }>;
  sectionActivityComponent: React.ComponentType<ExtensionCheckSectionActivityProps>;
  /** Optional summary badge for timeline (e.g. "All clear", "2 problems", "Awaiting review"). Same metadata as sectionActivityComponent. */
  sectionSummaryBadgeComponent?: React.ComponentType<{ metadata: any }>;
  /**
   * Optional title region for the timeline row (e.g. service logo). When set, replaces the default
   * `{name}` segment; the platform always appends the word “checks” on the same line with spacing.
   */
  sectionSummaryTitleComponent?: React.ComponentType<ExtensionCheckSectionSummaryTitleProps>;
  /**
   * Optional compact content for My Works list rows. Platform supplies the containing row,
   * right-alignment, link target, and version tag; extensions supply only the inner content.
   */
  workListSummaryComponent?: React.ComponentType<ExtensionCheckWorkListSummaryProps>;
  /**
   * Optional visibility predicate for My Works list summaries. Return false for states that
   * should not appear in the listing, such as failed/error runs.
   */
  isWorkListSummaryVisible?: (metadata: any) => boolean;
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
  /**
   * Optional upload-page check card body (platform `UploadCheckOptionCard` supplies border + toggle-off).
   * When omitted, platform uses default name + description layout.
   */
  uploadCheckOptionComponent?: React.ComponentType<UploadCheckOptionProps>;
  /**
   * Full upload eligibility evaluation including advisory warnings.
   * When set, takes precedence over `isUploadEligible`.
   */
  resolveUploadEligibility?: (
    metadata: unknown,
    context?: UploadCheckEligibilityContext,
  ) => UploadCheckEligibilityResult;
  /**
   * True when current work-version metadata satisfies this check's hard upload requirements.
   * Used when `resolveUploadEligibility` is not set. Warnings require `resolveUploadEligibility`.
   */
  isUploadEligible?: (metadata: unknown, context?: UploadCheckEligibilityContext) => boolean;
  /** Server-side action handler. Used from upload flow (intent `execute` + job enqueue). */
  handleAction?: (
    args: ExtensionCheckHandleActionArgs,
  ) => Promise<ExtensionCheckHandleActionResult>;
  /** Get current status of a check run. */
  handleStatus?: (args: ExtensionCheckStatusArgs) => Promise<Response>;
  /**
   * Resolve manifest logo URL for the upload-page check card.
   * When omitted, the platform does not supply a `logoUrl` for this service.
   */
  resolveUploadLogoUrl?: (ctx: Context) => Promise<string | undefined>;
}

export type ClientExtensionCheckService = Omit<
  ExtensionCheckService,
  'handleAction' | 'handleStatus' | 'resolveUploadLogoUrl'
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
  /** Optional create-work menu entries keyed by work-version metadata. */
  getWorkCreateOptions?: () => WorkCreateOption[];
  getIcons?: () => ExtensionIcon[];
  getAnalyticsEvents?: () => ExtensionAnalyticsEvents;
  getEmailTemplates?: () => ExtensionEmailTemplate[];
  getWorkflows?: () => WorkflowRegistration;
  getChecks?: () => ClientExtensionCheckService[];
  registerNavigation: NavigationRegistrationFn;
  /** Optional component to render extension admin card content; receives sanitized config. */
  getExtensionAdminCard?: () => React.ComponentType<ExtensionAdminCardProps>;
  /**
   * Optional component to render on the system Design page as an extension-owned tab.
   * The platform shows one tab per extension that returns a component, using the
   * extension's `name` as the tab label. Extensions can use this surface to showcase
   * their own UI components and various visual states.
   */
  getDesigns?: () => React.ComponentType;
}

export interface ExtensionAdminActionHandler {
  name: string;
  handler: (ctx: Context, formData: FormData) => Promise<ExtensionCheckHandleActionResult>;
}

export interface ServerExtension extends ClientExtension {
  registerRoutes?: (appConfig: AppConfig) => Promise<RouteRegistration[]>;
  /**
   * Create a new draft work version for an existing work when the resolved create option
   * belongs to this extension. Return null when this extension does not handle the request.
   * Implementations must set `WorkVersion.contains` and merge into `Work.contains` (see
   * `ExtensionCreateWorkVersionResult`).
   */
  createWorkVersion?: (
    args: ExtensionCreateWorkVersionArgs,
  ) => Promise<ExtensionCreateWorkVersionResult | null>;
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
  /**
   * Advertise the scopes this extension defines. Returns a (usually nested)
   * tree of scope strings whose leaves are the concrete scope identifiers the
   * extension owns, e.g. `{ app: { sites: { read: 'ext:app:sites:read' } } }`.
   *
   * All extension-defined scope strings MUST start with the `ext:` prefix so
   * they are disjoint from the platform's core `system:` / `site:` / `work:`
   * / `app:` namespaces. The platform uses this to discover which scopes are
   * backed by an enabled extension without consumers having to know about
   * specific extension identifiers.
   */
  getScopes?: () => ScopeTree;
  /**
   * Optional loader data for this extension's tab on the system Design page.
   * Exposed as `extensionDesignLoaderData[extension.id]` on that route's loader and
   * provided to the tab via `ExtensionDesignTabLoaderDataProvider` (read with
   * `useExtensionDesignLoaderData()` inside extension design components).
   */
  getDesignLoaderData?: (ctx: Context) => Promise<Record<string, unknown>>;
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
