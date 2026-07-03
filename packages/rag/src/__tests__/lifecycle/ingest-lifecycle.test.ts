import {
  shouldSkipUnchangedIngest,
  shouldRunStaleSweep,
  runCrawlStaleSweep,
  mergeFreshnessIntoMetadata,
} from '../../lifecycle/ingest-lifecycle';

const baseSweepInput = {
  tenantId: 'tenant-1',
  crawlRoot: 'https://example.edu',
  tag: 'source-1',
  crawlSessionId: 'session-abc',
  pagesIngested: 10,
  crawlSucceeded: true,
};

describe('shouldSkipUnchangedIngest', () => {
  it('skips when checksum matches a READY version', () => {
    expect(
      shouldSkipUnchangedIngest(
        {
          id: 'v1',
          groupId: 'g1',
          versionNumber: 1,
          checksum: 'abc123',
          status: 'READY',
        },
        'abc123'
      )
    ).toEqual({ skip: true, reason: 'unchanged' });
  });

  it('does not skip when there is no latest version', () => {
    expect(shouldSkipUnchangedIngest(null, 'abc123')).toEqual({ skip: false });
  });

  it('does not skip when latest version is not READY', () => {
    expect(
      shouldSkipUnchangedIngest(
        {
          id: 'v1',
          groupId: 'g1',
          versionNumber: 1,
          checksum: 'abc123',
          status: 'PROCESSING',
        },
        'abc123'
      )
    ).toEqual({ skip: false });
  });

  it('does not skip when checksum changed', () => {
    expect(
      shouldSkipUnchangedIngest(
        {
          id: 'v1',
          groupId: 'g1',
          versionNumber: 1,
          checksum: 'abc123',
          status: 'READY',
        },
        'different'
      )
    ).toEqual({ skip: false });
  });
});

describe('shouldRunStaleSweep', () => {
  it('is eligible when all guards pass', () => {
    expect(shouldRunStaleSweep(baseSweepInput)).toEqual({ eligible: true });
  });

  it('rejects failed crawls', () => {
    expect(shouldRunStaleSweep({ ...baseSweepInput, crawlSucceeded: false })).toEqual({
      eligible: false,
      reason: 'crawl_failed',
    });
  });

  it('rejects missing crawl session id', () => {
    expect(shouldRunStaleSweep({ ...baseSweepInput, crawlSessionId: '  ' })).toEqual({
      eligible: false,
      reason: 'missing_session',
    });
  });

  it('rejects crawls with zero ingested pages', () => {
    expect(shouldRunStaleSweep({ ...baseSweepInput, pagesIngested: 0 })).toEqual({
      eligible: false,
      reason: 'no_pages_ingested',
    });
  });

  it('rejects partial crawls below retention ratio', () => {
    expect(
      shouldRunStaleSweep({
        ...baseSweepInput,
        pagesIngested: 3,
        previousPageCount: 10,
      })
    ).toEqual({
      eligible: false,
      reason: 'partial_crawl:3/10',
    });
  });

  it('allows partial crawls above custom retention ratio', () => {
    expect(
      shouldRunStaleSweep({
        ...baseSweepInput,
        pagesIngested: 4,
        previousPageCount: 10,
        minRetentionRatio: 0.35,
      })
    ).toEqual({ eligible: true });
  });
});

describe('runCrawlStaleSweep', () => {
  it('returns skipped result when guard fails', async () => {
    const store = {
      deactivateUnseenGroupsForCrawl: jest.fn(),
    };

    const result = await runCrawlStaleSweep(store, {
      ...baseSweepInput,
      crawlSucceeded: false,
    });

    expect(result).toEqual({
      ran: false,
      skippedReason: 'crawl_failed',
      groupsDeactivated: 0,
      chunksDeactivated: 0,
    });
    expect(store.deactivateUnseenGroupsForCrawl).not.toHaveBeenCalled();
  });

  it('deactivates unseen groups when eligible', async () => {
    const store = {
      deactivateUnseenGroupsForCrawl: jest.fn().mockResolvedValue({
        groupsDeactivated: 2,
        chunksDeactivated: 8,
      }),
    };

    const result = await runCrawlStaleSweep(store, baseSweepInput);

    expect(store.deactivateUnseenGroupsForCrawl).toHaveBeenCalledWith({
      tenantId: baseSweepInput.tenantId,
      crawlRoot: baseSweepInput.crawlRoot,
      tag: baseSweepInput.tag,
      crawlSessionId: baseSweepInput.crawlSessionId,
    });
    expect(result).toEqual({
      ran: true,
      groupsDeactivated: 2,
      chunksDeactivated: 8,
    });
  });
});

describe('mergeFreshnessIntoMetadata', () => {
  it('merges metadata and drops undefined values', () => {
    expect(
      mergeFreshnessIntoMetadata(
        { source: 'https://example.edu/page', tenantId: 't1' },
        { contentDate: '2026-01-01T00:00:00.000Z', validUntil: undefined }
      )
    ).toEqual({
      source: 'https://example.edu/page',
      tenantId: 't1',
      contentDate: '2026-01-01T00:00:00.000Z',
    });
  });
});
