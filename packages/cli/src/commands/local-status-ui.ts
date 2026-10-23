/**
 * Thin local status page for `hazel ui` — polls hazeld via control socket.
 * No new dashboard package; five panes as simple HTML sections.
 */

import * as http from 'http';
import { controlRequest, hazelHome, type ControlRequest } from '@hazeljs/agent';

async function fetchJson(op: ControlRequest['op'], extra: Record<string, unknown> = {}) {
  const res = await controlRequest({ op, ...extra } as ControlRequest, hazelHome().socketPath);
  if (!res.ok) throw new Error(res.error ?? op);
  return res.data;
}

function pageHtml(payload: {
  status: unknown;
  agents: unknown;
  approvals: unknown;
  runs: unknown;
  error?: string;
}): string {
  const { status, agents, approvals, runs, error } = payload;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Hazel Local Agent OS</title>
  <meta http-equiv="refresh" content="5" />
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 1.5rem; background: #f6f4ef; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    h2 { font-size: 0.95rem; margin: 1.25rem 0 0.5rem; text-transform: uppercase; letter-spacing: 0.04em; }
    pre { background: #fff; border: 1px solid #ddd; padding: 0.75rem; overflow: auto; font-size: 12px; }
    .err { color: #a30; }
    .grid { display: grid; gap: 0.5rem; }
  </style>
</head>
<body>
  <h1>Hazel Local Agent OS</h1>
  <p>Bound to hazeld control socket. Auto-refresh 5s. Use <code>hazel ps</code> / <code>approvals</code> / <code>doctor</code> in the terminal for full control.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <div class="grid">
    <section><h2>System</h2><pre>${escapeHtml(JSON.stringify(status, null, 2))}</pre></section>
    <section><h2>Agents</h2><pre>${escapeHtml(JSON.stringify(agents, null, 2))}</pre></section>
    <section><h2>Runs</h2><pre>${escapeHtml(JSON.stringify(runs, null, 2))}</pre></section>
    <section><h2>Approvals</h2><pre>${escapeHtml(JSON.stringify(approvals, null, 2))}</pre></section>
    <section><h2>Skills</h2><pre>(per-agent skills: hazel inspect &lt;id&gt;)</pre></section>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function serveLocalStatusUi(port: number): Promise<http.Server> {
  const server = http.createServer(async (_req, res) => {
    try {
      const [status, agents, approvals, runs] = await Promise.all([
        fetchJson('status'),
        fetchJson('list'),
        fetchJson('approvals'),
        fetchJson('runs'),
      ]);
      const html = pageHtml({ status, agents, approvals, runs });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      const html = pageHtml({
        status: null,
        agents: [],
        approvals: [],
        runs: [],
        error: e instanceof Error ? e.message : String(e),
      });
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return server;
}
