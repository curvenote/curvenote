// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@app-config/main';

/**
 * Configuration for the Curvenote SCMS
 */
export interface Config {
  api: API;
  app: App;
  auth?: Auth;
  name: string;
}

export interface API {
  analyticsSecret: string;
  authCookieSecret: string;
  checkProjectId: string;
  checkSASecretKeyfile: string;
  checkTopic: string;
  databaseUrl: string;
  editorApiUrl: string;
  handshakeIssuer: string;
  handshakeSigningSecret: string;
  /**
   * JWT integration configuration for external service authentication
   */
  integrations?: Integrations;
  jwtSigningSecret: string;
  knownBucketInfoMap: KnownBucketInfoMap;
  previewIssuer: string;
  previewSigningSecret: string;
  privateCDNSigningInfo:   { [key: string]: any };
  privateSiteClaimSubject: string;
  propertyPublicKey: string;
  /**
   * Resend integration configuration for emails
   */
  resend?: Resend;
  /**
   * Segment integration configuration for analytics
   */
  segment?: Segment;
  sessionSecret: string;
  sessionTokenAudience: string;
  sessionTokenIssuer: string;
  /**
   * Slack integration configuration for notifications
   */
  slack?: Slack;
  storageSASecretKeyfile: string;
  submissionsServiceAccount: SubmissionsServiceAccount;
  tokenConfigUrl: string;
  url: string;
  userTokenAudience: string;
  userTokenIssuer: string;
  vercel?: Vercel;
}

/**
 * JWT integration configuration for external service authentication
 */
export interface Integrations {
  /**
   * JWT token issuer - the endpoint URL for this service
   */
  issuer: string;
  /**
   * RSA private key in JWK format for token signing
   */
  privateKey: PrivateKey;
  /**
   * RSA public key in JWK format for token verification
   */
  publicKey: PublicKey;
  /**
   * Default expiry duration for integration tokens (e.g., "1m", "30m", "2d")
   */
  tokenExpiryDuration?: string;
}

/**
 * RSA private key in JWK format for token signing
 */
export interface PrivateKey {
  /**
   * Algorithm, must be RS256
   */
  alg: Alg;
  /**
   * RSA private exponent (base64url encoded)
   */
  d: string;
  /**
   * d mod (p-1) (base64url encoded)
   */
  dp: string;
  /**
   * d mod (q-1) (base64url encoded)
   */
  dq: string;
  /**
   * RSA public key exponent (base64url encoded)
   */
  e: string;
  /**
   * Key ID for key rotation and identification
   */
  kid: string;
  /**
   * Key type, must be RSA
   */
  kty: Kty;
  /**
   * RSA public key modulus (base64url encoded)
   */
  n: string;
  /**
   * First prime factor (base64url encoded)
   */
  p: string;
  /**
   * Second prime factor (base64url encoded)
   */
  q: string;
  /**
   * q^-1 mod p (base64url encoded)
   */
  qi: string;
  /**
   * Key usage, must be signature
   */
  use: Use;
}

/**
 * Algorithm, must be RS256
 */
export enum Alg {
  Rs256 = 'RS256',
}

/**
 * Key type, must be RSA
 */
export enum Kty {
  RSA = 'RSA',
}

/**
 * Key usage, must be signature
 */
export enum Use {
  Sig = 'sig',
}

/**
 * RSA public key in JWK format for token verification
 */
export interface PublicKey {
  /**
   * Algorithm, must be RS256
   */
  alg: Alg;
  /**
   * RSA public key exponent (base64url encoded)
   */
  e: string;
  /**
   * Key ID for key rotation and identification
   */
  kid: string;
  /**
   * Key type, must be RSA
   */
  kty: Kty;
  /**
   * RSA public key modulus (base64url encoded)
   */
  n: string;
  /**
   * Key usage, must be signature
   */
  use: Use;
}

export interface KnownBucketInfoMap {
  cdn: CDN;
  hashstore: CDN;
  prv: CDN;
  pub: CDN;
  staging: CDN;
  tmp: CDN;
}

export interface CDN {
  cdn?: string;
  uri: string;
}

/**
 * Resend integration configuration for emails
 */
export interface Resend {
  /**
   * Resend API key for sending emails
   */
  apiKey?: string;
  /**
   * Whether Resend email sending is disabled
   */
  disabled?: boolean;
  /**
   * Default from email address in format "Name <email@example.com>"
   */
  fromEmail?: string;
}

/**
 * Segment integration configuration for analytics
 */
export interface Segment {
  /**
   * If provided, this user ID will be used on anonymous analytics events
   */
  anonymousUserId?: string;
  /**
   * Whether Segment analytics are disabled
   */
  disabled?: boolean;
  /**
   * Segment write key for sending analytics events
   */
  writeKey?: string;
}

/**
 * Slack integration configuration for notifications
 */
export interface Slack {
  /**
   * Whether Slack notifications are disabled
   */
  disabled?: boolean;
  /**
   * Slack webhook URL for sending notifications
   */
  webhookUrl?: string;
}

export interface SubmissionsServiceAccount {
  id: string;
}

export interface Vercel {
  cron?: Cron;
}

export interface Cron {
  /**
   * Secret key for securing cron job endpoints
   */
  secret: string;
}

export interface App {
  adminUrl: string;
  branding?: Branding;
  /**
   * The default route to redirect to when accessing /app
   */
  defaultRoute?: string;
  editorUrl: string;
  extensions?: Extensions;
  navigation: NavigationElement[];
  renderServiceUrl?: string;
  /**
   * Configuration for sign-in page behavior
   */
  signin?: Signin;
  /**
   * Configuration for sign-up page behavior and flow
   */
  signup?: Signup;
  /**
   * Configuration for the status bar at the bottom of the application
   */
  statusBar?: StatusBar;
  strings?: Strings;
  /**
   * Support email address for user contact
   */
  supportEmail?: string;
}

export interface Branding {
  description?: string;
  icon?: string;
  iconDark?: string;
  logo?: string;
  logoDark?: string;
  logoEmail?: string;
  poweredBy?: boolean;
  showLoginLink?: boolean;
  splash?: string;
  subtitle?: string;
  /**
   * Support email address for user contact
   */
  supportEmail?: string;
  title?: string;
  /**
   * Welcome content to display on the dashboard
   */
  welcome?: Welcome;
}

/**
 * Welcome content to display on the dashboard
 */
export interface Welcome {
  /**
   * Main paragraph of the welcome content
   */
  description?: string;
  /**
   * Whether to show the tasks section on the dashboard
   */
  showTasks?: boolean;
  /**
   * Tagline of the welcome content
   */
  tagline?: string;
  /**
   * Title of the welcome content
   */
  title?: string;
  /**
   * Welcome videos to display on the dashboard
   */
  videos?: VideoElement[];
}

/**
 * Video URL and metadata
 */
export interface VideoElement {
  /**
   * URL to the video thumbnail image
   */
  thumbnail?: string;
  /**
   * Title of the video
   */
  title: string;
  /**
   * URL to the video file
   */
  url: string;
}

export interface Extensions {
  /**
   * Sites Extension Module Configuration
   */
  sites?: SitesExtensionModule;
}

/**
 * Sites Extension Module Configuration
 */
export interface SitesExtensionModule {
  /**
   * This extension will register new (prisma) data models and migrations
   */
  dataModels?: boolean;
  /**
   * This extension will register new site navigation items
   */
  navigation?: boolean;
  /**
   * This extension will register new routes
   */
  routes?: boolean;
  /**
   * This extension will register one of more tasks
   */
  task?: boolean;
  /**
   * Video to display in the request site banner
   */
  video?: Video;
  /**
   * This extension will register new workflows
   */
  workflows?: boolean;
}

/**
 * Video to display in the request site banner
 */
export interface Video {
  /**
   * URL to the video thumbnail image
   */
  thumbnail?: string;
  /**
   * Title of the video
   */
  title: string;
  /**
   * URL to the video file
   */
  url: string;
}

export interface NavigationElement {
  end?: boolean;
  icon: string;
  label: string;
  name: string;
  path: string;
  scopes?: string[];
}

/**
 * Configuration for sign-in page behavior
 */
export interface Signin {
  /**
   * Text when user needs to sign up
   */
  alternativePrompt?: string;
  /**
   * Show all providers or just preferred provider
   */
  mode?: Mode;
  /**
   * Provider name to show as preferred (required when mode is 'preferred')
   */
  preferred?: string;
  /**
   * Main sign-in prompt text
   */
  prompt?: string;
}

/**
 * Show all providers or just preferred provider
 */
export enum Mode {
  All = 'all',
  Preferred = 'preferred',
}

/**
 * Configuration for sign-up page behavior and flow
 */
export interface Signup {
  /**
   * Text shown above additional providers button (preferred mode)
   */
  alternativePrompt?: string;
  /**
   * Manual approval configuration
   */
  approval?: Approval;
  /**
   * Show all providers or just preferred provider
   */
  mode?: Mode;
  /**
   * Provider name to show as preferred (required when mode is 'preferred')
   */
  preferred?: string;
  /**
   * Message shown in the signup progress component
   */
  progressMessage?: string;
  /**
   * Sign-up page prompt text
   */
  prompt?: string;
  /**
   * Signup flow steps
   */
  steps?: Step[];
}

/**
 * Manual approval configuration
 */
export interface Approval {
  /**
   * Require manual approval after signup completion
   */
  manual?: boolean;
  /**
   * Provider names that skip manual approval
   */
  skipApproval?: string[];
}

export interface Step {
  /**
   * Agreement URLs to display (agreement step only)
   */
  agreementUrls?: AgreementURL[];
  /**
   * Alternative prompts for specific providers (link-providers step only)
   */
  alternativePrompts?: AlternativePrompt[];
  /**
   * List of provider names to show (link-providers step only)
   */
  providers?: string[];
  /**
   * Step display title
   */
  title: string;
  /**
   * Type of signup step
   */
  type: StepType;
}

export interface AgreementURL {
  /**
   * Link display text
   */
  label: string;
  /**
   * Link URL
   */
  url: string;
}

export interface AlternativePrompt {
  /**
   * Provider name to show alternative prompt for
   */
  provider: string;
  /**
   * Alternative prompt text for this provider
   */
  text: string;
}

/**
 * Type of signup step
 */
export enum StepType {
  Agreement = 'agreement',
  DataCollection = 'data-collection',
  LinkProviders = 'link-providers',
}

/**
 * Configuration for the status bar at the bottom of the application
 */
export interface StatusBar {
  /**
   * Configurable items to display in the status bar
   */
  items?: ItemElement[];
  /**
   * Configuration for the "Report a Problem" feature in the status bar
   */
  reportProblem?: ReportProblem;
}

export interface ItemElement {
  /**
   * Unique identifier for the status bar item
   */
  name: string;
  /**
   * Position of the item in the status bar
   */
  position: Position;
  /**
   * Component-specific properties based on the type
   */
  properties: Properties;
  /**
   * The type of status bar component to render
   */
  type: ItemType;
}

/**
 * Position of the item in the status bar
 */
export enum Position {
  Left = 'left',
  Right = 'right',
}

/**
 * Component-specific properties based on the type
 */
export interface Properties {
  /**
   * Optional additional text to append to the email body
   */
  body?: string;
  /**
   * Target email address for the mailto link
   */
  email?: string;
  /**
   * Display text for the mailto link
   *
   * Display text for the help request link
   */
  label: string;
  /**
   * Optional subject line for the email
   */
  subject?: string;
  /**
   * Optional description text for the help request dialog
   */
  description?: string;
  /**
   * Optional prompt text to display in the help request dialog
   */
  prompt?: string;
  /**
   * Optional success message to display after submitting the help request
   */
  successMessage?: string;
  /**
   * Optional title for the help request dialog
   */
  title?: string;
}

/**
 * The type of status bar component to render
 */
export enum ItemType {
  MailtoLink = 'mailto-link',
  RequestHelp = 'request-help',
}

/**
 * Configuration for the "Report a Problem" feature in the status bar
 */
export interface ReportProblem {
  /**
   * Email address for problem reports
   */
  email?: string;
  /**
   * Subject line for problem report emails
   */
  subject?: string;
}

export interface Strings {
  signupAdvice?: string;
  signupUrl?: string;
  signupUrlText?: string;
}

export interface Auth {
  firebase?: Firebase;
  google?: Google;
  okta?: Okta;
  orcid?: Orcid;
}

export interface Firebase {
  actionTitle?: string;
  adminLogin?: boolean;
  allowLinking?: boolean;
  clientConfig: string;
  /**
   * Display name for the auth provider shown in UI
   */
  displayName?: string;
  provisionNewUser?: boolean;
  secretKeyfile: string;
}

export interface Google {
  adminLogin?: boolean;
  allowLinking?: boolean;
  clientId: string;
  clientSecret: string;
  /**
   * Display name for the auth provider shown in UI
   */
  displayName?: string;
  provisionNewUser?: boolean;
  redirectUrl: string;
}

export interface Okta {
  adminLogin?: boolean;
  allowLinking?: boolean;
  clientId: string;
  clientSecret: string;
  /**
   * Display name for the auth provider shown in UI
   */
  displayName?: string;
  domain: string;
  provisionNewUser?: boolean;
  redirectUrl: string;
  serverName?: string;
}

export interface Orcid {
  adminLogin?: boolean;
  allowLinking?: boolean;
  allowLogin?: boolean;
  clientId: string;
  clientSecret: string;
  /**
   * Display name for the auth provider shown in UI
   */
  displayName?: string;
  orcidBaseUrl?: string;
  provisionNewUser?: boolean;
  redirectUrl: string;
}

