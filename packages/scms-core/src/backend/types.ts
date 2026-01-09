import type { ResendEventType } from '../services/emails/types.js';
import type { AllTrackEvent } from './services/analytics/events.js';
import type { EventOptions } from '../utils/analytics.js';

export interface GeneralError {
  type: 'general';
  message: string;
  items?: any[];
  details?: Record<string, any>;
}

export interface FormError {
  type?: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Type definition for Context class from scms-server.
 * This allows scms-core to reference the Context type without depending on scms-server.
 * The actual Context implementation is in @curvenote/scms-server.
 */
export type ModifyUrl = (url: string) => string;

export interface Context {
  /** The current request */
  request: Request;
  /** Array of scopes the current user has */
  scopes: string[];
  /** User object if authenticated */
  user?: any; // MyUserDBO & { email_verified: boolean } - using any to avoid circular dependency
  /** Configuration object */
  $config: any; // Awaited<ReturnType<typeof getConfig>> - using any to avoid circular dependency
  /** Function to modify URLs for API endpoints */
  asApiUrl: ModifyUrl;
  /** Function to modify URLs for base paths */
  asBaseUrl: ModifyUrl;
  /** Authorization status */
  authorized: {
    user: boolean;
    preview: boolean;
    curvenote: boolean;
    handshake: boolean;
  };
  /** Token information */
  token: {
    preview?: string;
    curvenote?: string;
    handshake?: string;
    session: boolean;
  };
  /** Claims from tokens */
  claims: {
    preview?: any;
    handshake?: any;
    curvenote?: any;
  };
  /** Resend email client */
  resend: any; // Resend - using any to avoid circular dependency
  /** Analytics context */
  analytics: any; // AnalyticsContext - using any to avoid circular dependency

  /** Initialize context from another context instance */
  initializeFrom(ctx: Context): void;
  /** Get set of private CDN URLs */
  privateCdnUrls(): Set<string>;
  /** Verify a preview token */
  verifyPreviewToken(token: string): void;
  /** Verify a Curvenote session token */
  verifyCurvenoteSessionToken(token: string): Promise<void>;
  /** Verify a handshake token */
  verifyHandshakeToken(token: string): Promise<void>;
  /** Verify a session from session storage */
  verifySession(session: any): Promise<void>; // Session - using any to avoid circular dependency
  /** Send a Slack notification */
  sendSlackNotification(message: any): Promise<void>; // SlackMessage - using any to avoid circular dependency
  /** Send an email */
  sendEmail<T extends ResendEventType, P extends object>(
    email: any, // TemplatedResendEmail<T, P> - using any to avoid circular dependency
    extensionTemplates?: ExtensionEmailTemplate[],
  ): Promise<void>;
  /** Send a batch of emails */
  sendEmailBatch<T extends ResendEventType, P extends object>(
    emails: any[], // TemplatedResendEmail<T, P>[] - using any to avoid circular dependency
    extensionTemplates?: ExtensionEmailTemplate[],
  ): Promise<void>;
  /** Identify a user for analytics tracking */
  identifyEvent(user?: any): Promise<void>; // User - using any to avoid circular dependency
  /** Track an analytics event */
  trackEvent(
    event: AllTrackEvent,
    properties?: Record<string, any>,
    opts?: EventOptions,
  ): Promise<void>;
}

/**
 * Type definition for StorageBackend class from scms-server.
 * This allows scms-core to reference the StorageBackend type without depending on scms-server.
 * The actual StorageBackend implementation is in @curvenote/scms-server.
 */
export enum KnownBuckets {
  staging = 'staging',
  hashstore = 'hashstore',
  tmp = 'tmp',
  cdn = 'cdn',
  prv = 'prv',
  pub = 'pub',
}

export interface StorageBackend {
  /** Concurrency limit for operations */
  concurrency: number;
  /** Array of CDN URLs */
  cdns: string[];
  /** Buckets map */
  buckets: Record<string, any>; // Record<string, Bucket> - using any to avoid circular dependency

  /** Get summary of storage backend configuration */
  summarise(): {
    names: string[];
    cdns: string[];
    info: Record<string, any>; // Record<KnownBuckets, KnownBucketInfo>
  };

  /** Ensure connection to a specific bucket */
  ensureConnection(bucket: KnownBuckets): void;

  /** Get known bucket name from CDN URL */
  knownBucketFromCDN(cdnMaybeWithSlash: string): KnownBuckets | null;

  /** Get CDN URL from known bucket name */
  cdnFromKnownBucket(bucket: KnownBuckets): string | undefined;

  /** Signed link expiry times */
  expiry: {
    read: number; // seconds
    write: number; // seconds
  };
}

export interface ExtensionEmailTemplate {
  eventType: string;
  component: React.ComponentType<any>;
  props: Record<string, any>;
  templateInfo?: {
    name: string;
    description: string;
    exampleSubject: string;
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'email' | 'url' | 'textarea' | 'boolean';
      optional?: boolean;
      example: string | boolean;
    }>;
  };
}
