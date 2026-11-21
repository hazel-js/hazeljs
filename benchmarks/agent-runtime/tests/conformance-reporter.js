/**
 * Jest reporter — merges scenario evidence into results/latest.{json,md}
 * and prints the markdown summary at the end of the run.
 */
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(__dirname, '../results');
const EVIDENCE_PATH = path.join(RESULTS_DIR, '.evidence.json');

function readEvidence() {
  try {
    return JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function readBenchmarks() {
  const p = path.join(RESULTS_DIR, '.benchmarks.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

function buildReport(scenarios, benchmarks) {
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

function formatMarkdown(report) {
  const lines = [
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
    if (s.steps?.length) {
      lines.push('**What happened**');
      s.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push('');
    }
    if (s.observations && Object.keys(s.observations).length) {
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
    lines.push('## Benchmarks (load)');
    lines.push('');
    lines.push('| name | steps/cycles | runs | wall ms | throughput | p50 ms | p95 ms | p99 ms |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const b of report.benchmarks) {
      const n = b.steps ?? b.cycles ?? '—';
      const runs = b.measuredRuns ?? b.parallelRuns ?? '—';
      const wall = typeof b.wallMs === 'number' ? b.wallMs.toFixed(1) : '—';
      const thr =
        typeof b.stepsPerSec === 'number'
          ? `${b.stepsPerSec.toFixed(0)} steps/s`
          : typeof b.cyclesPerSec === 'number'
            ? `${b.cyclesPerSec.toFixed(2)} cycles/s`
            : '—';
      const p50 = typeof b.stepP50Ms === 'number' ? b.stepP50Ms.toFixed(3) : '—';
      const p95 = typeof b.stepP95Ms === 'number' ? b.stepP95Ms.toFixed(3) : '—';
      const p99 = typeof b.stepP99Ms === 'number' ? b.stepP99Ms.toFixed(3) : '—';
      lines.push(
        `| ${b.name ?? 'bench'} | ${n} | ${runs} | ${wall} | ${thr} | ${p50} | ${p95} | ${p99} |`
      );
    }
    lines.push('');
    lines.push('<details><summary>Raw benchmark JSON</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.benchmarks, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  return lines.join('\n');
}

class ConformanceReporter {
  onRunComplete(_contexts, results) {
    const evidence = readEvidence();
    const byId = new Map(evidence.map((e) => [e.id, e]));

    // Mark evidence fail if matching Jest test failed and evidence still says pass.
    for (const suite of results.testResults) {
      for (const t of suite.testResults) {
        if (t.status !== 'failed') continue;
        for (const [id, e] of byId) {
          if (t.fullName.includes(e.title) || e.title.includes(t.title)) {
            byId.set(id, {
              ...e,
              status: 'fail',
              error: (t.failureMessages && t.failureMessages[0]) || 'jest failed',
            });
          }
        }
      }
    }

    const scenarios = [...byId.values()];
    const report = buildReport(scenarios, readBenchmarks());
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const jsonPath = path.join(RESULTS_DIR, 'latest.json');
    const mdPath = path.join(RESULTS_DIR, 'latest.md');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    const md = formatMarkdown(report);
    fs.writeFileSync(mdPath, md);

    // eslint-disable-next-line no-console
    console.log('\n' + md);
    // eslint-disable-next-line no-console
    console.log(`\nWrote ${path.relative(process.cwd(), jsonPath)} and ${path.relative(process.cwd(), mdPath)}\n`);
  }
}

module.exports = ConformanceReporter;
