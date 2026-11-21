/**
 * Shared durable-step / load helpers for conformance benchmarks.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createDurableRunStore, AgentRunStatus } from '@hazeljs/agent';

const RESULTS = path.resolve(__dirname, '../results');
const BENCH_FILE = path.join(RESULTS, '.benchmarks.json');

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx]!;
}

export function summarizeLatencies(latencies: number[]) {
  return {
    stepP50Ms: percentile(latencies, 50),
    stepP95Ms: percentile(latencies, 95),
    stepP99Ms: percentile(latencies, 99),
    stepMinMs: Math.min(...latencies),
    stepMaxMs: Math.max(...latencies),
    stepMeanMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
  };
}

export interface DurableStepResult {
  name: string;
  steps: number;
  measuredRuns: number;
  payloadBytes: number;
  wallMs: number;
  stepsPerSec: number;
  persistence: string;
  stepP50Ms: number;
  stepP95Ms: number;
  stepP99Ms: number;
  stepMinMs: number;
  stepMaxMs: number;
  stepMeanMs: number;
}

/** One measured run of N sequential 1KiB (or sized) checkpoints. */
export async function runDurableSteps(opts: {
  steps: number;
  payloadBytes?: number;
  runId?: string;
}): Promise<{ latencies: number[]; wallMs: number }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hz-bench-'));
  const store = createDurableRunStore(dir);
  const latencies: number[] = [];
  const payload = 'x'.repeat(opts.payloadBytes ?? 1024);
  const id = opts.runId ?? `bench-${opts.steps}-${process.hrtime.bigint()}`;

  const run = await store.runRepository.create({
    id,
    agentName: 'bench',
    input: { n: opts.steps },
  });
  await store.runRepository.updateStatus(run.id, AgentRunStatus.RUNNING);

  const tWall0 = process.hrtime.bigint();
  for (let i = 0; i < opts.steps; i++) {
    const t0 = process.hrtime.bigint();
    await store.checkpointService.save(run.id, { step: i, payload });
    latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const wallMs = Number(process.hrtime.bigint() - tWall0) / 1e6;
  await store.runRepository.updateStatus(run.id, AgentRunStatus.COMPLETED);
  fs.rmSync(dir, { recursive: true, force: true });
  return { latencies, wallMs };
}

/** Repeat measured runs; first run can be discarded as warmup. */
export async function measureDurableSteps(opts: {
  name: string;
  steps: number;
  measuredRuns: number;
  warmupRuns?: number;
  payloadBytes?: number;
}): Promise<DurableStepResult> {
  const warmup = opts.warmupRuns ?? 0;
  const allLatencies: number[] = [];
  let wallTotal = 0;

  for (let r = 0; r < warmup + opts.measuredRuns; r++) {
    const { latencies, wallMs } = await runDurableSteps({
      steps: opts.steps,
      payloadBytes: opts.payloadBytes,
      runId: `${opts.name}-r${r}`,
    });
    if (r >= warmup) {
      allLatencies.push(...latencies);
      wallTotal += wallMs;
    }
  }

  const stats = summarizeLatencies(allLatencies);
  const totalSteps = opts.steps * opts.measuredRuns;
  return {
    name: opts.name,
    steps: opts.steps,
    measuredRuns: opts.measuredRuns,
    payloadBytes: opts.payloadBytes ?? 1024,
    wallMs: wallTotal,
    stepsPerSec: wallTotal > 0 ? (totalSteps / wallTotal) * 1000 : 0,
    persistence: 'createDurableRunStore(file)',
    ...stats,
  };
}

/** N parallel durable runs × steps each — stresses concurrent file store access. */
export async function measureConcurrentDurable(opts: {
  name: string;
  parallelRuns: number;
  stepsPerRun: number;
  payloadBytes?: number;
}): Promise<DurableStepResult & { parallelRuns: number }> {
  const t0 = process.hrtime.bigint();
  const results = await Promise.all(
    Array.from({ length: opts.parallelRuns }, (_, i) =>
      runDurableSteps({
        steps: opts.stepsPerRun,
        payloadBytes: opts.payloadBytes,
        runId: `${opts.name}-p${i}`,
      })
    )
  );
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const allLatencies = results.flatMap((r) => r.latencies);
  const stats = summarizeLatencies(allLatencies);
  const totalSteps = opts.parallelRuns * opts.stepsPerRun;
  return {
    name: opts.name,
    steps: opts.stepsPerRun,
    parallelRuns: opts.parallelRuns,
    measuredRuns: opts.parallelRuns,
    payloadBytes: opts.payloadBytes ?? 1024,
    wallMs,
    stepsPerSec: wallMs > 0 ? (totalSteps / wallMs) * 1000 : 0,
    persistence: 'createDurableRunStore(file)',
    ...stats,
  };
}

export function appendBenchmark(row: object): void {
  fs.mkdirSync(RESULTS, { recursive: true });
  let list: object[] = [];
  try {
    list = JSON.parse(fs.readFileSync(BENCH_FILE, 'utf8')) as object[];
  } catch {
    list = [];
  }
  list.push(row);
  fs.writeFileSync(BENCH_FILE, JSON.stringify(list, null, 2));
}
