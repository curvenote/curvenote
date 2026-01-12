import { doi as doiUtils } from 'doi-utils';
import { error404 } from '@curvenote/scms-core';

/**
 * Crossref API response type based on CSL-JSON format
 * Documentation: https://api.crossref.org/swagger-ui/index.html
 * Response format: https://github.com/citation-style-language/schema/blob/master/csl-data.json
 */
interface CrossrefResponse {
  message: {
    items: Array<{
      DOI: string;
      title: string[];
      'container-title': string[];
      'short-container-title'?: string[];
      ISSN?: string[];
      'ISSN-type'?: Array<{
        value: string;
        type: 'print' | 'electronic';
      }>;
      published: {
        'date-parts': number[][];
      };
      author?: Array<{
        given?: string;
        family?: string;
      }>;
      type?: string;
      volume?: string;
      issue?: string;
      page?: string;
      URL?: string;
      source?: string;
      publisher?: string;
    }>;
  };
}

export async function lookupMetadataFromDoi(doi: string): Promise<CrossrefResponse> {
  // Extract DOI from URL if it's a URL that ends with a DOI
  let doiToProcess = doi;
  const urlMatch = doi.match(/^https?:\/\/[^/]+\/(?:.*\/)?(10\.\d{4,}\/[^\s]+)$/);
  if (urlMatch) {
    doiToProcess = urlMatch[1];
    console.log('Extracted DOI from URL:', doiToProcess);
  }

  const doiNormalized = doiUtils.normalize(doiToProcess);
  console.log('doiNormalized', doiNormalized);
  if (!doiNormalized) throw error404('Not Found - Invalid DOI');

  // 10.1038/nmeth.4637
  // See if the doi resolves at all first, then try and get metadata
  let resp;
  let doiExistsAndRedirects = false;
  let doiCanRetrieveMetadata = false;
  try {
    // first check if the doi exists and redirects
    resp = await fetch(`https://doi.org/${doiNormalized}`, {
      redirect: 'manual',
    });
    if (resp.status === 302) {
      doiExistsAndRedirects = true;
      console.log('doi exists and redirects to:', resp.headers.get('Location'));
    }

    // Next try to retreive metadata
    resp = await fetch(`https://dx.doi.org/${doiNormalized}`, {
      headers: {
        Accept: 'application/vnd.citationstyles.csl+json',
      },
    });
    if (resp.ok) {
      doiCanRetrieveMetadata = true;
    }
  } catch (error) {
    console.error(
      `Error fetching DOI metadata: ${
        doiExistsAndRedirects ? 'DOI exists and redirects' : 'DOI does not exist'
      } ${doiCanRetrieveMetadata ? 'can retrieve metadata' : 'cannot retrieve metadata'}`,
      error,
    );

    throw error404('DOI lookup failed');
  }

  if (doiExistsAndRedirects && !doiCanRetrieveMetadata) {
    throw error404('DOI is valid but no metadata is available, please enter details manually');
  }

  if (!doiExistsAndRedirects) {
    throw error404('DOI is not resolving to a valid URL');
  }

  return resp.json() as Promise<CrossrefResponse>;
}
