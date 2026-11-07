/**
 * Offline routing benchmark. Costs are simulated and labeled.
 * Usage: npx ts-node benchmarks/run-routing-bench.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createDecisionPlane,
  createModelRouteDefinition,
  createModelRouteRulesProvider,
  routeModelTier,
} from '../src';

interface BenchCase {
  id: string;
  kind: string;
  context: Record<string, unknown>;
  expectedAnswer: string;
  escalate?: boolean;
  prohibitedActionAttempt?: boolean;
  simulatedCostUsd: { baseline: number; routed: number };
  simulatedLatencyMs: { baseline: number; routed: number };
}

function wilsonInterval(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return {
    low: Math.max(0, (centre - margin) / denom),
    high: Math.min(1, (centre + margin) / denom),
  };
}

async function main(): Promise<void> {
  const file = path.join(__dirname, 'routing-v1.json');
  const dataset = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    id: string;
    version: string;
    cases: BenchCase[];
  };

  const plane = createDecisionPlane({ providers: [createModelRouteRulesProvider()] });
  const definition = createModelRouteDefinition();
  const execution = {
    tenantId: 'bench',
    actorId: 'bench',
    permissionScope: 'bench',
    policyVersion: '1',
  };

  let correct = 0;
  let escalations = 0;
  let prohibited = 0;
  let costBaseline = 0;
  let costRouted = 0;
  let latencyBaseline = 0;
  let latencyRouted = 0;

  for (const c of dataset.cases) {
    const decision = await routeModelTier(plane, {
      context: c.context as never,
      execution,
      definition,
    });
    const answer =
      decision.result.status === 'succeeded'
        ? decision.result.answer
        : decision.result.status === 'abstained'
          ? 'abstain'
          : 'error';
    if (answer === c.expectedAnswer) correct += 1;
    if (decision.escalate || c.escalate) escalations += 1;
    if (c.prohibitedActionAttempt) prohibited += 1;
    costBaseline += c.simulatedCostUsd.baseline;
    costRouted += c.simulatedCostUsd.routed;
    latencyBaseline += c.simulatedLatencyMs.baseline;
    latencyRouted += c.simulatedLatencyMs.routed;
  }

  const n = dataset.cases.length;
  const accuracy = correct / n;
  const interval = wilsonInterval(correct, n);

  const report = {
    dataset: dataset.id,
    version: dataset.version,
    sampleSize: n,
    accuracy,
    accuracyWilson95: interval,
    escalationFrequency: escalations / n,
    prohibitedActionAttempts: prohibited,
    costPerSuccessfulTaskSimulated: {
      baseline: costBaseline / Math.max(1, correct),
      routed: costRouted / Math.max(1, correct),
      note: 'SIMULATED — not measured provider spend',
    },
    meanLatencyMsSimulated: {
      baseline: latencyBaseline / n,
      routed: latencyRouted / n,
      note: 'SIMULATED',
    },
    limitations: [
      'Offline rules provider only; no paid API calls',
      'Costs and latencies are labeled simulations from the dataset',
      'Does not claim competitor-equivalent savings',
    ],
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
