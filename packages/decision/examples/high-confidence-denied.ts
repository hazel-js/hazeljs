/**
 * Demo: high confidence decision denied by Gatekeeper.
 * Proves: AI confidence != permission.
 *
 * Run: npx tsx examples/high-confidence-denied.ts
 */

import { InMemoryCheckpointService } from '@hazeljs/agent';
import { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import {
  createDecisionRuntime,
  MockDecisionProvider,
  incidentRemediationDefinition,
  incidentState,
} from '../src';

async function main(): Promise<void> {
  let calls = 0;
  const gatekeeper = new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: [
      {
        id: 'deny-all-rollbacks',
        version: '1',
        match: { tools: ['deployment.rollback'] },
        rules: { denyWhen: async () => true },
      },
    ],
  });

  const mock = new MockDecisionProvider();
  mock.when('incident-remediation').return({
    decision: 'rollback',
    confidence: 0.99,
    score: 0.99,
  });

  const runtime = createDecisionRuntime({
    gatekeeper,
    checkpoints: new InMemoryCheckpointService(),
    capabilityHandlers: {
      'deployment.rollback': async () => {
        calls += 1;
        return { rolledBack: true };
      },
    },
  });
  runtime.providers.register(mock);
  runtime.registry.register({
    name: 'incident-remediation',
    ...incidentRemediationDefinition,
  });

  const result = await runtime.decide({
    name: 'incident-remediation',
    objective: incidentRemediationDefinition.objective,
    state: incidentState,
    choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
    risk: 'high',
    provider: 'mock',
    execute: true,
  });

  console.log('Decision:', result.decision);
  console.log('Confidence:', result.confidence);
  console.log('Policy:', result.policy.outcome);
  console.log('Authorized:', result.execution?.authorized);
  console.log('Invoked:', result.execution?.invoked ?? false);
  console.log('Handler calls:', calls);
  console.log('Execution: NOT AUTHORIZED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
