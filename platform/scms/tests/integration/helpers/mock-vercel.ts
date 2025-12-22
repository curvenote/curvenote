import { vi } from 'vitest';

export interface JobsEndpointCall {
  url: string;
  payload: {
    job_type: string;
    payload: {
      site_id: string;
      user_id: string;
      submission_version_id: string;
      cdn: string;
      key: string;
      date_published?: string;
    };
  };
}

let jobsEndpointCalls: JobsEndpointCall[] = [];

export const mockWaitUntil = (promise: Promise<any>) => {
  return promise;
};

export const mockFetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
  if (url.endsWith('/jobs')) {
    jobsEndpointCalls.push({
      url,
      payload: JSON.parse(options.body as string),
    });

    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
  }
  return Promise.resolve(new Response());
});

export function verifyJobsEndpointCalled(params: {
  jobType: string;
  siteId: string;
  userId: string;
  submissionVersionId: string;
  cdn: string;
  key: string;
  datePublished?: string;
}) {
  const matchingCall = jobsEndpointCalls.find(
    (jobCall) =>
      jobCall.payload.job_type === params.jobType.toLowerCase() &&
      jobCall.payload.payload.site_id === params.siteId &&
      jobCall.payload.payload.user_id === params.userId &&
      jobCall.payload.payload.submission_version_id === params.submissionVersionId &&
      jobCall.payload.payload.cdn === params.cdn &&
      jobCall.payload.payload.key === params.key &&
      jobCall.payload.payload.date_published === params.datePublished,
  );

  return !!matchingCall;
}

export function getJobsEndpointCalls() {
  return [...jobsEndpointCalls];
}

export function clearJobsEndpointCalls() {
  jobsEndpointCalls = [];
}

// Setup function to be called in test setup
export function setupVercelMocks() {
  vi.mock('@vercel/fetch', () => ({
    waitUntil: mockWaitUntil,
  }));

  // Mock the global fetch
  global.fetch = mockFetch;

  // Reset calls before each test
  clearJobsEndpointCalls();
}
