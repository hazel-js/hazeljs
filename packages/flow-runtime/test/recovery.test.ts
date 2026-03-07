import { describe, it, expect, vi } from 'vitest';
import { recovery } from '../src/recovery.js';

describe('recovery', () => {
  it('calls tick for each running run', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const engine = {
      getRunningRunIds: vi.fn().mockResolvedValue(['run-1', 'run-2']),
      tick,
    } as never;

    await recovery(engine);

    expect(engine.getRunningRunIds).toHaveBeenCalled();
    expect(tick).toHaveBeenCalledWith('run-1');
    expect(tick).toHaveBeenCalledWith('run-2');
  });

  it('handles empty running list', async () => {
    const tick = vi.fn();
    const engine = {
      getRunningRunIds: vi.fn().mockResolvedValue([]),
      tick,
    } as never;

    await recovery(engine);

    expect(tick).not.toHaveBeenCalled();
  });
});
