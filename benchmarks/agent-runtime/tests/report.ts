/**
 * Conformance evidence — tests record what happened; reporter writes results/.
 */
import * as fs from 'fs';
import * as path from 'path';

export type ScenarioStatus = 'pass' | 'fail' | 'unsupported' | 'skipped';

export interface ScenarioEvidence {
  id: string;
  title: string;
  status: ScenarioStatus;
  /** What the test actually did / observed (ordered). */
  steps: string[];
  /** Concrete measurements / assertions that matter for the claim. */
  observations: Record<string, unknown>;
  claim?: string;
  error?: string;
}

const EVIDENCE_PATH = path.resolve(__dirname, '../results/.evidence.json');
const RESULTS_DIR = path.resolve(__dirname, '../results');

export function resetEvidence(): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, '[]');
}

export function recordScenario(entry: ScenarioEvidence): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  let list: ScenarioEvidence[] = [];
  try {
    list = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')) as ScenarioEvidence[];
  } catch {
    list = [];
  }
  const i = list.findIndex((s) => s.id === entry.id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(list, null, 2));
}

export function readEvidence(): ScenarioEvidence[] {
  try {
    return JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')) as ScenarioEvidence[];
  } catch {
    return [];
  }
}

export interface ConformanceReport {
  generatedAt: string;
  platform: string;
  node: string;
  suite: string;
  summary: {
    pass: number;
    fail: number;
    unsupported: number;
    skipped: number;
  };
  claim: string;
  scenarios: ScenarioEvidence[];
  benchmarks?: Record<string, unknown>[];
}

export function buildReport(
  scenarios: ScenarioEvidence[],
  benchmarks: Record<string, unknown>[] = []
): ConformanceReport {
  const summary = { pass: 0, fail: 0, unsupported: 0, skipped: 0 };
  for (const s of scenarios) {
    if (s.status === 'pass') summary.pass += 1;
    else if (s.status === 'fail') summary.fail += 1;
    else if (s.status === 'unsupported') summary.unsupported += 1;
    else summary.skipped += 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    suite: '@hazeljs/agent-runtime-conformance',
    summary,
    claim:
      'Under this fake order idempotency/reconciliation contract, crash-tested refund workflows completed without a second refund when crash scenarios pass. Not a universal exactly-once guarantee.',
    scenarios,
    benchmarks: benchmarks.length ? benchmarks : undefined,
  };
}

export function formatReportMarkdown(report: ConformanceReport): string {
  const lines: string[] = [
    '# Agent Runtime Conformance Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Platform: ${report.platform} / Node ${report.node}`,
    `- Summary: **${report.summary.pass} pass**, ${report.summary.fail} fail, ${report.summary.unsupported} unsupported, ${report.summary.skipped} skipped`,
    '',
    '## Claim',
    '',
    report.claim,
    '',
    '## Scenarios',
    '',
  ];

  for (const s of report.scenarios) {
    lines.push(`### ${s.id} — ${s.status.toUpperCase()}`);
    lines.push('');
    lines.push(s.title);
    lines.push('');
    if (s.steps.length) {
      lines.push('**What happened**');
      for (const step of s.steps) lines.push(`1. ${step}`);
      lines.push('');
    }
    if (Object.keys(s.observations).length) {
      lines.push('**Observations**');
      lines.push('```json');
      lines.push(JSON.stringify(s.observations, null, 2));
      lines.push('```');
      lines.push('');
    }
    if (s.claim) {
      lines.push(`**Narrow claim:** ${s.claim}`);
      lines.push('');
    }
    if (s.error) {
      lines.push(`**Error:** ${s.error}`);
      lines.push('');
    }
  }

  if (report.benchmarks?.length) {
    lines.push('## Benchmarks');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.benchmarks, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function writeReportFiles(report: ConformanceReport): {
  jsonPath: string;
  mdPath: string;
} {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = path.join(RESULTS_DIR, 'latest.json');
  const mdPath = path.join(RESULTS_DIR, 'latest.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, formatReportMarkdown(report));
  return { jsonPath, mdPath };
}
