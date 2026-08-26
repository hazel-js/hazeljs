import type { SkillgateReport } from './types';

/** Pretty-print a Skillgate governance report for boot logs / CLI. */
export function formatSkillgateReport(report: SkillgateReport): string {
  const lines: string[] = [];
  lines.push('┌─ Skillgate report ─────────────────────────────────────────────');
  lines.push(`│ Included (${report.included.length}):`);
  for (const s of report.included) {
    const flags = [s.class, s.readOnly ? 'readOnly' : null, s.requiresApproval ? 'approval' : null]
      .filter(Boolean)
      .join(', ');
    lines.push(`│   ✓ ${s.name.padEnd(18)} ${s.method.padEnd(6)} ${s.path}  [${flags}]`);
  }
  lines.push(`│ Denied (${report.denied.length}):`);
  for (const s of report.denied) {
    lines.push(
      `│   ✗ ${s.name.padEnd(18)} ${s.method.padEnd(6)} ${s.path}  — ${s.denyReason ?? s.class}`
    );
  }
  if (report.warnings.length) {
    lines.push('│ Warnings:');
    for (const w of report.warnings) lines.push(`│   ! ${w}`);
  }
  lines.push('└────────────────────────────────────────────────────────────────');
  return lines.join('\n');
}
