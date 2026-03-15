const BASE = (() => {
  const m = window.location.pathname.match(/^\/[^/]+/);
  return m ? m[0] : '/__hazel';
})();

const APP_BASE = window.location.origin;

let snapshot: { entries: unknown[]; summary?: Record<string, number>; overview?: Record<string, unknown> } | null = null;
let fetchInFlight = false;
let memoryHistory: { heap: number; rss: number; t: number }[] = [];
const MEMORY_HISTORY_MAX = 60;

async function fetchSnapshot(refresh = false): Promise<{ entries: unknown[]; summary?: Record<string, number>; overview?: Record<string, unknown> }> {
  const url = `${BASE}/inspect${refresh ? '?refresh=1' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

async function fetchStats(): Promise<{ memory?: { rss: number; heapUsed: number }; uptimeSeconds?: number }> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) return {};
  return res.json();
}

async function fetchEnv(): Promise<{ nodeVersion?: string; nodeEnv?: string; inspectorVersion?: string; platform?: string; arch?: string }> {
  const res = await fetch(`${BASE}/env`);
  if (!res.ok) return {};
  return res.json();
}

async function fetchHealth(endpoint: string): Promise<{ status: string; ok: boolean; data?: unknown }> {
  try {
    const res = await fetch(`${APP_BASE}${endpoint}`);
    const ok = res.ok;
    let data: unknown;
    const ct = res.headers.get('content-type');
    if (ct?.includes('application/json')) data = await res.json();
    else data = await res.text();
    return { status: ok ? 'up' : 'down', ok, data };
  } catch {
    return { status: 'down', ok: false };
  }
}

function setLoading(loading: boolean) {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('hidden', !loading);
}

function updateStatusBar(health: { health?: { ok: boolean }; ready?: { ok: boolean }; startup?: { ok: boolean } }, stats: { uptimeSeconds?: number }) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const uptime = document.getElementById('status-uptime');
  if (!dot || !text || !uptime) return;
  const allOk = health?.health?.ok && health?.ready?.ok && health?.startup?.ok;
  const anyOk = health?.health?.ok || health?.ready?.ok || health?.startup?.ok;
  dot.className = 'status-dot' + (allOk ? ' healthy' : anyOk ? '' : ' unhealthy');
  text.textContent = allOk ? 'All systems operational' : anyOk ? 'Degraded' : 'Offline';
  uptime.textContent = stats.uptimeSeconds != null ? `Uptime: ${formatUptime(stats.uptimeSeconds)}` : '';
}

function updateQuickStats(summary: Record<string, number>) {
  const el = document.getElementById('quick-stats');
  if (!el) return;
  const s = summary && typeof summary === 'object' ? summary : {};
  const parts: string[] = [];
  if ((s.route ?? 0) > 0) parts.push(`<span class="quick-stat"><strong>${s.route}</strong> routes</span>`);
  if ((s.module ?? 0) > 0) parts.push(`<span class="quick-stat"><strong>${s.module}</strong> modules</span>`);
  if ((s.provider ?? 0) > 0) parts.push(`<span class="quick-stat"><strong>${s.provider}</strong> providers</span>`);
  if ((s.cron ?? 0) > 0) parts.push(`<span class="quick-stat"><strong>${s.cron}</strong> jobs</span>`);
  el.innerHTML = parts.join('') || '<span class="quick-stat muted">No data</span>';
}

function showOfflineBanner(show: boolean) {
  let banner = document.getElementById('offline-banner');
  if (show && !banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '<span>App not running. Check that your server is started.</span><button id="retry-btn">Retry</button>';
    document.querySelector('.content')?.insertBefore(banner, document.querySelector('.toolbar'));
    banner.querySelector('#retry-btn')?.addEventListener('click', () => load(true));
  }
  if (banner) banner.classList.toggle('hidden', !show);
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getMethodBadge(method: string): string {
  const m = String(method || '').toUpperCase();
  const cls = m === 'GET' ? 'get' : m === 'POST' ? 'post' : m === 'PUT' ? 'put' : m === 'PATCH' ? 'patch' : m === 'DELETE' ? 'delete' : 'default';
  return `<span class="badge badge-${cls}">${m || '?'}</span>`;
}

function syntaxHighlightJson(obj: unknown): string {
  const str = JSON.stringify(obj, null, 2);
  return str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = match.endsWith(':') ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${escapeHtml(match)}</span>`;
    }
  );
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

const CARD_ICONS: Record<string, string> = {
  route: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  module: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  provider: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  cron: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  queue: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  websocket: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  agent: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>',
  rag: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>',
  prompt: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  aifunction: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>',
  event: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>',
  graphql: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 12h14"/><path d="M3 8l9-5 9 5"/><path d="M3 16l9 5 9-5"/></svg>',
  grpc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',
  kafka: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
  flow: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  data: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  serverless: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  ml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>',
  decorator: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

const OVERVIEW_SECTIONS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: 'Framework',
    items: [
      { key: 'route', label: 'Routes' },
      { key: 'module', label: 'Modules' },
      { key: 'provider', label: 'Providers' },
      { key: 'decorator', label: 'Decorators' },
    ],
  },
  {
    title: 'Scheduled & Async',
    items: [
      { key: 'cron', label: 'Cron Jobs' },
      { key: 'queue', label: 'Queues' },
    ],
  },
  {
    title: 'AI & Intelligence',
    items: [
      { key: 'agent', label: 'Agents' },
      { key: 'aifunction', label: 'AI Functions' },
      { key: 'rag', label: 'RAG' },
      { key: 'prompt', label: 'Prompts' },
      { key: 'ml', label: 'ML' },
    ],
  },
  {
    title: 'APIs & Messaging',
    items: [
      { key: 'graphql', label: 'GraphQL' },
      { key: 'grpc', label: 'gRPC' },
      { key: 'kafka', label: 'Kafka' },
      { key: 'websocket', label: 'WebSockets' },
      { key: 'event', label: 'Events' },
    ],
  },
  {
    title: 'Workflows & Data',
    items: [
      { key: 'flow', label: 'Flows' },
      { key: 'data', label: 'Data' },
      { key: 'serverless', label: 'Serverless' },
    ],
  },
];

function renderOverview(summary: Record<string, number>) {
  const container = document.getElementById('summary-cards')!;
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  container.innerHTML = OVERVIEW_SECTIONS.map(
    (section) => `
    <section class="overview-section">
      <h3 class="overview-section-title">${escapeHtml(section.title)}</h3>
      <div class="overview-section-cards">
        ${(Array.isArray(section.items) ? section.items : [])
          .map(
            (k) =>
              `<div class="card" data-kind="${escapeHtml(k.key)}">
                <div class="card-icon">${CARD_ICONS[k.key] ?? ''}</div>
                <div class="card-label">${escapeHtml(k.label)}</div>
                <div class="card-value">${safeSummary[k.key] ?? 0}</div>
              </div>`
          )
          .join('')}
      </div>
    </section>
  `
  ).join('');
}

const RUNTIME_ICONS = {
  heap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>',
  rss: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  uptime: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

function renderEnv(env: { nodeVersion?: string; nodeEnv?: string; inspectorVersion?: string; platform?: string; arch?: string }) {
  const el = document.getElementById('env-info');
  if (!el) return;
  el.innerHTML = `
    <div class="env-item"><strong>Node</strong> ${escapeHtml(env.nodeVersion ?? '—')}</div>
    <div class="env-item"><strong>NODE_ENV</strong> ${escapeHtml(env.nodeEnv ?? '—')}</div>
    <div class="env-item"><strong>Inspector</strong> ${escapeHtml(env.inspectorVersion ?? '—')}</div>
    <div class="env-item"><strong>Platform</strong> ${escapeHtml(env.platform ?? '—')}</div>
    <div class="env-item"><strong>Arch</strong> ${escapeHtml(env.arch ?? '—')}</div>
  `;
}

function renderGatewayOverview(data: { routes: string[]; totalRoutes: number; metrics?: { totalCalls: number; successCalls: number; failureCalls: number; failureRate: number; averageResponseTime: number } }) {
  const el = document.getElementById('overview-gateway');
  if (!el) return;
  const routes = Array.isArray(data.routes) ? data.routes : [];
  const m = data.metrics;
  el.innerHTML = `
    <h3 class="overview-block-title">Gateway</h3>
    <div class="overview-gateway-stats">
      <div class="overview-stat"><span class="stat-value">${routes.length}</span><span class="stat-label">Routes</span></div>
      ${m ? `
      <div class="overview-stat"><span class="stat-value">${m.totalCalls}</span><span class="stat-label">Total Calls</span></div>
      <div class="overview-stat"><span class="stat-value">${m.successCalls}</span><span class="stat-label">Success</span></div>
      <div class="overview-stat"><span class="stat-value">${(m.failureRate ?? 0).toFixed(1)}%</span><span class="stat-label">Failure Rate</span></div>
      <div class="overview-stat"><span class="stat-value">${(m.averageResponseTime ?? 0).toFixed(0)}ms</span><span class="stat-label">Avg Latency</span></div>
      ` : ''}
    </div>
    ${routes.length ? `<div class="overview-gateway-routes"><strong>Routes:</strong> ${routes.slice(0, 8).map((r) => `<code>${escapeHtml(r)}</code>`).join(', ')}${routes.length > 8 ? ` <span class="muted">+${routes.length - 8} more</span>` : ''}</div>` : ''}
  `;
  el.classList.remove('hidden');
}

function renderDiscoveryOverview(data: { services: string[]; totalServices: number; totalInstances: number; instancesByService: Record<string, number> }) {
  const el = document.getElementById('overview-discovery');
  if (!el) return;
  const services = Array.isArray(data.services) ? data.services : [];
  const bySvc = data.instancesByService && typeof data.instancesByService === 'object' ? data.instancesByService : {};
  const instancesList = services
    .slice(0, 6)
    .map((s) => `<span class="discovery-service"><code>${escapeHtml(s)}</code>: ${bySvc[s] ?? 0} instance(s)</span>`)
    .join(', ');
  el.innerHTML = `
    <h3 class="overview-block-title">Discovery</h3>
    <div class="overview-discovery-stats">
      <div class="overview-stat"><span class="stat-value">${data.totalServices ?? 0}</span><span class="stat-label">Services</span></div>
      <div class="overview-stat"><span class="stat-value">${data.totalInstances ?? 0}</span><span class="stat-label">Connected Instances</span></div>
    </div>
    ${services.length ? `<div class="overview-discovery-services">${instancesList}${services.length > 6 ? ` <span class="muted">+${services.length - 6} more</span>` : ''}</div>` : '<p class="muted">No services registered</p>'}
  `;
  el.classList.remove('hidden');
}

function renderResilienceOverview(data: { circuitBreakers: number; circuitBreakerStates: { name: string; state: string }[] }) {
  const el = document.getElementById('overview-resilience');
  if (!el) return;
  const states = Array.isArray(data.circuitBreakerStates) ? data.circuitBreakerStates : [];
  const statesList = states
    .map((s) => `<span class="cb-state ${(s.state || '').toLowerCase()}"><code>${escapeHtml(s.name)}</code>: ${escapeHtml(s.state)}</span>`)
    .join(', ');
  el.innerHTML = `
    <h3 class="overview-block-title">Resilience</h3>
    <div class="overview-resilience-stats">
      <div class="overview-stat"><span class="stat-value">${data.circuitBreakers ?? 0}</span><span class="stat-label">Circuit Breakers</span></div>
    </div>
    ${states.length ? `<div class="overview-resilience-states">${statesList}</div>` : ''}
  `;
  el.classList.remove('hidden');
}

function renderHealth(health: { health?: { status: string; ok: boolean }; ready?: { status: string; ok: boolean }; startup?: { status: string; ok: boolean } }) {
  const el = document.getElementById('health-cards');
  if (!el) return;
  const cards = [
    { key: 'health', endpoint: '/health', label: 'Health', data: health.health },
    { key: 'ready', endpoint: '/ready', label: 'Ready', data: health.ready },
    { key: 'startup', endpoint: '/startup', label: 'Startup', data: health.startup },
  ];
  el.innerHTML = cards
    .map((c) => {
      const d = c.data ?? { status: 'unknown', ok: false };
      const cls = d.ok ? 'healthy' : d.status === 'unknown' ? 'unknown' : 'unhealthy';
      return `
        <div class="health-card ${cls}">
          <h3>${escapeHtml(c.label)}</h3>
          <div class="status">${d.ok ? 'Up' : d.status === 'unknown' ? 'Unknown' : 'Down'}</div>
          <div class="endpoint">${escapeHtml(c.endpoint)}</div>
        </div>
      `;
    })
    .join('');
}

function renderRuntime(stats: { memory?: { rss: number; heapUsed: number }; uptimeSeconds?: number }) {
  const el = document.getElementById('runtime-cards')!;
  const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
  if (stats.memory) {
    memoryHistory.push({
      heap: stats.memory.heapUsed,
      rss: stats.memory.rss,
      t: Date.now(),
    });
    if (memoryHistory.length > MEMORY_HISTORY_MAX) memoryHistory.shift();
  }
  el.innerHTML = `
    <div class="card">
      <div class="card-icon">${RUNTIME_ICONS.heap}</div>
      <div class="card-label">Heap Used</div>
      <div class="card-value">${stats.memory?.heapUsed ? mb(stats.memory.heapUsed) + ' MB' : '—'}</div>
    </div>
    <div class="card">
      <div class="card-icon">${RUNTIME_ICONS.rss}</div>
      <div class="card-label">RSS Memory</div>
      <div class="card-value">${stats.memory?.rss ? mb(stats.memory.rss) + ' MB' : '—'}</div>
    </div>
    <div class="card">
      <div class="card-icon">${RUNTIME_ICONS.uptime}</div>
      <div class="card-label">Uptime</div>
      <div class="card-value highlight">${stats.uptimeSeconds != null ? formatUptime(stats.uptimeSeconds) : '—'}</div>
    </div>
  `;
  renderMemoryChart();
}

function renderMemoryChart() {
  const container = document.getElementById('memory-chart-container');
  if (!container || memoryHistory.length < 2) {
    container?.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  const maxHeap = Math.max(...memoryHistory.map((m) => m.heap));
  const maxRss = Math.max(...memoryHistory.map((m) => m.rss));
  const max = Math.max(maxHeap, maxRss, 1);
  const mb = (n: number) => (n / 1024 / 1024 / max) * 100;
  const points = memoryHistory
    .map((m, i) => {
      const x = (i / (memoryHistory.length - 1)) * 100;
      return `${x},${100 - mb(m.heap)}`;
    })
    .join(' ');
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="none">
      <polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${points}"/>
    </svg>
    <div style="font-size:11px;color:var(--text-muted);margin-top:0.5rem">Heap over time (last ${memoryHistory.length} samples)</div>
  `;
}

const tableSortState: Record<string, { col: string; dir: 'asc' | 'desc' }> = {};
const PAGE_SIZE = 50;

interface FlowGraph {
  nodes: string[];
  edges: { from: string; to: string }[];
  entryNode: string;
}

function buildFlowGraphs(flows: Record<string, unknown>[]): Map<string, FlowGraph> {
  const byFlowId = new Map<string, Record<string, unknown>[]>();
  for (const f of flows) {
    const fid = String((f as Record<string, string>).flowId ?? '');
    if (!byFlowId.has(fid)) byFlowId.set(fid, []);
    byFlowId.get(fid)!.push(f);
  }
  const byFlow = new Map<string, FlowGraph>();
  for (const [fid, entries] of byFlowId) {
    const flowDef = entries.find((e) => !!String((e as Record<string, string>).nodes ?? '').trim());
    const f = (flowDef ?? entries[0]) as Record<string, string>;
    const nodesStr = f.nodes ?? '';
    let nodes = nodesStr
      .split(/[,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (nodes.length === 0) {
      nodes = entries
        .map((e) => (e as Record<string, string>).nodeName)
        .filter((n): n is string => !!n);
    }
    const edgesStr = (f.edges ?? '').toString();
    const edgeParts = edgesStr.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const edges = edgeParts
      .map((p) => {
        const idx = p.indexOf('→');
        if (idx < 0) return null;
        const from = p.slice(0, idx).trim();
        const to = p.slice(idx + 1).trim();
        return from && to ? { from, to } : null;
      })
      .filter((e): e is { from: string; to: string } => e != null);
    for (const e of entries) {
      const nodeEdges = ((e as Record<string, string>).edges ?? '').toString().split(/[;,]/);
      for (const p of nodeEdges) {
        const idx = p.indexOf('→');
        if (idx >= 0) {
          const from = p.slice(0, idx).trim();
          const to = p.slice(idx + 1).trim();
          if (from && to && !edges.some((x) => x.from === from && x.to === to)) {
            edges.push({ from, to });
          }
        }
      }
    }
    const entryNode = String(f.entryNode ?? nodes[0] ?? '');
    byFlow.set(fid, { nodes: [...new Set(nodes)], edges, entryNode });
  }
  return byFlow;
}

const FLOW_NODE_W = 48;
const FLOW_NODE_H = 24;
const FLOW_PAD_X = 6;
const FLOW_PAD_Y = 4;
const FLOW_MARGIN = 6;

function layoutFlowGraph(graph: FlowGraph): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const levels = new Map<string, number>();
  const entry = graph.entryNode || graph.nodes[0];
  if (!entry) return pos;
  levels.set(entry, 0);
  const queue = [entry];
  const visited = new Set<string>([entry]);
  while (queue.length > 0) {
    const u = queue.shift()!;
    const l = levels.get(u) ?? 0;
    for (const e of graph.edges) {
      if (e.from !== u) continue;
      if (!visited.has(e.to)) {
        visited.add(e.to);
        levels.set(e.to, l + 1);
        queue.push(e.to);
      } else {
        const existing = levels.get(e.to) ?? 0;
        if (l + 1 > existing) levels.set(e.to, l + 1);
      }
    }
  }
  const maxLevel = Math.max(0, ...Array.from(levels.values()));
  for (const n of graph.nodes) {
    if (!levels.has(n)) levels.set(n, maxLevel + 1);
  }
  const byLevel = new Map<number, string[]>();
  for (const [n, l] of levels) {
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(n);
  }
  const levelW = FLOW_NODE_W + FLOW_PAD_X;
  const levelH = FLOW_NODE_H + FLOW_PAD_Y;
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  for (let li = 0; li < sortedLevels.length; li++) {
    const level = sortedLevels[li];
    const nodesAtLevel = byLevel.get(level) ?? [];
    for (let ni = 0; ni < nodesAtLevel.length; ni++) {
      const n = nodesAtLevel[ni];
      const x = FLOW_MARGIN + li * levelW;
      const y = FLOW_MARGIN + ni * levelH;
      pos.set(n, { x, y });
    }
  }
  return pos;
}

function renderFlowDiagram(flows: Record<string, unknown>[]) {
  const el = document.getElementById('flow-diagram');
  const flowList = Array.isArray(flows) ? flows : [];
  if (!el || !flowList.length) {
    el?.classList.add('hidden');
    return;
  }
  const graphs = buildFlowGraphs(flowList);
  if (graphs.size === 0) {
    el?.classList.add('hidden');
    return;
  }
  const nodeW = FLOW_NODE_W;
  const nodeH = FLOW_NODE_H;
  let html = '';
  for (const [flowId, graph] of graphs) {
    const pos = layoutFlowGraph(graph);
    if (pos.size === 0) continue;
    const maxX = Math.max(...Array.from(pos.values()).map((p) => p.x)) + nodeW + FLOW_MARGIN * 2;
    const maxY = Math.max(...Array.from(pos.values()).map((p) => p.y)) + nodeH + FLOW_MARGIN * 2;
    const w = Math.max(240, maxX);
    const h = Math.max(48, maxY);
    let svg = `<svg class="flow-diagram-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
    for (const { from, to } of graph.edges) {
      const a = pos.get(from);
      const b = pos.get(to);
      if (a && b) {
        const x1 = a.x + nodeW;
        const y1 = a.y + nodeH / 2;
        const x2 = b.x;
        const y2 = b.y + nodeH / 2;
        const midX = (x1 + x2) / 2;
        svg += `<path d="M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}" fill="none" stroke="var(--flow-edge)" stroke-width="1" class="flow-edge"/>`;
        const arrowSize = 4;
        const ax = x2 - arrowSize * Math.cos(Math.PI / 6);
        const ay = y2 - arrowSize * Math.sin(Math.PI / 6);
        const bx = x2 - arrowSize * Math.cos(-Math.PI / 6);
        const by = y2 - arrowSize * Math.sin(-Math.PI / 6);
        svg += `<polygon points="${x2},${y2} ${ax},${ay} ${bx},${by}" fill="var(--flow-edge)" class="flow-arrow"/>`;
      }
    }
    for (const [name, p] of pos) {
      const isEntry = name === graph.entryNode;
      const cls = isEntry ? 'flow-diagram-node entry' : 'flow-diagram-node';
      const label = name.length > 10 ? name.slice(0, 8) + '…' : name;
      svg += `<g class="flow-node-group"><rect class="${cls}" x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="4"/><text x="${p.x + nodeW / 2}" y="${p.y + nodeH / 2 + 3}" text-anchor="middle" font-size="9" fill="var(--text-primary)" class="flow-node-label">${escapeHtml(label)}</text></g>`;
    }
    svg += '</svg>';
    html += `<div class="flow-diagram-card"><span class="flow-diagram-badge" title="${escapeHtml(flowId)}">${escapeHtml(flowId)}</span><div class="flow-diagram-svg-wrap">${svg}</div></div>`;
  }
  el.innerHTML = html;
  el.classList.remove('hidden');
}

function renderRagExplorer(rag: Record<string, unknown>[]) {
  const container = document.getElementById('rag-explorer');
  const select = document.getElementById('rag-pipeline-select') as HTMLSelectElement;
  const resultsEl = document.getElementById('rag-results');
  if (!container || !select || !resultsEl) return;
  const ragList = Array.isArray(rag) ? rag : [];
  if (!ragList.length) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  select.innerHTML = ragList.map((r) => `<option value="${escapeHtml(String((r as Record<string, string>).pipelineName ?? ''))}">${escapeHtml(String((r as Record<string, string>).pipelineName ?? ''))}</option>`).join('');
  resultsEl.innerHTML = '';
}

async function doRagSearch() {
  const select = document.getElementById('rag-pipeline-select') as HTMLSelectElement;
  const input = document.getElementById('rag-search-input') as HTMLInputElement;
  const resultsEl = document.getElementById('rag-results');
  if (!select || !input || !resultsEl) return;
  const pipeline = select.value;
  const q = input.value.trim();
  if (!q) return;
  resultsEl.innerHTML = '<p>Searching...</p>';
  try {
    const res = await fetch(`${BASE}/rag/${encodeURIComponent(pipeline)}/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) {
      resultsEl.innerHTML = `<p class="error">${escapeHtml(data.error ?? 'Search failed')}</p>`;
      return;
    }
    const results = data.results ?? [];
    if (!results.length) {
      resultsEl.innerHTML = '<p>No results found.</p>';
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r: { content?: string; score?: number; metadata?: unknown }) =>
          `<div class="rag-result-item"><span class="score">${r.score != null ? (r.score * 100).toFixed(1) + '%' : '—'}</span> ${escapeHtml(String(r.content ?? '').slice(0, 200))}${String(r.content ?? '').length > 200 ? '...' : ''}</div>`
      )
      .join('');
  } catch (e) {
    resultsEl.innerHTML = `<p class="error">${escapeHtml(String(e))}</p>`;
  }
}

function renderModuleGraph(modules: Record<string, unknown>[]) {
  const el = document.getElementById('module-graph-container');
  const moduleList = Array.isArray(modules) ? modules : [];
  if (!el || !moduleList.length) {
    el?.classList.add('hidden');
    return;
  }
  const nodes = new Map<string, { x: number; y: number }>();
  const edges: { from: string; to: string }[] = [];
  const moduleNames = moduleList.map((m) => String((m as Record<string, string>).moduleName ?? '')).filter(Boolean);
  const uniqueNames = [...new Set(moduleNames)];
  uniqueNames.forEach((name, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    nodes.set(name, { x: 80 + col * 120, y: 40 + row * 60 });
  });
  for (const m of moduleList) {
    const from = String((m as Record<string, string>).moduleName ?? '');
    const imports = (m as Record<string, unknown>).imports;
    const impList = Array.isArray(imports) ? imports : typeof imports === 'string' ? (imports as string).split(/[,;]/).map((s) => s.trim()) : [];
    for (const imp of impList) {
      const to = String(imp).trim();
      if (to && (uniqueNames.includes(to) || nodes.has(to))) {
        edges.push({ from, to });
        if (!nodes.has(to)) nodes.set(to, { x: 80 + (nodes.size % 4) * 120, y: 40 + Math.floor(nodes.size / 4) * 60 });
      }
    }
  }
  const w = 500;
  const h = Math.max(200, Math.ceil(uniqueNames.length / 4) * 70);
  let svg = `<svg class="module-graph-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  for (const { from, to } of edges) {
    const a = nodes.get(from);
    const b = nodes.get(to);
    if (a && b) {
      svg += `<line x1="${a.x + 50}" y1="${a.y + 15}" x2="${b.x + 50}" y2="${b.y + 15}" stroke="var(--border)" stroke-width="1"/>`;
    }
  }
  for (const [name, pos] of nodes) {
    svg += `<rect x="${pos.x}" y="${pos.y}" width="100" height="30" rx="4" fill="var(--bg-tertiary)" stroke="var(--border)"/>`;
    svg += `<text x="${pos.x + 50}" y="${pos.y + 20}" text-anchor="middle" font-size="11" fill="var(--text-primary)">${escapeHtml(name.length > 12 ? name.slice(0, 10) + '..' : name)}</text>`;
  }
  svg += '</svg>';
  el.innerHTML = svg;
  el.classList.remove('hidden');
}

function renderTable(
  id: string,
  entries: unknown[],
  columns: string[],
  key: string,
  formatters?: Record<string, (v: unknown, row: Record<string, unknown>) => string>,
  options?: { sortable?: boolean; tryRoute?: boolean; runAgent?: boolean; previewPrompt?: boolean }
) {
  const table = document.getElementById(id)!;
  const sortState = tableSortState[id] ?? { col: columns[0], dir: 'asc' as const };
  let sorted = [...(entries as Record<string, unknown>[])];
  if (options?.sortable && sorted.length > 0) {
    sorted.sort((a, b) => {
      const va = a[sortState.col];
      const vb = b[sortState.col];
      const cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
      return sortState.dir === 'asc' ? cmp : -cmp;
    });
  }
  const page = 0;
  const paginated = sorted.length > PAGE_SIZE ? sorted.slice(0, PAGE_SIZE) : sorted;
  const hasMore = sorted.length > PAGE_SIZE;

  if (!entries.length) {
    table.innerHTML = `<thead></thead><tbody><tr><td colspan="${columns.length + (options?.tryRoute || options?.runAgent ? 1 : 0)}" class="empty-state"><p>No entries found</p></td></tr></tbody>`;
    return;
  }
  const fmt = formatters ?? {};
  const ths = columns.map((c) => {
    const label = c.replace(/([A-Z])/g, ' $1').trim();
    const sortCls = options?.sortable ? ` sortable ${sortState.col === c ? sortState.dir : ''}` : '';
    return `<th class="${sortCls}" data-col="${c}">${label}</th>`;
  });
  if (options?.tryRoute) ths.push('<th>Actions</th>');
  if (options?.runAgent) ths.push('<th>Actions</th>');
  if (options?.previewPrompt) ths.push('<th>Actions</th>');

  table.innerHTML = `
    <thead><tr>${ths.join('')}</tr></thead>
    <tbody>
      ${paginated
        .map(
          (e) => {
            let actions = '';
            if (options?.tryRoute && e.fullPath != null) {
              const path = String(e.fullPath);
              const method = String((e as Record<string, string>).httpMethod ?? 'GET').toUpperCase();
              actions = `<td><button class="btn btn-sm try-route" data-method="${method}" data-path="${escapeHtml(path)}">Try</button></td>`;
            } else if (options?.runAgent && e.agentName != null) {
              actions = `<td><button class="btn btn-sm run-agent" data-name="${escapeHtml(String(e.agentName))}">Run</button></td>`;
            } else if (options?.previewPrompt && e.promptKey != null) {
              actions = `<td><button class="btn btn-sm preview-prompt" data-key="${escapeHtml(String(e.promptKey))}">Preview</button></td>`;
            } else if (options?.tryRoute || options?.runAgent || options?.previewPrompt) {
              actions = '<td></td>';
            }
            return `<tr data-id="${(e as Record<string, string>).id ?? ''}" data-json='${JSON.stringify(e).replace(/'/g, "\\'")}'>
              ${columns
                .map((col) => {
                  const raw = e[col];
                  const fn = fmt[col];
                  const val = fn ? fn(raw, e) : String(raw ?? '—');
                  return `<td>${val}</td>`;
                })
                .join('')}
              ${actions}
            </tr>`;
          }
        )
        .join('')}
    </tbody>
  `;
  if (hasMore) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${columns.length + (options?.tryRoute || options?.runAgent ? 1 : 0)}" class="empty-state"><p>Showing ${PAGE_SIZE} of ${sorted.length}. Use search to filter.</p></td>`;
    table.querySelector('tbody')!.appendChild(tr);
  }
  table.querySelectorAll('tbody tr[data-json]').forEach((tr) => {
    tr.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      const json = (tr as HTMLElement).dataset.json;
      if (json) showDetail(JSON.parse(json));
    });
  });
  table.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = (th as HTMLElement).dataset.col!;
      tableSortState[id] = { col, dir: sortState.col === col && sortState.dir === 'asc' ? 'desc' : 'asc' };
      renderTable(id, entries, columns, key, formatters, options);
    });
  });
  table.querySelectorAll('.try-route').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const method = (btn as HTMLElement).dataset.method ?? 'GET';
      const path = (btn as HTMLElement).dataset.path ?? '/';
      openRouteTestModal(method, path);
    });
  });
  table.querySelectorAll('.run-agent').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = (btn as HTMLElement).dataset.name ?? '';
      runAgent(name);
    });
  });
  table.querySelectorAll('.preview-prompt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = (btn as HTMLElement).dataset.key ?? '';
      previewPrompt(key);
    });
  });
}

function openRouteTestModal(method: string, path: string) {
  const modal = document.getElementById('route-test-modal')!;
  const urlInput = document.getElementById('test-url') as HTMLInputElement;
  const methodSelect = document.getElementById('test-method') as HTMLSelectElement;
  const bodyGroup = document.getElementById('test-body-group')!;
  const resultEl = document.getElementById('test-result')!;
  urlInput.value = `${APP_BASE}${path}`;
  methodSelect.value = method;
  bodyGroup.classList.toggle('hidden', method === 'GET');
  resultEl.classList.add('hidden');
  modal.classList.remove('hidden');
}

async function runAgent(name: string) {
  const input = prompt('Enter input for agent (or leave empty for empty string):') ?? '';
  try {
    const res = await fetch(`${BASE}/agents/${encodeURIComponent(name)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    if (!res.ok) {
      showDetail({ error: data.error ?? 'Agent run failed', status: res.status });
      return;
    }
    showDetail({ agentName: name, result: data.result });
  } catch (e) {
    showDetail({ error: String(e), agentName: name });
  }
}

function openPromptPlayground(key: string) {
  const modal = document.getElementById('prompt-playground-modal')!;
  const keyInput = document.getElementById('playground-key') as HTMLInputElement;
  const varsInput = document.getElementById('playground-vars') as HTMLTextAreaElement;
  const outputEl = document.getElementById('playground-output')!;
  const tokensEl = document.getElementById('playground-tokens')!;
  keyInput.value = key;
  varsInput.value = '{}';
  outputEl.textContent = '';
  tokensEl.textContent = '—';
  modal.classList.remove('hidden');
}

async function fetchPromptRender(key: string, variables: Record<string, unknown>): Promise<{ rendered: string; tokenEstimate: number }> {
  const res = await fetch(`${BASE}/prompts/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, variables }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Failed to render');
  }
  return res.json();
}

function previewPrompt(key: string) {
  openPromptPlayground(key);
}

let currentDetailEntry: unknown = null;

function showDetail(entry: unknown) {
  currentDetailEntry = entry;
  const panel = document.getElementById('detail-panel')!;
  const title = document.getElementById('detail-title')!;
  const content = document.getElementById('detail-content')!;
  title.textContent = String((entry as Record<string, unknown>).kind ?? 'Entry');
  content.innerHTML = syntaxHighlightJson(entry);
  panel.classList.remove('hidden');
}

function hideDetail() {
  currentDetailEntry = null;
  document.getElementById('detail-panel')!.classList.add('hidden');
}

function copyDetailToClipboard() {
  if (!currentDetailEntry) return;
  const str = JSON.stringify(currentDetailEntry, null, 2);
  navigator.clipboard.writeText(str).then(() => {
    const btn = document.getElementById('detail-copy');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn!.textContent = orig; }, 1500);
    }
  });
}

function filterEntries(entries: unknown[], q: string): unknown[] {
  const list = Array.isArray(entries) ? entries : [];
  if (!q.trim()) return list;
  const lower = q.toLowerCase();
  return list.filter((e) => JSON.stringify(e).toLowerCase().includes(lower));
}

const routeFormatters: Record<string, (v: unknown) => string> = {
  httpMethod: (v) => getMethodBadge(String(v ?? '')),
};

const jobFormatters: Record<string, (v: unknown, row: Record<string, unknown>) => string> = {
  enabled: (v) =>
    `<span class="badge ${v ? 'badge-get' : 'badge-default'}">${v ? 'Enabled' : 'Disabled'}</span>`,
  nextRuns: (v, row) => {
    const runs = Array.isArray(v) ? (v as string[]) : [];
    if (!runs.length) return '—';
    const fmt = (s: string) => {
      try {
        const d = new Date(s);
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch {
        return s;
      }
    };
    return runs.slice(0, 3).map(fmt).join(', ') + (runs.length > 3 ? '...' : '');
  },
};

const providerFormatters: Record<string, (v: unknown) => string> = {
  moduleName: (v) => String(v ?? '—'),
  scope: (v) => {
    const s = String(v ?? 'singleton');
    const cls = s === 'singleton' ? 'badge-get' : s === 'request' ? 'badge-post' : 'badge-default';
    return `<span class="badge ${cls}">${s}</span>`;
  },
};

const agentFormatters: Record<string, (v: unknown) => string> = {
  tools: (v) => (Array.isArray(v) ? v.join(', ') : String(v ?? '—')),
};

const aiFormatters: Record<string, (v: unknown) => string> = {
  streaming: (v) =>
    `<span class="badge ${v ? 'badge-get' : 'badge-default'}">${v ? 'Yes' : 'No'}</span>`,
};

function safeRender(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error(`[Inspector] ${name} failed:`, err);
  }
}

async function load(refresh = false) {
  if (fetchInFlight) return;
  fetchInFlight = true;
  setLoading(true);
  showOfflineBanner(false);
  try {
    const raw = await fetchSnapshot(refresh);
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    const summary = raw?.summary && typeof raw.summary === 'object' ? raw.summary : {};
    const overview = raw?.overview && typeof raw.overview === 'object' ? raw.overview : {};
    snapshot = { entries, summary, overview };
    safeRender('overview', () => renderOverview(summary));
    if (overview.gateway) safeRender('gatewayOverview', () => renderGatewayOverview(overview.gateway as Parameters<typeof renderGatewayOverview>[0]));
    if (overview.discovery) safeRender('discoveryOverview', () => renderDiscoveryOverview(overview.discovery as Parameters<typeof renderDiscoveryOverview>[0]));
    if (overview.resilience) safeRender('resilienceOverview', () => renderResilienceOverview(overview.resilience as Parameters<typeof renderResilienceOverview>[0]));
    ['overview-gateway', 'overview-discovery', 'overview-resilience'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !overview[id.replace('overview-', '')]) el.classList.add('hidden');
    });
    const [env, health, stats] = await Promise.all([
      fetchEnv(),
      Promise.all([fetchHealth('/health'), fetchHealth('/ready'), fetchHealth('/startup')]).then(([h, r, s]) => ({
        health: h,
        ready: r,
        startup: s,
      })),
      fetchStats(),
    ]);
    renderEnv(env);
    renderHealth(health);
    renderRuntime(stats);
    updateStatusBar(health, stats);
    updateQuickStats(summary);

    const routes = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'route');
  const modules = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'module');
  const providers = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'provider');
  const jobs = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'cron');
  const queues = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'queue');
  const ws = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'websocket');
  const agents = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'agent');
  const rag = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'rag');
  const prompts = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'prompt');
  const aifunctions = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'aifunction');
  const events = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'event');
  const graphql = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'graphql');
  const grpc = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'grpc');
  const kafka = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'kafka');
  const flows = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'flow');
  const data = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'data');
  const serverless = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'serverless');
  const ml = (snapshot.entries as Record<string, unknown>[]).filter((e) => e.kind === 'ml');

  renderTable(
    'routes-table',
    routes,
    ['httpMethod', 'fullPath', 'controllerPath', 'className'],
    'route',
    routeFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true, tryRoute: true }
  );
  safeRender('moduleGraph', () => renderModuleGraph(modules as Record<string, unknown>[]));
  renderTable(idToTable['modules'], modules, ['moduleName', 'dynamicModule', 'imports'], 'module', undefined, { sortable: true });
  renderTable(
    idToTable['providers'],
    providers,
    ['providerName', 'moduleName', 'scope'],
    'provider',
    providerFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true }
  );
  renderTable(
    idToTable['jobs'],
    jobs,
    ['jobName', 'cronExpression', 'enabled', 'nextRuns'],
    'cron',
    jobFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>
  );
  renderTable(idToTable['queues'], queues, ['queueName', 'consumerName', 'className'], 'queue');
  renderTable(idToTable['websocket'], ws, ['gatewayName', 'eventName', 'namespace'], 'websocket');
  renderTable(
    idToTable['agents'],
    agents,
    ['agentName', 'className', 'model', 'tools'],
    'agent',
    agentFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true, runAgent: true }
  );
  renderTable(
    idToTable['ai'],
    aifunctions,
    ['className', 'methodName', 'provider', 'model', 'streaming'],
    'aifunction',
    aiFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>
  );
  safeRender('ragExplorer', () => renderRagExplorer(rag as Record<string, unknown>[]));
  renderTable(idToTable['rag'], rag, ['pipelineName', 'vectorStore', 'embeddingProvider', 'chunkingStrategy'], 'rag', undefined, { sortable: true });
  renderTable(idToTable['prompts'], prompts, ['promptKey', 'scope'], 'prompt', undefined, { sortable: true, previewPrompt: true });
  renderTable(idToTable['events'], events, ['eventName', 'className', 'methodName'], 'event');
  renderTable(idToTable['graphql'], graphql, ['operationType', 'operationName', 'resolverName', 'className'], 'graphql');
  renderTable(idToTable['grpc'], grpc, ['serviceName', 'methodName', 'className'], 'grpc');
  renderTable(idToTable['kafka'], kafka, ['consumerName', 'topic', 'groupId', 'methodName'], 'kafka');
  const flowRuntimeInfo = document.getElementById('flow-runtime-info');
  if (flowRuntimeInfo) {
    flowRuntimeInfo.classList.toggle('hidden', flows.length === 0);
  }
  safeRender('flowDiagram', () => renderFlowDiagram(flows as Record<string, unknown>[]));
  renderTable(
    idToTable['flows'],
    flows,
    ['flowId', 'version', 'sourceType', 'nodeName', 'entryNode', 'edges', 'className'],
    'flow'
  );
  renderTable(idToTable['data'], data, ['pipelineName', 'className'], 'data');
  renderTable(idToTable['serverless'], serverless, ['controllerName', 'runtime', 'memory', 'timeout'], 'serverless');
  renderTable(idToTable['ml'], ml, ['modelName', 'version', 'className'], 'ml');
  } catch (err) {
    const errStr = String(err);
    const isFetchError =
      errStr.includes('Failed to fetch') || errStr.includes('NetworkError') || errStr.includes('Load failed');
    showOfflineBanner(isFetchError);
    updateStatusBar({ health: { ok: false }, ready: { ok: false }, startup: { ok: false } }, {});
    updateQuickStats({});
    const container = document.getElementById('summary-cards');
    if (container) {
      const msg = isFetchError ? 'Is the app running?' : 'A rendering error occurred. Check the console for details.';
      container.innerHTML = `<div class="overview-error"><p>Error: ${escapeHtml(String(err))}</p><p>${escapeHtml(msg)} <button class="btn btn-sm btn-primary" id="retry-load">Retry</button></p></div>`;
      document.getElementById('retry-load')?.addEventListener('click', () => load(true));
    }
  } finally {
    fetchInFlight = false;
    setLoading(false);
  }
}

const idToTable: Record<string, string> = {
  routes: 'routes-table',
  modules: 'modules-table',
  providers: 'providers-table',
  jobs: 'jobs-table',
  queues: 'queues-table',
  websocket: 'websocket-table',
  agents: 'agents-table',
  ai: 'ai-table',
  rag: 'rag-table',
  prompts: 'prompts-table',
  events: 'events-table',
  graphql: 'graphql-table',
  grpc: 'grpc-table',
  kafka: 'kafka-table',
  flows: 'flows-table',
  data: 'data-table',
  serverless: 'serverless-table',
  ml: 'ml-table',
};

const KIND_TO_TAB: Record<string, string> = {
  route: 'routes',
  module: 'modules',
  provider: 'providers',
  cron: 'jobs',
  queue: 'queues',
  websocket: 'websocket',
  agent: 'agents',
  aifunction: 'ai',
  rag: 'rag',
  prompt: 'prompts',
  event: 'events',
  graphql: 'graphql',
  grpc: 'grpc',
  kafka: 'kafka',
  flow: 'flows',
  data: 'data',
  serverless: 'serverless',
  ml: 'ml',
};

function navigateToTab(tab: string) {
  const navLink = document.querySelector(`.sidebar nav a[data-tab="${tab}"]`);
  if (navLink) {
    document.querySelectorAll('.sidebar nav a').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((x) => x.classList.remove('active'));
    navLink.classList.add('active');
    document.getElementById(tab)?.classList.add('active');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  }
}

document.querySelectorAll('.sidebar nav a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = (a as HTMLElement).dataset.tab!;
    navigateToTab(tab);
  });
});

document.getElementById('summary-cards')?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.card[data-kind]');
  if (card) {
    const kind = (card as HTMLElement).dataset.kind;
    const tab = kind ? KIND_TO_TAB[kind] : null;
    if (tab) navigateToTab(tab);
  }
});

function doRefresh() {
  load(true);
}
document.getElementById('refresh')?.addEventListener('click', doRefresh);
document.getElementById('refresh-sidebar')?.addEventListener('click', doRefresh);
document.getElementById('detail-close')!.addEventListener('click', hideDetail);
document.getElementById('detail-copy')?.addEventListener('click', copyDetailToClipboard);

document.getElementById('export-btn')?.addEventListener('click', () => {
  if (!snapshot) return;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inspector-snapshot-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

const autoRefreshEl = document.getElementById('auto-refresh') as HTMLInputElement | null;
let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;
autoRefreshEl?.addEventListener('change', () => {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = null;
  if (autoRefreshEl?.checked) {
    autoRefreshInterval = setInterval(() => load(false), 15000);
  }
});

document.getElementById('test-route-btn')?.addEventListener('click', async () => {
  const url = (document.getElementById('test-url') as HTMLInputElement).value;
  const method = (document.getElementById('test-method') as HTMLSelectElement).value;
  const bodyEl = document.getElementById('test-body') as HTMLTextAreaElement;
  const resultEl = document.getElementById('test-result')!;
  resultEl.classList.remove('hidden');
  resultEl.className = 'test-result';
  resultEl.textContent = 'Sending...';
  try {
    const opts: RequestInit = { method };
    if (method !== 'GET' && bodyEl?.value) {
      try {
        JSON.parse(bodyEl.value);
        opts.body = bodyEl.value;
        opts.headers = { 'Content-Type': 'application/json' };
      } catch {
        resultEl.className = 'test-result error';
        resultEl.textContent = 'Invalid JSON body';
        return;
      }
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    resultEl.className = `test-result ${res.ok ? 'success' : 'error'}`;
    resultEl.textContent = `Status: ${res.status}\n\n${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`;
  } catch (e) {
    resultEl.className = 'test-result error';
    resultEl.textContent = String(e);
  }
});

document.getElementById('test-route-cancel')?.addEventListener('click', () => {
  document.getElementById('route-test-modal')!.classList.add('hidden');
});

document.getElementById('test-method')?.addEventListener('change', (e) => {
  const method = (e.target as HTMLSelectElement).value;
  document.getElementById('test-body-group')!.classList.toggle('hidden', method === 'GET');
});

document.getElementById('playground-render')?.addEventListener('click', async () => {
  const key = (document.getElementById('playground-key') as HTMLInputElement).value;
  const varsInput = (document.getElementById('playground-vars') as HTMLTextAreaElement).value;
  const outputEl = document.getElementById('playground-output')!;
  const tokensEl = document.getElementById('playground-tokens')!;
  let variables: Record<string, unknown> = {};
  try {
    variables = varsInput.trim() ? JSON.parse(varsInput) : {};
  } catch {
    outputEl.textContent = 'Invalid JSON in variables';
    tokensEl.textContent = '—';
    return;
  }
  try {
    const { rendered, tokenEstimate } = await fetchPromptRender(key, variables);
    outputEl.textContent = rendered;
    tokensEl.textContent = String(tokenEstimate);
  } catch (e) {
    outputEl.textContent = String(e);
    tokensEl.textContent = '—';
  }
});

document.getElementById('playground-close')?.addEventListener('click', () => {
  document.getElementById('prompt-playground-modal')!.classList.add('hidden');
});

document.getElementById('diff-btn')?.addEventListener('click', () => {
  document.getElementById('diff-modal')!.classList.remove('hidden');
});

document.getElementById('diff-close')?.addEventListener('click', () => {
  document.getElementById('diff-modal')!.classList.add('hidden');
});

document.getElementById('diff-load-file')?.addEventListener('click', () => {
  document.getElementById('diff-file')!.click();
});

document.getElementById('diff-file')?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    (document.getElementById('diff-snapshot-b') as HTMLTextAreaElement).value = String(reader.result);
  };
  reader.readAsText(file);
});

document.getElementById('rag-search-btn')?.addEventListener('click', doRagSearch);

document.getElementById('diff-compare-btn')?.addEventListener('click', () => {
  const bRaw = (document.getElementById('diff-snapshot-b') as HTMLTextAreaElement).value.trim();
  const resultEl = document.getElementById('diff-result')!;
  if (!snapshot) {
    resultEl.innerHTML = '<p class="error">No current snapshot. Refresh first.</p>';
    resultEl.classList.remove('hidden');
    return;
  }
  let snapshotB: { entries?: unknown[]; summary?: Record<string, number> };
  try {
    snapshotB = bRaw ? JSON.parse(bRaw) : { entries: [], summary: {} };
  } catch {
    resultEl.innerHTML = '<p class="error">Invalid JSON in Snapshot B.</p>';
    resultEl.classList.remove('hidden');
    return;
  }
  const a = (snapshot.entries ?? []) as Record<string, unknown>[];
  const b = (snapshotB.entries ?? []) as Record<string, unknown>[];
  const aIds = new Set(a.map((e) => e.id));
  const bIds = new Set(b.map((e) => e.id));
  const added = b.filter((e) => !aIds.has(e.id as string));
  const removed = a.filter((e) => !bIds.has(e.id as string));
  const changed = a.filter((ea) => {
    const eb = b.find((x) => x.id === ea.id);
    return eb && JSON.stringify(ea) !== JSON.stringify(eb);
  });
  let html = '';
  if (added.length) html += `<p class="added">+ ${added.length} added</p><ul>${added.map((e) => `<li>${escapeHtml(String(e.kind))}: ${escapeHtml(String(e.id ?? ''))}</li>`).join('')}</ul>`;
  if (removed.length) html += `<p class="removed">− ${removed.length} removed</p><ul>${removed.map((e) => `<li>${escapeHtml(String(e.kind))}: ${escapeHtml(String(e.id ?? ''))}</li>`).join('')}</ul>`;
  if (changed.length) html += `<p class="changed">~ ${changed.length} changed</p><ul>${changed.map((e) => `<li>${escapeHtml(String(e.kind))}: ${escapeHtml(String(e.id ?? ''))}</li>`).join('')}</ul>`;
  if (!html) html = '<p>No differences.</p>';
  resultEl.innerHTML = html;
  resultEl.classList.remove('hidden');
});

document.getElementById('search')!.addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value;
  if (!snapshot) return;
  const filtered = filterEntries(snapshot.entries, q);
  const rawSummary = snapshot.summary && typeof snapshot.summary === 'object' ? snapshot.summary : {};
  const summary = Object.fromEntries(
    Object.entries(rawSummary).map(([k]) => [
      k,
      filtered.filter((x) => (x as Record<string, unknown>).kind === k).length,
    ])
  );
  renderOverview(summary);
  const routes = filtered.filter((x) => (x as Record<string, unknown>).kind === 'route');
  const modules = filtered.filter((x) => (x as Record<string, unknown>).kind === 'module');
  const providers = filtered.filter((x) => (x as Record<string, unknown>).kind === 'provider');
  const jobs = filtered.filter((x) => (x as Record<string, unknown>).kind === 'cron');
  const queues = filtered.filter((x) => (x as Record<string, unknown>).kind === 'queue');
  const ws = filtered.filter((x) => (x as Record<string, unknown>).kind === 'websocket');
  const agents = filtered.filter((x) => (x as Record<string, unknown>).kind === 'agent');
  const rag = filtered.filter((x) => (x as Record<string, unknown>).kind === 'rag');
  const prompts = filtered.filter((x) => (x as Record<string, unknown>).kind === 'prompt');
  const aifunctions = filtered.filter((x) => (x as Record<string, unknown>).kind === 'aifunction');
  const events = filtered.filter((x) => (x as Record<string, unknown>).kind === 'event');
  const graphql = filtered.filter((x) => (x as Record<string, unknown>).kind === 'graphql');
  const grpc = filtered.filter((x) => (x as Record<string, unknown>).kind === 'grpc');
  const kafka = filtered.filter((x) => (x as Record<string, unknown>).kind === 'kafka');
  const flows = filtered.filter((x) => (x as Record<string, unknown>).kind === 'flow');
  const data = filtered.filter((x) => (x as Record<string, unknown>).kind === 'data');
  const serverless = filtered.filter((x) => (x as Record<string, unknown>).kind === 'serverless');
  const ml = filtered.filter((x) => (x as Record<string, unknown>).kind === 'ml');
  renderTable(
    'routes-table',
    routes,
    ['httpMethod', 'fullPath', 'controllerPath', 'className'],
    'route',
    routeFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true, tryRoute: true }
  );
  renderModuleGraph(modules as Record<string, unknown>[]);
  renderTable('modules-table', modules, ['moduleName', 'dynamicModule', 'imports'], 'module', undefined, { sortable: true });
  renderTable(
    'providers-table',
    providers,
    ['providerName', 'moduleName', 'scope'],
    'provider',
    providerFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true }
  );
  renderTable(
    'jobs-table',
    jobs,
    ['jobName', 'cronExpression', 'enabled', 'nextRuns'],
    'cron',
    jobFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>
  );
  renderTable('queues-table', queues, ['queueName', 'consumerName', 'className'], 'queue');
  renderTable('websocket-table', ws, ['gatewayName', 'eventName', 'namespace'], 'websocket');
  renderTable(
    'agents-table',
    agents,
    ['agentName', 'className', 'model', 'tools'],
    'agent',
    agentFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>,
    { sortable: true, runAgent: true }
  );
  renderTable(
    'ai-table',
    aifunctions,
    ['className', 'methodName', 'provider', 'model', 'streaming'],
    'aifunction',
    aiFormatters as Record<string, (v: unknown, r: Record<string, unknown>) => string>
  );
  renderRagExplorer(rag as Record<string, unknown>[]);
  renderTable('rag-table', rag, ['pipelineName', 'vectorStore', 'embeddingProvider', 'chunkingStrategy'], 'rag', undefined, { sortable: true });
  renderTable('prompts-table', prompts, ['promptKey', 'scope'], 'prompt', undefined, { sortable: true, previewPrompt: true });
  renderTable('events-table', events, ['eventName', 'className', 'methodName'], 'event');
  renderTable('graphql-table', graphql, ['operationType', 'operationName', 'resolverName', 'className'], 'graphql');
  renderTable('grpc-table', grpc, ['serviceName', 'methodName', 'className'], 'grpc');
  renderTable('kafka-table', kafka, ['consumerName', 'topic', 'groupId', 'methodName'], 'kafka');
  const flowRuntimeInfoEl = document.getElementById('flow-runtime-info');
  if (flowRuntimeInfoEl) {
    flowRuntimeInfoEl.classList.toggle('hidden', flows.length === 0);
  }
  renderFlowDiagram(flows as Record<string, unknown>[]);
  renderTable(
    'flows-table',
    flows,
    ['flowId', 'version', 'sourceType', 'nodeName', 'entryNode', 'edges', 'className'],
    'flow',
    undefined,
    { sortable: true }
  );
  renderTable('data-table', data, ['pipelineName', 'className'], 'data');
  renderTable('serverless-table', serverless, ['controllerName', 'runtime', 'memory', 'timeout'], 'serverless');
  renderTable('ml-table', ml, ['modelName', 'version', 'className'], 'ml');
});

load().then(() => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab) navigateToTab(tab);
});
