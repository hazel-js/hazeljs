import { parseDuration } from '../utils/duration';

describe('parseDuration', () => {
  it('parses minute and hour durations', () => {
    expect(parseDuration('30m')).toBe(30 * 60_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration(5000)).toBe(5000);
  });
});
