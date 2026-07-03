/**
 * Storage adapter interface for document ingest lifecycle (versioning, dedup, stale sweep).
 */

export type VersionStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentGroupRecord {
  id: string;
  canonicalSourceUri: string;
  lastSeenAt?: Date | null;
  lastCrawlSessionId?: string | null;
}

export interface DocumentVersionRecord {
  id: string;
  groupId: string;
  versionNumber: number;
  checksum: string;
  status: VersionStatus;
}

export interface ReusableChunkRecord {
  id: string;
  embeddingId: string | null;
}

export interface IngestLifecycleStore {
  findOrCreateGroup(input: {
    tenantId: string;
    canonicalSourceUri: string;
    title?: string;
  }): Promise<DocumentGroupRecord>;

  findLatestVersion(groupId: string, tenantId: string): Promise<DocumentVersionRecord | null>;

  markGroupSeen(groupId: string, tenantId: string, crawlSessionId: string): Promise<void>;

  deactivateUnseenGroupsForCrawl(input: {
    tenantId: string;
    crawlRoot: string;
    tag: string;
    crawlSessionId: string;
  }): Promise<{ groupsDeactivated: number; chunksDeactivated: number }>;
}

export interface ChecksumSkipResult {
  skip: boolean;
  reason?: 'unchanged' | 'empty';
}

export interface CrawlStaleSweepInput {
  tenantId: string;
  crawlRoot: string;
  tag: string;
  crawlSessionId: string;
  pagesIngested: number;
  previousPageCount?: number;
  /** Minimum ratio of current/previous pages to allow sweep (default 0.7). */
  minRetentionRatio?: number;
  crawlSucceeded: boolean;
}

export interface CrawlStaleSweepResult {
  ran: boolean;
  skippedReason?: string;
  groupsDeactivated: number;
  chunksDeactivated: number;
}
