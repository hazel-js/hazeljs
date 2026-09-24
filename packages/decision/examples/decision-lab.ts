/**
 * Decision Lab CLI — run + compare.
 * npx tsx examples/decision-lab.ts
 */

import {
  createDecisionRuntime,
  createDecisionLab,
  MockDecisionProvider,
  incidentRemediationDefinition,
  incidentState,
} from '../src';

async function main(): Promise<void> {
  const runtime = createDecisionRuntime();
  runtime.registry.register({
    name: 'incident-remediation',
    ...incidentRemediationDefinition,
  });

  const mock = new MockDecisionProvider();
  mock.when('incident-remediation').return({ decision: 'escalate', confidence: 0.77 });
  runtime.providers.register(mock);

  const lab = createDecisionLab(runtime);
  const run = await lab.run({
    name: 'incident-remediation',
    objective: incidentRemediationDefinition.objective,
    state: incidentState,
    choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
    risk: 'high',
    provider: 'hazel-agent',
  });

  console.log('Decision Lab Run');
  console.log('  decision:', run.result.decision);
  console.log('  confidence:', run.result.confidence.toFixed(3));
  console.log('  graph:', run.graph.map((n) => `${n.id}:${n.status}`).join(' → '));

  const cmp = await lab.compare(
    {
      name: 'incident-remediation',
      objective: incidentRemediationDefinition.objective,
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'high',
    },
    ['hazel-agent', 'mock']
  );
  console.log('\nCompare (executionForbidden=', cmp.executionForbidden, ')');
  for (const row of cmp.rows) {
    console.log(
      `  ${row.provider.padEnd(12)} ${row.decision ?? row.error}  conf=${row.confidence?.toFixed(2) ?? '—'}  ${row.latencyMs ?? '—'}ms`
    );
  }
  console.log('  agreement:', cmp.agreement);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
