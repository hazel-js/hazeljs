import { MemoryGuardMonitor } from '../memory/memory-guard';
import { parseMemoryThreshold } from '../utils/memory';

describe('MemoryGuardMonitor', () => {
  it('parses memory thresholds', () => {
    expect(parseMemoryThreshold('500MB')).toBe(500 * 1024 * 1024);
    expect(parseMemoryThreshold(1024)).toBe(1024);
  });

  it('fires threshold event when heap exceeds limit', async () => {
    const events: string[] = [];
    const monitor = new MemoryGuardMonitor({
      threshold: 1,
      action: 'notify-only',
      onThresholdExceeded: async () => {
        events.push('callback');
      },
    });

    await monitor.check((event) => {
      events.push(event.type);
    });

    expect(events).toContain('threshold-exceeded');
    expect(events).toContain('action-executed');
    expect(events).toContain('callback');
  });
});
