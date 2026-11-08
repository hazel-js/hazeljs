/**
 * Simulated mid-execution crash → recover → reconcile.
 *
 * Run: npm run demo:failure --workspace=@hazeljs/autonomous
 */
import { MemoryAutonomousRunStore, AutonomousRuntime } from '../../src';

async function main(): Promise<void> {
  const store = new MemoryAutonomousRunStore();
  const runtime = new AutonomousRuntime({ storage: store, autoDiscover: false });
  await runtime.start();

  await store.create({
    id: 'aar_crash_demo',
    serviceId: 'order-operations',
    tenantId: 'merchant-1',
    metadata: {
      kind: 'autonomous',
      serviceId: 'order-operations',
      phase: 'executing',
      mode: 'governed-auto',
      capabilityId: 'shipping.switch',
      effectStatus: 'uncertain',
      timeline: [
        {
          at: new Date().toISOString(),
          type: 'capability.execution.started',
          detail: 'shipping.switch',
        },
      ],
    },
  });
  await store.update('aar_crash_demo', { status: 'running' });

  console.log('Simulated crash during capability execution.');
  const recovered = await runtime.recover();
  const run = await runtime.inspect('aar_crash_demo');

  console.log('Recovered runs:', recovered);
  console.log('Phase after recovery:', run?.metadata.phase);
  console.log('Effect status:', run?.metadata.effectStatus);
  console.log('Timeline:', JSON.stringify(run?.metadata.timeline, null, 2));
  console.log(
    '\nDo not blindly re-issue shipping.switch — reconcile external carrier state first.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
