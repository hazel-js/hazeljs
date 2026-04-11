/**
 * Agent trajectory evaluation — expected tool sequence vs actual.
 */

export interface AgentTrajectory {
  toolCalls: string[];
}

export function trajectoryScore(expected: string[], actual: string[]): number {
  if (expected.length === 0) return 1;
  const exp = [...expected];
  let matched = 0;
  let j = 0;
  for (let i = 0; i < actual.length && j < exp.length; i++) {
    if (actual[i] === exp[j]) {
      matched++;
      j++;
    }
  }
  return matched / exp.length;
}

export function toolCallAccuracy(expected: string[], actual: string[]): number {
  const expSet = new Set(expected);
  if (expSet.size === 0) return 1;
  const actSet = new Set(actual);
  let hit = 0;
  for (const e of expSet) {
    if (actSet.has(e)) hit++;
  }
  return hit / expSet.size;
}
