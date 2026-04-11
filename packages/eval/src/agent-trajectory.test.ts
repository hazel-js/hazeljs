import { trajectoryScore, toolCallAccuracy } from './agent-trajectory';

describe('agent-trajectory', () => {
  it('trajectoryScore returns 1 when expected is empty', () => {
    expect(trajectoryScore([], ['a', 'b'])).toBe(1);
  });

  it('trajectoryScore matches subsequence', () => {
    expect(trajectoryScore(['a', 'b'], ['x', 'a', 'y', 'b'])).toBe(1);
  });

  it('trajectoryScore partial match', () => {
    expect(trajectoryScore(['a', 'b', 'c'], ['a', 'x', 'b'])).toBeCloseTo(2 / 3);
  });

  it('toolCallAccuracy', () => {
    expect(toolCallAccuracy(['a', 'b'], ['b', 'a', 'c'])).toBe(1);
  });

  it('toolCallAccuracy returns 1 when expected empty', () => {
    expect(toolCallAccuracy([], ['a'])).toBe(1);
  });

  it('toolCallAccuracy partial overlap', () => {
    expect(toolCallAccuracy(['a', 'b'], ['a'])).toBe(0.5);
  });
});
