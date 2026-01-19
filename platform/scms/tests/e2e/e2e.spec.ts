// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeAll, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { loadValidatedConfig } from '@app-config/config';
import { createTestUser, generateTestToken } from './helpers';
import type { UserDBO } from '@curvenote/scms-server';
import { $Enums } from '@curvenote/scms-db';

const PORT = '3032';

// ============================================================================
// App Config Validation Test - Runs FIRST to catch config errors early
// ============================================================================
describe('🔧 App Config Validation', () => {
  test('should load app config successfully for test environment', async () => {
    const environmentOverride =
      process.env.NODE_ENV !== 'production' ? process.env.NODE_ENV : undefined;

    try {
      console.log('\n📋 Validating app config...');
      console.log(`   Environment: ${environmentOverride ?? 'production'}`);
      console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`   APP_CONFIG_ENV: ${process.env.APP_CONFIG_ENV ?? 'not set'}`);

      const config = await loadValidatedConfig({ environmentOverride });

      // Validate that config loaded successfully
      expect(config).toBeDefined();
      expect(config.fullConfig).toBeDefined();

      console.log('✅ App config loaded successfully');
      const fullConfig = config.fullConfig as Record<string, unknown>;
      if (fullConfig && typeof fullConfig === 'object') {
        console.log(`   Config keys: ${Object.keys(fullConfig).join(', ')}`);
      }

      // Check for common required config sections
      if (fullConfig.api) {
        console.log('   ✓ API config present');
      }
      if (fullConfig.app) {
        console.log('   ✓ App config present');
      }
      if (fullConfig.auth) {
        console.log('   ✓ Auth config present');
      }
    } catch (error) {
      console.error('\n❌ FAILED TO LOAD APP CONFIG');
      console.error('='.repeat(80));

      if (error instanceof Error) {
        console.error(`Error Type: ${error.constructor.name}`);
        console.error(`Error Message: ${error.message}`);

        // Try to extract more details if available
        if ('stack' in error && error.stack) {
          console.error('\nStack Trace:');
          console.error(error.stack);
        }

        // Check for common config loading issues
        if (error.message.includes('schema') || error.message.includes('validation')) {
          console.error('\n💡 This appears to be a schema validation error.');
          console.error('   Check your .app-config.test.yml and .app-config.schema.yml files.');
        }

        if (error.message.includes('file') || error.message.includes('not found')) {
          console.error('\n💡 This appears to be a missing file error.');
          console.error('   Ensure .app-config.test.yml exists and is properly formatted.');
        }

        if (error.message.includes('environment')) {
          console.error('\n💡 This appears to be an environment configuration error.');
          console.error('   Check that NODE_ENV and APP_CONFIG_ENV are set correctly.');
        }
      } else {
        console.error('Unknown error:', error);
      }

      console.error('='.repeat(80));
      console.error(
        '\n🚨 TEST SUITE HALTED: App config must load successfully before tests can run.\n',
      );

      // Re-throw to fail the test
      throw error;
    }
  });
});

// NOTE: These tests intentionally trigger HTTP errors (401, 403, 404, 405) to verify
// that the application correctly handles unauthorized access, missing resources, and
// invalid requests. These errors are EXPECTED and indicate the application is working
// correctly by rejecting invalid requests.

// Parse environment variables for test selection
function parseTestConfig() {
  const filesEnv = process.env.TEST_FILES;
  const onlyEnv = process.env.TEST_ONLY;

  return {
    files: filesEnv ? filesEnv.split(',') : undefined,
    only: onlyEnv || undefined,
  };
}

const testConfig = parseTestConfig();

// Log configuration
if (testConfig.files) {
  console.log(`🎯 Running specific test files: ${testConfig.files.join(', ')}`);
}
if (testConfig.only) {
  console.log(`🎯 Running specific test group: ${testConfig.only}`);
}

// Configuration for test selection
const TEST_CONFIG: {
  filterFiles: boolean;
  filesToRun: string[];
  only: string;
} = {
  // Set to true to only run tests from specific files
  // If TEST_FILES env var is set, use filtering; otherwise run all
  filterFiles: !!testConfig.files,
  // List of test files to run (without .yml extension)
  // Environment variables take precedence, then fallback to default
  filesToRun: testConfig.files || [
    'api.anon',
    'app.anon',
    'api.auth',
    'app.auth',
    'app.admin',
    'app.platform-admin',
    'app.pending',
    'app.disabled',
    'sites.user.no-role',
    'sites.user.site-admin',
  ],
  // Set to a test title to only run that specific test
  only: testConfig.only || '',
};

type TestGroup = {
  title: string;
  skip?: boolean;
  only?: boolean;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  cases: TestCase[];
};

type TestFile = {
  title: string;
  url?: string;
  method?: string;
  status?: number;
  system_role?: $Enums.SystemRole;
  site_roles?: { name: string; role: string }[];
  roles?: string[]; // Array of role names to assign to the user
  headers?: Record<string, string>;
  cases: (TestCase | TestGroup)[];
};

type TestCase = {
  title?: string;
  skip?: boolean;
  only?: boolean;
  url?: string;
  method?: string;
  status?: number;
  location?: string;
  followRedirects?: boolean;
  body?: Record<string, any>;
  response?: Record<string, any>;
  headers?: Record<string, string>;
};

// Get all YAML files in the suites directory
const suitesDir = path.join(__dirname, 'suites');
const files = fs
  .readdirSync(suitesDir)
  .filter((file) => file.endsWith('.yml'))
  .filter(
    (file) => !TEST_CONFIG.filterFiles || TEST_CONFIG.filesToRun.includes(file.replace('.yml', '')),
  )
  .map((file) => path.join(suitesDir, file));

// Helper function to format error message
function formatError(
  title: string,
  url: string,
  method: string,
  expectedStatus: number,
  actualStatus: number,
  expectedLocation: string | undefined,
  actualLocation: string | null,
  responseBody: string,
  responseHeaders: Headers,
  validationError?: string,
) {
  const contentType = responseHeaders.get('content-type');
  const isJson = contentType?.includes('application/json');

  let bodyToShow: string;
  if (isJson) {
    try {
      // Try to parse and pretty print JSON
      const parsed = JSON.parse(responseBody);
      bodyToShow = JSON.stringify(parsed, null, 2);
    } catch {
      // If JSON parsing fails, show raw body
      bodyToShow = responseBody;
    }
  } else if (contentType?.includes('text/')) {
    // For text responses, show as is
    bodyToShow = responseBody;
  } else {
    bodyToShow = `[Response body of type ${contentType} - not shown]`;
  }

  const locationInfo = expectedLocation
    ? `\nExpected Location: ${expectedLocation}\nActual Location: ${actualLocation ?? 'none'}`
    : '';

  const headers = Array.from(responseHeaders.entries())
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n');

  const validationInfo = validationError ? `\n\nValidation Errors:\n${validationError}` : '';

  return `
Test: ${title}
Request: ${method} ${url}
Expected Status: ${expectedStatus}
Actual Status: ${actualStatus}${locationInfo}

Response Headers:
${headers}

Response Body:
${actualStatus !== 200 ? bodyToShow : '<response-omitted>'}${validationInfo}
`;
}

const casesList = files
  .map((file) => ({
    filename: path.basename(file, '.yml'),
    data: fs.readFileSync(file).toString(),
  }))
  .map((file) => {
    const tests = load(file.data) as TestFile;
    tests.title = `${file.filename} - ${tests.title ?? 'Tests'}`;
    return tests;
  });

// Helper function to validate response structure
function validateResponseStructure(response: any, expected: Record<string, any>) {
  const validationErrors: string[] = [];

  // Handle exact value assertions first
  if (expected.exact) {
    for (const [key, expectedValue] of Object.entries(expected.exact)) {
      try {
        expect(response[key]).toBe(expectedValue);
      } catch {
        validationErrors.push(`Expected ${key} to be ${expectedValue}, but got ${response[key]}`);
      }
    }
    // Remove exact from expected to avoid double validation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exact: _exact, ...restExpected } = expected;
    expected = restExpected;
  }

  for (const [key, expectedType] of Object.entries(expected)) {
    try {
      // Check if the field exists
      expect(response).toHaveProperty(key);

      // Handle union types (e.g., "string | null")
      if (typeof expectedType === 'string' && expectedType.includes('|')) {
        const types = expectedType.split('|').map((t) => t.trim());
        const value = response[key];
        const isValidType = types.some((type) => {
          if (type === 'string') return typeof value === 'string';
          if (type === 'number') return typeof value === 'number';
          if (type === 'boolean') return typeof value === 'boolean';
          if (type === 'null') return value === null;
          if (type === 'array') return Array.isArray(value);
          if (type === 'object') return typeof value === 'object' && value !== null;
          return false;
        });
        if (!isValidType) {
          validationErrors.push(
            `Expected ${key} to be one of [${types.join(', ')}], but got ${typeof value}`,
          );
        }
      } else if (expectedType === 'array') {
        if (!Array.isArray(response[key])) {
          validationErrors.push(`Expected ${key} to be an array, but got ${typeof response[key]}`);
        }
      } else if (expectedType === 'object') {
        if (typeof response[key] !== 'object' || response[key] === null) {
          validationErrors.push(`Expected ${key} to be an object, but got ${typeof response[key]}`);
        }
      } else {
        if (typeof response[key] !== expectedType) {
          validationErrors.push(
            `Expected ${key} to be of type ${expectedType}, but got ${typeof response[key]}`,
          );
        }
      }
    } catch (error) {
      validationErrors.push(
        `Field ${key} validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (validationErrors.length > 0) {
    const errorMessage = [
      'Response validation failed:',
      '',
      'Expected Response Structure:',
      JSON.stringify(expected, null, 2),
      '',
      'Actual Response:',
      JSON.stringify(response, null, 2),
      '',
      'Validation Errors:',
      ...validationErrors.map((error) => `  - ${error}`),
    ].join('\n');
    throw new Error(errorMessage);
  }
}

// Helper function to run test cases
function runTestCases(tests: TestFile[]) {
  for (const {
    title,
    cases,
    url: fileUrl,
    method: fileMethod,
    status: fileStatus,
    system_role,
    site_roles,
    roles,
    headers: fileHeaders,
  } of tests) {
    // Filter cases based on criteria
    const casesToUse = cases.filter(
      (c) =>
        // Skip if test is marked to skip
        !c.skip &&
        // Skip if we're looking for a specific test and this isn't it
        (!TEST_CONFIG.only || c.title === TEST_CONFIG.only) &&
        // If any test has only=true, only run those tests
        (!cases.some((tc) => tc.only) || c.only),
    );

    const skippedCases = cases.filter(
      (c) =>
        c.skip ||
        (TEST_CONFIG.only && c.title !== TEST_CONFIG.only) ||
        (cases.some((tc) => tc.only) && !c.only),
    );

    if (casesToUse.length === 0) continue;

    // Register describe block synchronously (no async)
    describe(`${title} (as ${system_role ?? 'ANON'})`, () => {
      const titleFn = (c: TestCase | TestGroup) => c.title ?? c.url ?? fileUrl ?? '';
      if (skippedCases.length > 0) {
        test.skip.each(skippedCases.map((c): [string, TestCase | TestGroup] => [titleFn(c), c]))(
          '%s',
          () => {},
        );
      }

      // Store test user and token for use in tests
      let testUser: UserDBO | undefined;
      let testToken: string | undefined;

      // Check if any test case requires authentication
      const needsAuth =
        casesToUse.some((c) => {
          if ('cases' in c) {
            return (
              c.cases &&
              c.cases.some(
                (tc) =>
                  tc.headers?.Authorization?.includes('${') ||
                  tc.headers?.Authorization?.includes('TOKEN'),
              )
            );
          }
          return (
            c.headers?.Authorization?.includes('${') || c.headers?.Authorization?.includes('TOKEN')
          );
        }) ||
        fileHeaders?.Authorization?.includes('${') ||
        fileHeaders?.Authorization?.includes('TOKEN');

      // Use beforeAll for async setup (runs before tests execute)
      if (needsAuth) {
        beforeAll(async () => {
          console.log('Creating test user for authentication...');
          // Determine user options based on test file
          const isPendingTest = title.includes('Pending');
          const isDisabledTest = title.includes('Disabled');

          const userOptions: any = {
            pending: isPendingTest,
            disabled: isDisabledTest,
          };

          // Add site roles from YAML configuration
          if (site_roles && site_roles.length > 0) {
            userOptions.siteRoles = site_roles.map((sr) => ({
              siteName: sr.name,
              role: $Enums.SiteRole[sr.role as keyof typeof $Enums.SiteRole],
            }));
          }

          testUser = await createTestUser(system_role ?? $Enums.SystemRole.USER, {
            ...userOptions,
            roles,
          });
          console.log('Test user created:', testUser?.id);
          testToken = await generateTestToken(testUser);
          console.log('Test token generated:', testToken ? 'YES' : 'NO');
        });
      }

      // Process each case or group
      for (const testCase of casesToUse) {
        if ('cases' in testCase) {
          // This is a group
          const group = testCase;
          // If group has only=true, run all its cases regardless of their only flag
          const groupCases = group.cases
            ? group.cases.filter(
                (c) =>
                  !c.skip &&
                  (!TEST_CONFIG.only || c.title === TEST_CONFIG.only) &&
                  (!group.only || true), // If group has only=true, run all cases
              )
            : [];

          if (groupCases.length === 0) continue;

          describe(group.title, () => {
            test.each(groupCases.map((c): [string, TestCase] => [titleFn(c), c]))(
              '%s',
              async (
                testTitle,
                {
                  url: caseUrl,
                  method: caseMethod,
                  status: caseStatus,
                  location: caseLocation,
                  followRedirects,
                  body,
                  response,
                  headers,
                },
              ) => {
                let url = caseUrl ?? group.url ?? fileUrl;
                const method = caseMethod ?? group.method ?? fileMethod ?? 'GET';
                const status = caseStatus ?? fileStatus;
                const location = caseLocation;
                if (!url || !method || !status) {
                  const missing = [
                    url ? '' : 'url',
                    method ? '' : 'method',
                    status ? '' : 'status',
                  ].filter((m) => m !== '');
                  throw Error(`Test case "${testTitle}" does not define ${missing.join(', ')}`);
                }
                if (url.startsWith('/')) url = url.slice(1);
                const requestBody = body ? JSON.stringify(body) : undefined;

                // Process headers and replace token placeholder
                const processedHeaders: Record<string, string> = {};
                // Merge headers in order of precedence: case > group > file
                const mergedHeaders = { ...fileHeaders, ...group.headers, ...headers };
                for (const [key, value] of Object.entries(mergedHeaders)) {
                  let processedValue = value;
                  // Replace different token placeholders
                  if (processedValue.includes('${TOKEN}')) {
                    processedValue = processedValue.replace('${TOKEN}', testToken ?? '');
                  }
                  if (processedValue.includes('${PLATFORM_ADMIN_TOKEN}')) {
                    processedValue = processedValue.replace(
                      '${PLATFORM_ADMIN_TOKEN}',
                      testToken ?? '',
                    );
                  }
                  if (processedValue.includes('${PENDING_TOKEN}')) {
                    processedValue = processedValue.replace('${PENDING_TOKEN}', testToken ?? '');
                  }
                  if (processedValue.includes('${DISABLED_TOKEN}')) {
                    processedValue = processedValue.replace('${DISABLED_TOKEN}', testToken ?? '');
                  }
                  processedHeaders[key] = processedValue;
                }

                const resp = await fetch(`http://localhost:${PORT}/${url}`, {
                  method,
                  body: requestBody,
                  headers: processedHeaders,
                  redirect: followRedirects ? 'follow' : 'manual',
                });
                const responseBody = await resp.text();
                const actualLocation = resp.headers.get('location');

                try {
                  expect(resp.status).toEqual(status);

                  // For 302 responses, check the location header if specified
                  if (status === 302 && location) {
                    expect(actualLocation).toEqual(location);
                  }

                  // Validate response structure if specified
                  if (response) {
                    const contentType = resp.headers.get('content-type');
                    if (contentType?.includes('application/json')) {
                      const responseData = JSON.parse(responseBody);
                      validateResponseStructure(responseData, response);
                    }
                  }
                } catch (error) {
                  // If it's already a formatted error, just rethrow it
                  if (
                    error instanceof Error &&
                    error.message.includes('Response validation failed:')
                  ) {
                    throw error;
                  }
                  // Otherwise format it as a general error
                  throw new Error();
                  // formatError(
                  //   testTitle,
                  //   url,
                  //   method,
                  //   status,
                  //   resp.status,
                  //   location,
                  //   followRedirects ? resp.url : actualLocation,
                  //   responseBody,
                  //   resp.headers,
                  // ),
                }
              },
            );
          });
        } else {
          // This is a regular test case
          test(titleFn(testCase), async () => {
            const {
              url: caseUrl,
              method: caseMethod,
              status: caseStatus,
              location: caseLocation,
              followRedirects,
              body,
              response,
              headers,
            } = testCase;

            let url = caseUrl ?? fileUrl;
            const method = caseMethod ?? fileMethod ?? 'GET';
            const status = caseStatus ?? fileStatus;
            const location = caseLocation;
            if (!url || !method || !status) {
              const missing = [
                url ? '' : 'url',
                method ? '' : 'method',
                status ? '' : 'status',
              ].filter((m) => m !== '');
              throw Error(`Test case "${testCase.title}" does not define ${missing.join(', ')}`);
            }
            if (url.startsWith('/')) url = url.slice(1);
            const requestBody = body ? JSON.stringify(body) : undefined;

            // Process headers and replace token placeholder
            const processedHeaders: Record<string, string> = {};
            // Merge headers in order of precedence: case > file
            const mergedHeaders = { ...fileHeaders, ...headers };
            for (const [key, value] of Object.entries(mergedHeaders)) {
              let processedValue = value;
              // Replace different token placeholders
              if (processedValue.includes('${TOKEN}')) {
                processedValue = processedValue.replace('${TOKEN}', testToken ?? '');
              }
              if (processedValue.includes('${PLATFORM_ADMIN_TOKEN}')) {
                processedValue = processedValue.replace('${PLATFORM_ADMIN_TOKEN}', testToken ?? '');
              }
              if (processedValue.includes('${PENDING_TOKEN}')) {
                processedValue = processedValue.replace('${PENDING_TOKEN}', testToken ?? '');
              }
              if (processedValue.includes('${DISABLED_TOKEN}')) {
                processedValue = processedValue.replace('${DISABLED_TOKEN}', testToken ?? '');
              }
              processedHeaders[key] = processedValue;
            }

            const resp = await fetch(`http://localhost:${PORT}/${url}`, {
              method,
              body: requestBody,
              headers: processedHeaders,
              redirect: followRedirects ? 'follow' : 'manual',
            });
            const responseBody = await resp.text();
            const actualLocation = resp.headers.get('location');

            try {
              expect(resp.status).toEqual(status);

              // For 302 responses, check the location header if specified
              if (status === 302 && location) {
                expect(actualLocation).toEqual(location);
              }

              // Validate response structure if specified
              if (response) {
                const contentType = resp.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                  const responseData = JSON.parse(responseBody);
                  validateResponseStructure(responseData, response);
                }
              }
            } catch (error) {
              // If it's already a formatted error, just rethrow it
              if (error instanceof Error && error.message.includes('Response validation failed:')) {
                throw error;
              }
              // Otherwise format it as a general error
              throw new Error(
                formatError(
                  testCase.title ?? '',
                  url,
                  method,
                  status,
                  resp.status,
                  location,
                  followRedirects ? resp.url : actualLocation,
                  responseBody,
                  resp.headers,
                ),
              );
            }
          });
        }
      }
    });
  }
}

// Run all test files - call at top level so tests register during discovery
runTestCases(casesList);
