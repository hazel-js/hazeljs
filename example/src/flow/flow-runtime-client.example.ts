/**
 * Client example for the flow-runtime HTTP API.
 * Start the runtime first: npm run flow:runtime (from example dir, or pnpm flow:runtime from repo root).
 * Requires DATABASE_URL for the runtime. Then run: npm run flow:runtime:client
 */
const BASE = process.env.FLOW_RUNTIME_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  console.log('Flow runtime client example');
  console.log('Base URL:', BASE);
  console.log('(Start flow-runtime with: npm run flow:runtime)\n');

  const listRes = await fetch(`${BASE}/v1/flows`);
  if (!listRes.ok) {
    console.error('Failed to list flows. Is flow-runtime running?', listRes.status, await listRes.text());
    process.exit(1);
  }
  const flows = (await listRes.json()) as Array<{ flowId: string; version: string }>;
  console.log('Registered flows:', flows.map((f) => `${f.flowId}@${f.version}`).join(', '));

  const flowId = flows[0]?.flowId ?? 'demo-fraud';
  const version = flows[0]?.version ?? '1.0.0';

  const startRes = await fetch(`${BASE}/v1/runs/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      version,
      input: flowId === 'demo-fraud' ? { amount: 500, userId: 'user-1' } : {},
    }),
  });
  if (!startRes.ok) {
    console.error('Failed to start run', startRes.status, await startRes.text());
    process.exit(1);
  }
  const { runId, status } = (await startRes.json()) as { runId: string; status: string };
  console.log('Started run:', runId, status);

  let run: { runId: string; status: string; outputsJson?: unknown } = { runId, status };
  while (run.status === 'RUNNING' || run.status === 'WAITING') {
    await new Promise((r) => setTimeout(r, 100));
    const tickRes = await fetch(`${BASE}/v1/runs/${runId}/tick`, { method: 'POST' });
    if (!tickRes.ok) {
      console.error('Tick failed', tickRes.status, await tickRes.text());
      process.exit(1);
    }
    run = await tickRes.json();
  }

  console.log('Run finished:', run.status, run.outputsJson);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
