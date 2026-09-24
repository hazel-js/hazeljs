/**
 * Ensemble provider example.
 * npx tsx examples/ensemble.ts
 */

import {
  createDecisionRuntime,
  createEnsembleDecisionProvider,
  MockDecisionProvider,
  incidentRemediationDefinition,
  incidentState,
} from '../src';
import type { DecisionProvider } from '../src';

async function main(): Promise<void> {
  const mk = (name: string, decision: 'rollback' | 'escalate', score: number): DecisionProvider => {
    const mock = new MockDecisionProvider();
    mock.setDefault({ decision, confidence: score, score });
    return { name, decide: mock.decide.bind(mock) } as DecisionProvider;
  };

  const ensemble = createEnsembleDecisionProvider({
    providers: [mk('judge-a', 'rollback', 0.91), mk('judge-b', 'rollback', 0.88)],
    strategy: 'majority',
  });

  const runtime = createDecisionRuntime();
  runtime.registry.register({
    name: 'incident-remediation',
    ...incidentRemediationDefinition,
  });
  runtime.providers.register(ensemble);

  const result = await runtime.decide({
    name: 'incident-remediation',
    objective: incidentRemediationDefinition.objective,
    state: incidentState,
    choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
    risk: 'high',
    provider: 'ensemble',
  });

  console.log('Ensemble decision:', result.decision);
  console.log('Confidence type:', result.confidenceDetail.type);
  console.log('Policy:', result.policy.outcome);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
