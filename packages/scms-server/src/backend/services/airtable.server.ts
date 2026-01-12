export type AirtableConfig = {
  apiKey: string;
  baseId: string;
  tableId: string;
  batchSize?: number;
};

export type AirtableFieldConfig = AirtableConfig & {
  fieldId: string;
  fieldName: string;
};

/**
 * Basic Airtable fetch utility with retry logic
 *
 * Throws on error, returns parsed JSON response.
 */
export async function airtableFetch(url: string, apiKey: string, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          console.error(`client error:`, errorMessage);
          throw new Error(errorMessage);
        }

        // Retry on server errors (5xx) or network issues
        if (attempt === retries) {
          console.error(`${url} failed, throwing error:`, errorMessage);
          throw new Error(errorMessage);
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Airtable API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      // Exponential backoff for network errors
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Airtable API ${url} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch multiple records from Airtable by manuscript IDs.
 *
 * Uses filterByFormula with OR conditions to query multiple IDs at once.
 * Batches requests in groups (default size 50) to avoid URL and formula length limits.
 *
 * Returns a lookup table of manuscript IDs to Airtable records.
 */
export async function fetchRecordsByFieldValue(
  values: string[],
  config: AirtableFieldConfig,
): Promise<Map<string, any>> {
  if (values.length === 0) {
    return new Map();
  }

  const { apiKey, baseId, tableId, fieldId, fieldName, batchSize = 50 } = config;

  const allRecords: any[] = [];

  for (let i = 0; i < values.length; i += batchSize) {
    const chunk = values.slice(i, i + batchSize);
    const escapedIds = chunk.map((id) => `'${id.replace(/'/g, "\\'")}'`);
    const filterFormula = `OR(${escapedIds.map((id) => `{${fieldId}} = ${id}`).join(', ')})`;

    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    // Airtable API has a limit of 100 records per page
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', filterFormula);

    const data = await airtableFetch(url.toString(), apiKey);
    if (data.records) {
      allRecords.push(...data.records);
    }
  }
  const recordMap = new Map<string, any>();
  allRecords.forEach((record) => {
    const value = record.fields?.[fieldName];
    if (value) recordMap.set(value, record);
  });

  return recordMap;
}
