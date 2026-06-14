/**
 * Jest stub for optional @hazeljs/eval peer.
 * Keeps coverage/typecheck within agent rootDir during tests.
 */

export function trajectoryScore(expected: string[], actual: string[]): number {
  if (expected.length === 0) {
    return actual.length === 0 ? 1 : 0;
  }
  const hits = expected.filter((tool) => actual.includes(tool)).length;
  return hits / expected.length;
}

export function toolCallAccuracy(expected: string[], actual: string[]): number {
  return trajectoryScore(expected, actual);
}
