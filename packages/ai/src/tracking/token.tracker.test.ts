jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { TokenTracker } from './token.tracker';
import { TokenUsage } from '../ai-enhanced.types';

const NOW = Date.now();

function makeUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    timestamp: NOW,
    ...overrides,
  };
}

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  describe('constructor', () => {
    it('creates with defaults', () => {
      expect(tracker).toBeDefined();
    });

    it('accepts custom config', () => {
      const t = new TokenTracker({
        maxTokensPerRequest: 1000,
        maxTokensPerDay: 5000,
        maxTokensPerMonth: 50000,
      });
      expect(t).toBeDefined();
    });

    it('uses partial config with defaults for missing fields', () => {
      const t = new TokenTracker({ maxTokensPerRequest: 500 });
      expect(t).toBeDefined();
    });
  });

  describe('track()', () => {
    it('tracks global usage', () => {
      tracker.track(makeUsage());
      const exported = tracker.exportData();
      expect(exported).toHaveLength(1);
      expect(exported[0].totalTokens).toBe(150);
    });

    it('tracks per-user usage when userId provided', () => {
      tracker.track(makeUsage({ userId: 'user1' }));
      const userData = tracker.exportData('user1');
      expect(userData).toHaveLength(1);
    });

    it('appends to existing user history', () => {
      tracker.track(makeUsage({ userId: 'user1' }));
      tracker.track(makeUsage({ totalTokens: 200, userId: 'user1' }));
      expect(tracker.exportData('user1')).toHaveLength(2);
    });

    it('calculates cost when model is provided and cost is missing', () => {
      tracker.track(
        { promptTokens: 1000, completionTokens: 500, totalTokens: 1500, timestamp: NOW },
        'gpt-4-turbo-preview'
      );
      const exported = tracker.exportData();
      expect(exported[0].cost).toBeGreaterThan(0);
    });

    it('does not recalculate if cost is already set', () => {
      tracker.track(makeUsage({ cost: 0.999 }), 'gpt-4');
      expect(tracker.exportData()[0].cost).toBe(0.999);
    });

    it('does not set cost when no model provided and cost is missing', () => {
      tracker.track(makeUsage());
      expect(tracker.exportData()[0].cost).toBeUndefined();
    });
  });

  describe('checkLimits()', () => {
    it('allows request within all limits', async () => {
      const result = await tracker.checkLimits('user1', 100);
      expect(result.allowed).toBe(true);
    });

    it('blocks request exceeding per-request limit', async () => {
      const t = new TokenTracker({ maxTokensPerRequest: 10 });
      const result = await t.checkLimits(undefined, 100);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Request exceeds token limit');
    });

    it('returns allowed when no userId and requestTokens within limit', async () => {
      const result = await tracker.checkLimits(undefined, 50);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed with no arguments', async () => {
      const result = await tracker.checkLimits();
      expect(result.allowed).toBe(true);
    });

    it('blocks when daily limit exceeded', async () => {
      const t = new TokenTracker({ maxTokensPerDay: 100, maxTokensPerMonth: 1000000 });
      t.track({
        promptTokens: 60,
        completionTokens: 50,
        totalTokens: 110,
        timestamp: NOW,
        userId: 'user1',
      });
      const result = await t.checkLimits('user1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily token limit exceeded');
    });

    it('blocks when monthly limit exceeded', async () => {
      const t = new TokenTracker({ maxTokensPerDay: 1000000, maxTokensPerMonth: 100 });
      t.track({
        promptTokens: 60,
        completionTokens: 50,
        totalTokens: 110,
        timestamp: NOW,
        userId: 'user1',
      });
      const result = await t.checkLimits('user1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Monthly token limit exceeded');
    });

    it('returns usage info in response for user with history', async () => {
      tracker.track(makeUsage({ userId: 'user1', totalTokens: 15 }));
      const result = await tracker.checkLimits('user1');
      expect(result.usage).toBeDefined();
      expect(result.usage?.today).toBe(15);
      expect(result.usage?.limit.daily).toBeDefined();
    });

    it('returns allowed true for user with no history', async () => {
      const result = await tracker.checkLimits('newUser');
      expect(result.allowed).toBe(true);
    });
  });

  describe('calculateCost()', () => {
    it('calculates cost for gpt-4', () => {
      const cost = tracker.calculateCost(
        makeUsage({ promptTokens: 1000, completionTokens: 500 }),
        'gpt-4'
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('calculates cost for gpt-4-turbo-preview', () => {
      const cost = tracker.calculateCost(
        makeUsage({ promptTokens: 1000, completionTokens: 500 }),
        'gpt-4-turbo-preview'
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('calculates cost for gpt-3.5-turbo', () => {
      const cost = tracker.calculateCost(
        makeUsage({ promptTokens: 1000, completionTokens: 500 }),
        'gpt-3.5-turbo'
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('calculates cost for claude models', () => {
      const models = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      models.forEach((model) => {
        const cost = tracker.calculateCost(
          makeUsage({ promptTokens: 1000, completionTokens: 500 }),
          model
        );
        expect(cost).toBeGreaterThan(0);
      });
    });

    it('returns 0 for unknown model', () => {
      const cost = tracker.calculateCost(makeUsage(), 'unknown-model-xyz');
      expect(cost).toBe(0);
    });
  });

  describe('getUserStats()', () => {
    it('returns zero stats for unknown user', () => {
      const stats = tracker.getUserStats('nobody');
      expect(stats.totalTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.averageTokensPerRequest).toBe(0);
    });

    it('returns correct stats for user with history', () => {
      tracker.track(makeUsage({ totalTokens: 150, cost: 0.01, userId: 'user1' }));
      tracker.track(makeUsage({ totalTokens: 300, cost: 0.02, userId: 'user1' }));
      const stats = tracker.getUserStats('user1');
      expect(stats.totalTokens).toBe(450);
      expect(stats.requestCount).toBe(2);
      expect(stats.totalCost).toBeCloseTo(0.03);
      expect(stats.averageTokensPerRequest).toBe(225);
    });

    it('calculates dailyAverage', () => {
      tracker.track(makeUsage({ totalTokens: 300, userId: 'user1' }));
      const stats = tracker.getUserStats('user1', 30);
      expect(stats.dailyAverage).toBe(10); // 300/30
    });

    it('excludes usage outside the time window', () => {
      const old = NOW - 40 * 24 * 60 * 60 * 1000;
      tracker.track(makeUsage({ totalTokens: 999, timestamp: old, userId: 'user1' }));
      tracker.track(makeUsage({ totalTokens: 10, userId: 'user1' }));
      const stats = tracker.getUserStats('user1', 30);
      expect(stats.totalTokens).toBe(10);
    });
  });

  describe('getGlobalStats()', () => {
    it('returns zero stats when empty', () => {
      const stats = tracker.getGlobalStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.topUsers).toHaveLength(0);
    });

    it('returns correct stats with multiple users', () => {
      tracker.track(makeUsage({ totalTokens: 150, userId: 'u1' }));
      tracker.track(makeUsage({ totalTokens: 300, userId: 'u2' }));
      tracker.track(makeUsage({ totalTokens: 75 })); // no userId
      const stats = tracker.getGlobalStats();
      expect(stats.totalTokens).toBe(525);
      expect(stats.requestCount).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
    });

    it('returns top users sorted by token usage', () => {
      tracker.track(makeUsage({ totalTokens: 100, userId: 'small' }));
      tracker.track(makeUsage({ totalTokens: 500, userId: 'big' }));
      const stats = tracker.getGlobalStats();
      expect(stats.topUsers[0].userId).toBe('big');
    });

    it('limits top users to 10', () => {
      for (let i = 0; i < 15; i++) {
        tracker.track(makeUsage({ totalTokens: i * 10, userId: `user${i}` }));
      }
      const stats = tracker.getGlobalStats();
      expect(stats.topUsers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('cleanup()', () => {
    it('removes old global usage data', () => {
      const old = NOW - 91 * 24 * 60 * 60 * 1000;
      tracker.track(makeUsage({ totalTokens: 999, timestamp: old }));
      tracker.track(makeUsage({ totalTokens: 15 }));
      tracker.cleanup(90);
      const exported = tracker.exportData();
      expect(exported).toHaveLength(1);
      expect(exported[0].totalTokens).toBe(15);
    });

    it('removes empty user entries after cleanup', () => {
      const old = NOW - 100 * 24 * 60 * 60 * 1000;
      tracker.track(makeUsage({ timestamp: old, userId: 'oldUser' }));
      tracker.cleanup(90);
      expect(tracker.exportData('oldUser')).toHaveLength(0);
    });

    it('keeps recent user entries after cleanup', () => {
      const old = NOW - 100 * 24 * 60 * 60 * 1000;
      tracker.track(makeUsage({ timestamp: old, userId: 'user1' }));
      tracker.track(makeUsage({ userId: 'user1' }));
      tracker.cleanup(90);
      expect(tracker.exportData('user1')).toHaveLength(1);
    });

    it('uses default 90 days when no argument', () => {
      const old = NOW - 95 * 24 * 60 * 60 * 1000;
      tracker.track(makeUsage({ timestamp: old }));
      tracker.cleanup();
      expect(tracker.exportData()).toHaveLength(0);
    });
  });

  describe('exportData()', () => {
    it('exports all global data when no userId', () => {
      tracker.track(makeUsage({ userId: 'u1' }));
      tracker.track(makeUsage());
      const data = tracker.exportData();
      expect(data).toHaveLength(2);
    });

    it('returns empty array for unknown user', () => {
      expect(tracker.exportData('nobody')).toEqual([]);
    });

    it('returns copy of global history', () => {
      tracker.track(makeUsage());
      const data = tracker.exportData();
      expect(data).toHaveLength(1);
    });
  });

  describe('updateConfig()', () => {
    it('updates maxTokensPerRequest', async () => {
      tracker.updateConfig({ maxTokensPerRequest: 2000 });
      const result = await tracker.checkLimits(undefined, 1500);
      expect(result.allowed).toBe(true);
    });

    it('merges config without overwriting unspecified fields', async () => {
      tracker.updateConfig({ maxTokensPerRequest: 50 });
      const result = await tracker.checkLimits(undefined, 100);
      expect(result.allowed).toBe(false);
    });
  });
});
