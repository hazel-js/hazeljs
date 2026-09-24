/**
 * Flow projection + calibration example.
 * npx tsx examples/flow-and-calibration.ts
 */

import {
  createDecisionRuntime,
  DecisionHistory,
  projectDecisionFlow,
  fitCalibrationFromHistory,
  calibrateConfidence,
  incidentRemediationDefinition,
  incidentState,
} from '../src';

async function main(): Promise<void> {
  const graph = projectDecisionFlow({
    name: 'incident-remediation',
    risk: 'high',
  });
  console.log(
    'Flow:',
    graph.strategy,
    '→',
    graph.nodes
      .filter((n) => n.enabled)
      .map((n) => n.id)
      .join(' → ')
  );

  const history = new DecisionHistory();
  const runtime = createDecisionRuntime({ history });
  runtime.registry.register({
    name: 'incident-remediation',
    ...incidentRemediationDefinition,
  });

  for (let i = 0; i < 6; i++) {
    const r = await runtime.decide({
      name: 'incident-remediation',
      objective: incidentRemediationDefinition.objective,
      state: { ...incidentState, seed: i },
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'high',
      provider: 'hazel-agent',
    });
    runtime.evaluate({
      decisionId: r.id,
      expectedDecision: String(r.decision),
    });
  }

  const model = fitCalibrationFromHistory(history, { bins: 5 });
  console.log('Calibration ECE:', model.ece.toFixed(3), 'n=', model.n);
  console.log('Trends:', history.trends());

  const sample = await runtime.decide({
    name: 'incident-remediation',
    objective: incidentRemediationDefinition.objective,
    state: incidentState,
    choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
    risk: 'high',
    provider: 'hazel-agent',
  });
  const calibrated = calibrateConfidence(sample.confidenceDetail, model);
  console.log('Raw confidence:', sample.confidence.toFixed(3));
  console.log('Calibrated (reporting only):', calibrated.value.toFixed(3));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
