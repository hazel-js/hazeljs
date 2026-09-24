/**
 * Flagship CLI demo — Production Incident Decision Agent.
 *
 * Run: npx tsx examples/incident-remediation.ts
 */

import { InMemoryCheckpointService, InMemoryHumanTaskService } from '@hazeljs/agent';
import { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import { createDecisionRuntime, incidentRemediationDefinition, incidentState } from '../src';

async function main(): Promise<void> {
  const gatekeeper = new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: [
      {
        id: 'allow-rollback',
        version: '1',
        priority: 10,
        match: { tools: ['deployment.rollback'] },
        rules: { allowWhen: async () => true },
      },
    ],
  });

  const runtime = createDecisionRuntime({
    gatekeeper,
    checkpoints: new InMemoryCheckpointService(),
    humanTasks: new InMemoryHumanTaskService(),
    capabilityHandlers: {
      'deployment.rollback': async ({ decisionId }) => ({
        rolledBack: true,
        decisionId,
      }),
    },
  });

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
    provider: 'hazel-agent',
    execute: true,
    context: { agentId: 'incident-agent', tenantId: 'demo', environment: 'production' },
  });

  console.log('HazelJS Decision Run');
  console.log('Decision');
  console.log(`  ${result.provenance.definitionName}`);
  console.log('Risk');
  console.log(`  ${result.risk.level.toUpperCase()}`);
  console.log('Strategy');
  console.log(`  ${result.strategy.toUpperCase()}`);
  console.log('Evidence');
  for (const e of result.evidence ?? []) {
    console.log(`  ✓ ${e.key} = ${JSON.stringify(e.value)} (relevance ${e.relevance})`);
  }
  console.log('Candidates');
  for (const c of [...(result.candidates ?? [])].sort((a, b) => b.score - a.score)) {
    console.log(`  ${c.candidate.padEnd(10)} ${c.score.toFixed(2)}`);
  }
  console.log('Judge');
  console.log(`  ${String(result.decision).toUpperCase()}`);
  console.log('Critic');
  console.log(`  ${(result.critic?.status ?? 'skipped').toUpperCase()}`);
  console.log('Confidence');
  console.log(`  ${result.confidence.toFixed(2)}`);
  console.log(`  ${result.confidenceDetail.type}`);
  console.log('Policy');
  console.log(`  ${result.policy.outcome.toUpperCase()}`);
  console.log('Skillgate / Gatekeeper');
  console.log(`  ${result.execution?.capability ?? 'n/a'}`);
  console.log(
    `  ${result.execution?.authorized ? 'AUTHORIZED' : result.execution?.authorized === false ? 'DENIED' : 'N/A'}`
  );
  console.log('Durable Run');
  console.log(`  ${result.trace.runId}`);
  console.log('Execution');
  console.log(`  ${result.execution?.invoked ? 'COMPLETED' : result.status}`);
  console.log('Latency');
  console.log(`  total ${result.latency.totalMs}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
