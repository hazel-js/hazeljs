/**
 * Pure ingest lifecycle helpers — checksum skip, crawl stale sweep guards.
 */

import type {
  ChecksumSkipResult,
  CrawlStaleSweepInput,
  CrawlStaleSweepResult,
  DocumentVersionRecord,
  VersionStatus,
} from './types';

export function shouldSkipUnchangedIngest(
  latest: DocumentVersionRecord | null | undefined,
  newChecksum: string,
  readyStatus: VersionStatus = 'READY'
): ChecksumSkipResult {
  if (!latest) return { skip: false };
  if (latest.status !== readyStatus) return { skip: false };
  if (latest.checksum === newChecksum) {
    return { skip: true, reason: 'unchanged' };
  }
  return { skip: false };
}

export function shouldRunStaleSweep(input: CrawlStaleSweepInput): {
  eligible: boolean;
  reason?: string;
} {
  if (!input.crawlSucceeded) {
    return { eligible: false, reason: 'crawl_failed' };
  }
  if (!input.crawlSessionId?.trim()) {
    return { eligible: false, reason: 'missing_session' };
  }
  if (input.pagesIngested <= 0) {
    return { eligible: false, reason: 'no_pages_ingested' };
  }

  const prev = input.previousPageCount ?? 0;
  if (prev > 0) {
    const ratio = input.pagesIngested / prev;
    const minRatio = input.minRetentionRatio ?? 0.7;
    if (ratio < minRatio) {
      return {
        eligible: false,
        reason: `partial_crawl:${input.pagesIngested}/${prev}`,
      };
    }
  }

  return { eligible: true };
}

export interface CrawlStaleSweepStore {
  deactivateUnseenGroupsForCrawl(input: {
    tenantId: string;
    crawlRoot: string;
    tag: string;
    crawlSessionId: string;
  }): Promise<{ groupsDeactivated: number; chunksDeactivated: number }>;
}

export async function runCrawlStaleSweep(
  store: CrawlStaleSweepStore,
  input: CrawlStaleSweepInput
): Promise<CrawlStaleSweepResult> {
  const guard = shouldRunStaleSweep(input);
  if (!guard.eligible) {
    return {
      ran: false,
      skippedReason: guard.reason,
      groupsDeactivated: 0,
      chunksDeactivated: 0,
    };
  }

  const result = await store.deactivateUnseenGroupsForCrawl({
    tenantId: input.tenantId,
    crawlRoot: input.crawlRoot,
    tag: input.tag,
    crawlSessionId: input.crawlSessionId,
  });

  return {
    ran: true,
    groupsDeactivated: result.groupsDeactivated,
    chunksDeactivated: result.chunksDeactivated,
  };
}

export function mergeFreshnessIntoMetadata(
  base: Record<string, unknown>,
  freshness: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({ ...base, ...freshness }).filter(([, v]) => v !== undefined)
  );
}
