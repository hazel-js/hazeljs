import { CanaryEngine, parseInterval } from '../canary/canary-engine';
import { CanaryState, ProxyRequest } from '../types';

function makeRequest(): ProxyRequest {
  return { method: 'GET', path: '/test', headers: {} };
}

describe('CanaryEngine', () => {
  let engine: CanaryEngine;

  beforeEach(() => {
    engine = new CanaryEngine({
      stable: { version: 'v1', weight: 90 },
      canary: { version: 'v2', weight: 10 },
      promotion: {
        strategy: 'error-rate',
        errorThreshold: 5,
        evaluationWindow: 100, // 100ms for fast tests
        autoPromote: true,
        autoRollback: true,
        steps: [10, 25, 50, 75, 100],
        stepInterval: 50, // 50ms for fast tests
        minRequests: 5,
      },
    });
  });

  afterEach(() => {
    engine.stop();
  });

  describe('version selection', () => {
    it('should distribute traffic based on weights', () => {
      const counts = { stable: 0, canary: 0 };
      for (let i = 0; i < 1000; i++) {
        const target = engine.selectVersion(makeRequest());
        counts[target]++;
      }

      // ~10% canary, ~90% stable with some variance
      expect(counts.canary).toBeGreaterThan(30);
      expect(counts.canary).toBeLessThan(200);
      expect(counts.stable).toBeGreaterThan(700);
    });

    it('should route all to stable after rollback', () => {
      engine.rollback();

      for (let i = 0; i < 100; i++) {
        expect(engine.selectVersion(makeRequest())).toBe('stable');
      }
    });
  });

  describe('metrics tracking', () => {
    it('should record success and failure per version', () => {
      engine.recordSuccess('stable', 100);
      engine.recordSuccess('canary', 50);
      engine.recordFailure('canary', 200, 'error');

      const metrics = engine.getMetrics();
      expect(metrics.stable.totalRequests).toBe(1);
      expect(metrics.stable.errorCount).toBe(0);
      expect(metrics.canary.totalRequests).toBe(2);
      expect(metrics.canary.errorCount).toBe(1);
      expect(metrics.canary.errorRate).toBe(50);
    });
  });

  describe('status', () => {
    it('should report correct status', () => {
      const status = engine.getStatus();
      expect(status.state).toBe(CanaryState.ACTIVE);
      expect(status.stableVersion).toBe('v1');
      expect(status.canaryVersion).toBe('v2');
      expect(status.currentStableWeight).toBe(90);
      expect(status.currentCanaryWeight).toBe(10);
      expect(status.totalSteps).toBe(5);
    });
  });

  describe('manual controls', () => {
    it('should allow manual rollback', () => {
      engine.rollback();
      const status = engine.getStatus();
      expect(status.state).toBe(CanaryState.ROLLED_BACK);
      expect(status.currentCanaryWeight).toBe(0);
      expect(status.currentStableWeight).toBe(100);
    });

    it('should allow manual pause and resume', () => {
      engine.pause();
      expect(engine.getStatus().state).toBe(CanaryState.PAUSED);

      engine.resume();
      expect(engine.getStatus().state).toBe(CanaryState.ACTIVE);
    });

    it('should allow manual promotion', () => {
      const events: string[] = [];
      engine.on('canary:promote', () => events.push('promote'));

      engine.promote();
      const status = engine.getStatus();
      expect(status.currentCanaryWeight).toBe(25); // step 1 -> step 2
      expect(events).toContain('promote');
    });
  });

  describe('events', () => {
    it('should emit rollback event', () => {
      let rollbackData: Record<string, unknown> | undefined;
      engine.on('canary:rollback', (data) => {
        rollbackData = data;
      });

      engine.rollback();
      expect(rollbackData).toBeDefined();
      expect(rollbackData!.trigger).toBe('manual');
      expect(rollbackData!.canaryVersion).toBe('v2');
    });
  });

  describe('version helpers', () => {
    it('should return correct version strings', () => {
      expect(engine.getVersion('stable')).toBe('v1');
      expect(engine.getVersion('canary')).toBe('v2');
    });
  });
});

describe('parseInterval', () => {
  it('should parse seconds', () => {
    expect(parseInterval('30s')).toBe(30000);
  });

  it('should parse minutes', () => {
    expect(parseInterval('5m')).toBe(300000);
  });

  it('should parse hours', () => {
    expect(parseInterval('1h')).toBe(3600000);
  });

  it('should parse milliseconds', () => {
    expect(parseInterval('500ms')).toBe(500);
  });

  it('should pass through numbers', () => {
    expect(parseInterval(1000)).toBe(1000);
  });

  it('should throw on invalid format', () => {
    expect(() => parseInterval('invalid')).toThrow();
  });
});
