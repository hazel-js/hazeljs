import {
  createHealingCoordinator,
  createStrategy,
  createSlackHealingNotifier,
  ErrorDiagnostician,
  formatBytes,
  getMemoryUsage,
  parseMemoryThreshold,
  SelfHealingError,
} from '../index';

describe('package exports', () => {
  it('exposes public API', () => {
    expect(createHealingCoordinator).toBeDefined();
    expect(createStrategy('auto-restart')).toBeDefined();
    expect(new ErrorDiagnostician()).toBeInstanceOf(ErrorDiagnostician);
    expect(parseMemoryThreshold('1MB')).toBeGreaterThan(0);
    expect(formatBytes(1024)).toContain('KB');
    expect(getMemoryUsage().heapUsed).toBeGreaterThan(0);
    expect(createSlackHealingNotifier).toBeDefined();

    const error = new SelfHealingError('failed', 'Target.method');
    expect(error.target).toBe('Target.method');
  });
});
