import {
  extractFreshnessMetadata,
  applyRecencyRanking,
  filterExpiredContent,
  computeRecencyDecay,
  formatFreshnessLabel,
  applyPathRelevanceBoost,
  computePathRelevanceBoost,
} from '../../freshness';

describe('extractFreshnessMetadata', () => {
  it('detects years in admissions content', () => {
    const meta = extractFreshnessMetadata({
      text: 'Fall Admissions 2025 deadline is March 15, 2025. Apply now.',
      crawledAt: new Date('2026-07-01'),
    });
    expect(meta.detectedYears).toContain(2025);
    expect(meta.temporalValidity).toBe('dated');
    expect(meta.contentDate).toBeDefined();
  });

  it('parses HTML meta modified time', () => {
    const html =
      '<html><head><meta property="article:modified_time" content="2026-01-15T10:00:00Z"></head><body>Hello</body></html>';
    const meta = extractFreshnessMetadata({ html, text: 'Hello' });
    expect(meta.lastModifiedAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('uses sitemap lastmod and HTTP Last-Modified when no in-content years', () => {
    const meta = extractFreshnessMetadata({
      text: 'General information about the university.',
      httpLastModified: 'Wed, 15 Jan 2026 10:00:00 GMT',
      sitemapLastmod: '2026-01-10T00:00:00Z',
      crawledAt: new Date('2026-07-01'),
    });
    expect(meta.lastModifiedAt).toBeDefined();
    expect(meta.contentDate).toBe(meta.lastModifiedAt);
    expect(meta.detectedYears).toBeUndefined();
  });

  it('parses JSON-LD published and modified dates', () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"datePublished":"2025-09-01T00:00:00Z","dateModified":"2026-02-01T00:00:00Z"}
      </script>
    </head><body>Page</body></html>`;
    const meta = extractFreshnessMetadata({ html, text: 'Page' });
    expect(meta.publishedAt).toBe('2025-09-01T00:00:00.000Z');
    expect(meta.lastModifiedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('ignores invalid date strings', () => {
    const meta = extractFreshnessMetadata({
      text: 'Evergreen docs',
      httpLastModified: 'not-a-date',
      sitemapLastmod: 'also-invalid',
    });
    expect(meta.lastModifiedAt).toBeUndefined();
    expect(meta.crawledAt).toBeDefined();
  });
});

describe('computeRecencyDecay', () => {
  it('returns 1 for evergreen content', () => {
    expect(
      computeRecencyDecay({
        temporalValidity: 'evergreen',
        contentDate: '2020-01-01T00:00:00.000Z',
      })
    ).toBe(1);
  });

  it('returns 1 when no date signals exist', () => {
    expect(computeRecencyDecay({})).toBe(1);
  });

  it('returns 1 for future-dated content', () => {
    expect(
      computeRecencyDecay(
        { contentDate: '2030-01-01T00:00:00.000Z' },
        { now: new Date('2026-07-01') }
      )
    ).toBe(1);
  });

  it('decays older content below 1', () => {
    const decay = computeRecencyDecay(
      { contentDate: '2024-01-01T00:00:00.000Z' },
      { now: new Date('2026-07-01'), halfLifeDays: 180 }
    );
    expect(decay).toBeLessThan(1);
    expect(decay).toBeGreaterThan(0);
  });
});

describe('formatFreshnessLabel', () => {
  it('prefers detected years', () => {
    expect(formatFreshnessLabel({ detectedYears: [2026, 2025] })).toBe('as of 2026');
  });

  it('falls back to ISO date', () => {
    expect(formatFreshnessLabel({ contentDate: '2026-03-15T00:00:00.000Z' })).toBe(
      'as of 2026-03-15'
    );
  });

  it('returns empty string without signals', () => {
    expect(formatFreshnessLabel(undefined)).toBe('');
  });
});

describe('applyRecencyRanking', () => {
  it('down-ranks older dated content', () => {
    const results = applyRecencyRanking(
      [
        {
          score: 0.9,
          metadata: { detectedYears: [2025], contentDate: '2025-07-01T00:00:00.000Z' },
          content: 'Admissions 2025',
        },
        {
          score: 0.85,
          metadata: { detectedYears: [2026], contentDate: '2026-07-01T00:00:00.000Z' },
          content: 'Admissions 2026',
        },
      ],
      { now: new Date('2026-07-03'), halfLifeDays: 180 }
    );
    expect(results[0].metadata?.detectedYears).toEqual([2026]);
  });

  it('keeps evergreen scores unchanged', () => {
    const results = applyRecencyRanking(
      [
        {
          score: 0.8,
          metadata: { temporalValidity: 'evergreen', contentDate: '2010-01-01T00:00:00.000Z' },
          content: 'API docs',
        },
      ],
      { now: new Date('2026-07-03') }
    );
    expect(results[0].score).toBe(0.8);
    expect((results[0].metadata as Record<string, unknown>).recencyDecay).toBe(1);
  });
});

describe('filterExpiredContent', () => {
  it('filters past-year content when newer year exists', () => {
    const results = filterExpiredContent(
      [
        {
          score: 0.9,
          metadata: {
            detectedYears: [2025],
            canonicalSourceUri: 'https://example.edu/admissions',
            source: 'https://example.edu/admissions-2025',
          },
          content: '2025',
        },
        {
          score: 0.8,
          metadata: {
            detectedYears: [2026],
            canonicalSourceUri: 'https://example.edu/admissions',
            source: 'https://example.edu/admissions-2026',
          },
          content: '2026',
        },
      ],
      { now: new Date('2026-07-03') }
    );
    expect(results).toHaveLength(1);
    expect(results[0].metadata?.detectedYears).toEqual([2026]);
  });

  it('filters content past validUntil', () => {
    const results = filterExpiredContent(
      [
        {
          score: 0.9,
          metadata: { validUntil: '2025-12-31T00:00:00.000Z' },
          content: 'Expired deadline page',
        },
      ],
      { now: new Date('2026-07-03') }
    );
    expect(results).toHaveLength(0);
  });

  it('keeps evergreen content even when validUntil would otherwise expire siblings', () => {
    const results = filterExpiredContent(
      [
        {
          score: 0.9,
          metadata: { temporalValidity: 'evergreen', validUntil: '2020-01-01T00:00:00.000Z' },
          content: 'Evergreen',
        },
      ],
      { now: new Date('2026-07-03') }
    );
    expect(results).toHaveLength(1);
  });
});

describe('path relevance boost', () => {
  it('boosts /graduate/ for graduate programs queries', () => {
    const results = applyPathRelevanceBoost(
      [
        {
          score: 0.82,
          metadata: { source: 'https://kinnaird.edu.pk/admissions-fall-2025/' },
          content: 'Admissions open for graduate programs',
        },
        {
          score: 0.78,
          metadata: { source: 'https://kinnaird.edu.pk/graduate/' },
          content: 'M.Phil in Accounting & Finance',
        },
      ],
      'how about graduate programs?'
    );

    expect(results[0]?.metadata?.source).toContain('/graduate/');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it('leaves unrelated URLs unchanged', () => {
    const boost = computePathRelevanceBoost(
      'what are the library hours?',
      'https://kinnaird.edu.pk/library/'
    );
    expect(boost).toBeGreaterThan(1);
  });
});
