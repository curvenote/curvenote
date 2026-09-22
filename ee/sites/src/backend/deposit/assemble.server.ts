import { DoiBatch, preprintXml } from 'crossref-utils-sdk';
import type { Context } from '@curvenote/scms-server';
import { toDeposit } from './mapper.js';
import { DepositSourceError, loadDepositSource } from './source.server.js';
import { DEPOSITOR_NAME, RESOURCE_URL_BASE } from './types.js';
import type { AssembledDeposit } from './types.js';

export type AssembleOptions = {
  doi: string;
  batchId: string;
  depositorEmail: string;
  timestamp?: number;
};

/**
 * Loader -> mapper -> preprintXml + DoiBatch. The single entry point for the DOI page readiness
 * check (CN-2509) and for `startRegistration`, so what the page promises and what gets sent cannot
 * drift apart. `xml` is present only when nothing blocks.
 *
 * No local XSD validation: Crossref validates the deposit against the same schema on receipt and
 * the poll reports any schema error as a failed registration with Crossref's message.
 *
 * Never throws for a loader failure (missing submission version, no CDN content, no index page):
 * those are reported as a blocking issue, same as a mapper failure, so callers get one
 * `{ issues, doi }` shape instead of having to also catch `DepositSourceError`.
 */
export async function assembleDeposit(
  ctx: Context,
  submissionVersionId: string,
  opts: AssembleOptions,
): Promise<AssembledDeposit> {
  let source;
  try {
    source = await loadDepositSource(ctx, submissionVersionId);
  } catch (e) {
    if (e instanceof DepositSourceError) {
      return {
        issues: [{ severity: 'blocking', code: e.code, message: e.message }],
        doi: opts.doi,
      };
    }
    throw e;
  }
  const mapped = toDeposit(source, {
    doi: opts.doi,
    batchId: opts.batchId,
    timestamp: opts.timestamp ?? Date.now(),
    resourceUrl: `${RESOURCE_URL_BASE}${opts.doi}`,
    depositor: { name: DEPOSITOR_NAME, email: opts.depositorEmail },
  });
  if (!mapped.preprint) {
    return { issues: mapped.issues, doi: opts.doi };
  }
  const xml = new DoiBatch(mapped.batch, preprintXml(mapped.preprint)).toXml();
  return { xml, summary: mapped.summary, issues: mapped.issues, doi: opts.doi };
}
