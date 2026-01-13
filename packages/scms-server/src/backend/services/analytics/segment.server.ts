import type {
  AliasParams,
  GroupParams,
  HTTPClient,
  HTTPClientRequest,
  HTTPFetchFn,
  HTTPResponse,
  IdentifyParams,
  PageParams,
  TrackParams,
} from '@segment/analytics-node';
import { Analytics } from '@segment/analytics-node';
import type { Segment as SegmentConfig } from '@/types/app-config.js';
import type { User } from '@prisma/client';
import type { AllTrackEvent } from '@curvenote/scms-core';

/**
 * Context for handling all analytics events.
 *
 * Currently only includes Segment, but may be extended for other providers.
 */
export class AnalyticsContext {
  loggedMissingWriteKey: boolean = false;
  segment?: ReturnType<typeof createSegment>;

  constructor() {
    this.segment = undefined;
    this.loggedMissingWriteKey = false;
  }

  async flush(): Promise<void> {
    await this.segment?.flush();
  }

  /**
   * Identify an event for a user. Only called if user is defined.
   * @param user - The user to identify.
   */
  async identifyEvent(user: User): Promise<void> {
    await this.segment?.identify({
      userId: user.id,
      traits: {
        email: user.email,
        name: user.display_name,
        username: user.username,
        primaryProvider: user.primaryProvider,
        pending: user.pending,
        disabled: user.disabled,
        readyForApproval: user.ready_for_approval,
        system_role: user.system_role,
      },
    });
  }

  async trackEvent(
    event: AllTrackEvent,
    userId: string,
    properties: Record<string, any>,
    request?: Request,
  ): Promise<void> {
    const data: TrackParams = {
      userId,
      event: event as string,
      properties: {
        ...(request ? collectRequestProperties(request) : {}),
        ...(request ? collectVercelOriginalHeaders(request) : {}),
        ...properties,
      },
    };
    // if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    //   console.log('Track event:', data);
    // }
    await this.segment?.track(data);
  }
}

/**
 * Default HTTP client implementation using fetch
 */
class SafeHTTPClient implements HTTPClient {
  private _fetch: HTTPFetchFn;
  constructor(fetchFn?: HTTPFetchFn) {
    this._fetch = fetchFn ?? fetch;
  }
  async makeRequest(options: HTTPClientRequest): Promise<HTTPResponse> {
    return this._fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: null,
    });
  }
}

export function addSegmentAnalytics(
  analytics: AnalyticsContext,
  config?: SegmentConfig,
): AnalyticsContext {
  const { disabled, writeKey } = config ?? {};
  if (disabled) return analytics;
  if (!writeKey && !analytics.loggedMissingWriteKey) {
    console.warn('Missing Segment write key, analytics will not be sent');
    analytics.loggedMissingWriteKey = true;
  }
  if (analytics.segment || !writeKey) return analytics;
  const httpClient = new SafeHTTPClient();
  const segmentAnalyticsInstance = new Analytics({
    writeKey,
    httpRequestTimeout: 20000,
    httpClient,
    flushAt: 1,
  }).on('error', console.error);
  analytics.segment = createSegment(segmentAnalyticsInstance);
  return analytics;
}

// ensure serverless compatibility
// https://segment.com/docs/connections/sources/catalog/libraries/server/node/#usage-in-serverless-environments
const createSegment = (analytics: Analytics | null) => {
  const identify = async (data: IdentifyParams) => {
    return new Promise((resolve) => (analytics ? analytics.identify(data, resolve) : null));
  };
  const track = async (data: TrackParams) => {
    return new Promise((resolve) => (analytics ? analytics.track(data, resolve) : null));
  };
  const page = async (data: PageParams) => {
    return new Promise((resolve) => (analytics ? analytics.page(data, resolve) : null));
  };
  const alias = async (data: AliasParams) => {
    return new Promise((resolve) => (analytics ? analytics.alias(data, resolve) : null));
  };
  const group = async (data: GroupParams) => {
    return new Promise((resolve) => (analytics ? analytics.group(data, resolve) : null));
  };
  const flush = async () => {
    await analytics?.flush();
  };
  return {
    identify,
    track,
    page,
    alias,
    group,
    flush,
  };
};

const VERCEL_HEADERS = [
  { from: 'x-forwarded-host', to: 'host' },
  { from: 'x-vercel-forwarded-for', to: 'ip' },
  { from: 'x-vercel-ip-continent', to: 'continent' },
  { from: 'x-vercel-ip-country', to: 'country' },
  { from: 'x-vercel-ip-country-region', to: 'country-region' },
  { from: 'x-vercel-ip-city', to: 'city' },
  { from: 'x-vercel-ip-latitude', to: 'latitude' },
  { from: 'x-vercel-ip-longitude', to: 'longitude' },
  { from: 'x-vercel-ip-timezone', to: 'timezone' },
  { from: 'x-vercel-ip-postal-code', to: 'postal-code' },
];

// https://vercel.com/docs/edge-network/headers/request-headers
function collectVercelOriginalHeaders(request: Request) {
  return VERCEL_HEADERS.reduce<Record<string, string>>((acc, { from, to }) => {
    const value = request.headers.get(from);
    if (value) acc[to] = value;
    return acc;
  }, {});
}

function collectRequestProperties(request: Request) {
  const userAgent = request.headers.get('user-agent');
  return {
    url: request.url,
    pathname: new URL(request.url).pathname,
    origin: request.headers.get('origin'),
    referrer: request.headers.get('referer'),
    userAgent,
    userAgentSimplified: simplifyUserAgent(userAgent),
  };
}

export function looksCrossOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const referer = request.headers.get('referer');
  const requestOrigin = request.headers.get('origin');

  if (requestOrigin) {
    return requestOrigin !== origin;
  }

  if (referer) {
    return !referer.startsWith(origin);
  }

  return false;
}

function simplifyUserAgent(userAgent: string | null) {
  if (!userAgent) return null;
  let device = 'Other device';
  let browser = 'Other browser';
  // Order matters - some user agents contain multiple of these device/browser values
  // Especially Android before Linux and Chrome before Safari
  if (userAgent.includes('Macintosh')) {
    device = 'Mac';
  } else if (userAgent.includes('Windows')) {
    device = 'Windows';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    device = 'iOS';
  } else if (userAgent.includes('Android')) {
    device = 'Android';
  } else if (userAgent.includes('Linux')) {
    device = 'Linux';
  } else if (userAgent.includes('CrOS')) {
    device = 'ChromeOS';
  }
  if (userAgent.includes('Edg/') || userAgent.includes('Edge/')) {
    browser = 'Edge';
  } else if (userAgent.includes('OPR/')) {
    browser = 'Opera';
  } else if (userAgent.includes('Firefox/') || userAgent.includes('FxiOS/')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Chrome/') || userAgent.includes('CriOS/')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari/')) {
    browser = 'Safari';
  }
  return `${device} - ${browser}`;
}
