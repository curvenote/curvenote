#!/usr/bin/env node
/* eslint-env node */

/**
 * Fire a small burst of unique search requests at a reader endpoint.
 *
 * Usage:
 *   node scripts/search-load-test.mjs "https://reader.example.com/api/v1/sites/demo/works"
 *
 * Edit SEARCH_PARAMETERS below to change the search mix. Each object is
 * appended as query parameters to the URL passed on the command line.
 */

const TOTAL_DURATION_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

const SEARCH_PARAMETERS = [
  { q: 'Smith', limit: 10 },
  { q: 'Johnson', limit: 10 },
  { q: 'Williams', limit: 10 },
  { q: 'Brown', limit: 10 },
  { q: 'Jones', limit: 10 },
  { q: 'Garcia', limit: 10 },
  { q: 'Miller', limit: 10 },
  { q: 'Davis', limit: 10 },
  { q: 'Rodriguez', limit: 10 },
  { q: 'Martinez', limit: 10 },
  { q: 'Hernandez', limit: 10 },
  { q: 'Lopez', limit: 10 },
  { q: 'Gonzalez', limit: 10 },
  { q: 'Wilson', limit: 10 },
  { q: 'Anderson', limit: 10 },
  { q: 'Thomas', limit: 10 },
  { q: 'Taylor', limit: 10 },
  { q: 'Moore', limit: 10 },
  { q: 'Jackson', limit: 10 },
  { q: 'Martin', limit: 10 },
  { q: 'Lee', limit: 10 },
  { q: 'Perez', limit: 10 },
  { q: 'Thompson', limit: 10 },
  { q: 'White', limit: 10 },
  { q: 'Harris', limit: 10 },
  { q: 'Sanchez', limit: 10 },
  { q: 'Clark', limit: 10 },
  { q: 'Ramirez', limit: 10 },
  { q: 'Lewis', limit: 10 },
  { q: 'Robinson', limit: 10 },
  { q: 'Patel', limit: 10 },
  { q: 'Chen', limit: 10 },
  { q: 'Wang', limit: 10 },
  { q: 'Singh', limit: 10 },
  { q: 'Kim', limit: 10 },
  { q: 'Maria Garcia', limit: 10 },
  { q: 'David Smith', limit: 10 },
  { q: 'Jennifer Lee', limit: 10 },
  { q: 'Michael Brown', limit: 10 },
  { q: 'Sarah Johnson', limit: 10 },
  { q: 'University of California', limit: 10 },
  { q: 'Stanford University', limit: 10 },
  { q: 'Harvard University', limit: 10 },
  { q: 'MIT', limit: 10 },
  { q: 'University of Oxford', limit: 10 },
  { q: 'University of Cambridge', limit: 10 },
  { q: 'NASA', limit: 10 },
  { q: 'NOAA', limit: 10 },
  { q: 'US Geological Survey', limit: 10 },
  { q: 'National Science Foundation', limit: 10 },
];

function usage() {
  console.error('Usage: node scripts/search-load-test.mjs "<reader-search-url>"');
  console.error(
    'Example: node scripts/search-load-test.mjs "https://openrxiv-scms.curvenote.dev/v1/sites/demo/works"',
  );
}

function buildUrl(baseUrl, parameters) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getResultCount(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.total === 'number') return data.total;
    if (Array.isArray(data.items)) return data.items.length;
    if (Array.isArray(data.results)) return data.results.length;
  }
  if (Array.isArray(data)) return data.length;
  return undefined;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return undefined;
  const index = Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1);
  return sortedValues[index];
}

async function fetchWithTimeout(url, index) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, { signal: controller.signal });
    const elapsedMs = Math.round(performance.now() - startedAt);
    const data = await response.json().catch(() => undefined);

    return {
      index,
      url: url.toString(),
      ok: response.ok,
      status: response.status,
      elapsedMs,
      resultCount: getResultCount(data),
    };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    return {
      index,
      url: url.toString(),
      ok: false,
      status: 'ERR',
      elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    usage();
    process.exit(1);
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    console.error(`Invalid URL: ${baseUrl}`);
    usage();
    process.exit(1);
  }

  const uniqueSearches = new Set(SEARCH_PARAMETERS.map((params) => JSON.stringify(params)));
  if (uniqueSearches.size !== SEARCH_PARAMETERS.length) {
    console.error('SEARCH_PARAMETERS must contain unique parameter objects.');
    process.exit(1);
  }

  const intervalMs =
    SEARCH_PARAMETERS.length > 1
      ? Math.floor(TOTAL_DURATION_MS / (SEARCH_PARAMETERS.length - 1))
      : 0;
  const scheduledAt = performance.now();

  console.log(
    `Sending ${SEARCH_PARAMETERS.length} requests over about ${Math.round(
      (intervalMs * (SEARCH_PARAMETERS.length - 1)) / 1000,
    )} seconds to ${parsedBaseUrl.origin}${parsedBaseUrl.pathname}`,
  );

  const requests = SEARCH_PARAMETERS.map(async (parameters, index) => {
    await sleep(intervalMs * index);
    const url = buildUrl(parsedBaseUrl, parameters);
    const result = await fetchWithTimeout(url, index + 1);
    const status = `${result.ok ? 'OK' : 'FAIL'} ${result.status}`;
    const resultCount =
      typeof result.resultCount === 'number' ? ` results=${result.resultCount}` : '';
    console.log(
      `${String(result.index).padStart(2, '0')} ${status} ${String(result.elapsedMs).padStart(
        5,
        ' ',
      )}ms${resultCount} ${url.search}`,
    );
    return result;
  });

  const results = await Promise.all(requests);
  const elapsedMs = Math.round(performance.now() - scheduledAt);
  const failed = results.filter((result) => !result.ok);
  const latencies = results.map((result) => result.elapsedMs).sort((a, b) => a - b);
  const latencyStats = {
    min: latencies[0],
    p50: percentile(latencies, 0.5),
    p75: percentile(latencies, 0.75),
    p90: percentile(latencies, 0.9),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    max: latencies[latencies.length - 1],
  };

  console.log('');
  console.log(`Completed in ${elapsedMs}ms`);
  console.log(`Successful: ${results.length - failed.length}/${results.length}`);
  console.log(
    `Latency: min=${latencyStats.min}ms p50=${latencyStats.p50}ms p75=${latencyStats.p75}ms p90=${latencyStats.p90}ms p95=${latencyStats.p95}ms p99=${latencyStats.p99}ms max=${latencyStats.max}ms`,
  );

  if (failed.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const result of failed) {
      console.log(
        `${String(result.index).padStart(2, '0')} ${result.status} ${result.error ?? result.url}`,
      );
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
