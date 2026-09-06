/**
 * Agent OS project templates for `hazel agent new`.
 *
 * DNA ≈ OpenAPI for agents (contract). App code = real tool implementations.
 * `hazel agent run` on DNA alone uses stubs — production needs the app tools.
 */

import * as fs from 'fs';
import * as path from 'path';

export type AgentTemplateId = 'bare' | 'agent-os' | 'skillgate';

export interface AgentTemplateMeta {
  id: AgentTemplateId;
  label: string;
  description: string;
}

export const AGENT_TEMPLATES: AgentTemplateMeta[] = [
  {
    id: 'bare',
    label: 'Bare DNA package',
    description: 'Marketplace DNA only — publish/install/run with stub tools (packaging smoke)',
  },
  {
    id: 'agent-os',
    label: 'Agent OS mini-app',
    description:
      'DNA + real @Agent/@Tool app + ops stack (self-healing + predictive scaling) + K8s manifests',
  },
  {
    id: 'skillgate',
    label: 'Skillgate concierge',
    description: 'DNA + Skillgate fromOpenApi sample + register sketch for API concierge',
  },
];

export function listAgentTemplates(): AgentTemplateMeta[] {
  return [...AGENT_TEMPLATES];
}

export function resolveAgentTemplate(id: string): AgentTemplateId {
  const found = AGENT_TEMPLATES.find((t) => t.id === id);
  if (!found) {
    throw new Error(
      `Unknown agent template "${id}". Available: ${AGENT_TEMPLATES.map((t) => t.id).join(', ')}`
    );
  }
  return found.id;
}

function writeFile(root: string, rel: string, content: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.endsWith('\n') ? content : content + '\n');
}

function sanitizeNpmName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-agent'
  );
}

function agentDnaName(projectName: string): string {
  return sanitizeNpmName(projectName).replace(/-/g, '_').slice(0, 48) || 'my_agent';
}

function marketplacePackage(
  projectName: string,
  opts: {
    description: string;
    systemPrompt: string;
    tools: Array<{ name: string; description: string; requiresApproval?: boolean }>;
    policies?: unknown[];
    keywords: string[];
  }
): string {
  const dnaName = agentDnaName(projectName);
  const pkg = {
    name: `@local/${sanitizeNpmName(projectName)}-agent`,
    version: '1.0.0',
    description: opts.description,
    dna: {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: dnaName,
      description: opts.description,
      systemPrompt: opts.systemPrompt,
      tools: opts.tools,
      policies: opts.policies ?? [],
      contracts: [{ name: `${dnaName}-slo`, maxLatencyMs: 30_000 }],
      exportedAt: new Date().toISOString(),
    },
    readme: opts.description,
    keywords: opts.keywords,
  };
  return JSON.stringify(pkg, null, 2);
}

function bareFiles(projectName: string): Record<string, string> {
  const pkgJson = marketplacePackage(projectName, {
    description: `${projectName} — DNA-only agent package`,
    systemPrompt: `You are ${projectName}. Be concise. Use tools when available; otherwise explain what you would do.`,
    tools: [
      { name: 'ping', description: 'Health ping (stub in CLI run)' },
      { name: 'echo', description: 'Echo input (stub in CLI run)' },
    ],
    keywords: ['agent-os', 'dna', 'bare'],
  });

  return {
    'package.json': JSON.stringify(
      {
        name: sanitizeNpmName(projectName),
        version: '1.0.0',
        private: true,
        description: `DNA package for ${projectName}`,
        scripts: {
          'agent:run': 'hazel agent run dna/agent.marketplace.json',
          'store:publish': 'hazel store publish dna/agent.marketplace.json',
          'store:install': 'hazel store install dna/agent.marketplace.json',
        },
        keywords: ['hazeljs', 'agent-os', 'dna'],
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'dna/agent.marketplace.json': pkgJson,
    'README.md': `# ${projectName}

Bare **Agent DNA** package (contract only — like OpenAPI for an agent).

## Commands

\`\`\`bash
# Smoke-run (Agent OS engine + stub tools + mock/real LLM)
npx hazel agent run dna/agent.marketplace.json "hello"

# Publish to local registry, then install into a project
npx hazel store publish dna/agent.marketplace.json
npx hazel store install @local/${sanitizeNpmName(projectName)}-agent --cwd /path/to/app
\`\`\`

## Important

\`hazel agent run\` executes the **runtime** with **stub** tool handlers.
Wire real \`@Tool\` / Skillgate handlers in your Hazel app for production behavior.
`,
  };
}

function agentOsOpsFiles(npm: string, _projectName: string): Record<string, string> {
  const deployment = npm;
  const hpaName = `${npm}-hpa`;

  return {
    '.env.example': `# Agent runtime
HITL=0

# Ops stack (proactive scaling + reactive self-healing)
ENABLE_OPS_STACK=0
K8S_DEPLOYMENT=${deployment}
K8S_NAMESPACE=default
K8S_HPA_NAME=${hpaName}
PROMETHEUS_URL=http://prometheus.monitoring.svc:9090
SLACK_BOT_TOKEN=
PAGERDUTY_ROUTING_KEY=
`,
    'src/ops/stack.ts': `import { createOperationsStack } from '@hazeljs/predictive-scaling';
import {
  FetchKubernetesRestartClient,
  FetchKubernetesScalingClient,
  createSlackHealingNotifier,
  createHealingNotifierChain,
  InMemoryKubernetesRestartClient,
  InMemoryKubernetesScalingClient,
} from '@hazeljs/self-healing';

export function createAgentOpsStack(appName: string) {
  const deployment = process.env.K8S_DEPLOYMENT ?? appName;
  const namespace = process.env.K8S_NAMESPACE ?? 'default';
  const hpaName = process.env.K8S_HPA_NAME ?? \`\${deployment}-hpa\`;
  const inCluster = Boolean(process.env.KUBERNETES_SERVICE_HOST);

  const scalingClient = inCluster
    ? new FetchKubernetesScalingClient()
    : new InMemoryKubernetesScalingClient();
  const restartClient = inCluster
    ? new FetchKubernetesRestartClient()
    : new InMemoryKubernetesRestartClient();

  const notifications = [];
  if (process.env.SLACK_BOT_TOKEN) {
    notifications.push(
      createSlackHealingNotifier({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.SLACK_ALERT_CHANNEL ?? '#ops-alerts',
      })
    );
  }

  return createOperationsStack({
    healing: {
      strategies: ['config-rollback', 'hpa-boost', 'pod-restart', 'safe-mode'],
      aiDiagnostics: true,
      drain: { timeoutMs: 30_000 },
      notifyOn: ['critical-healing', 'healing-failed', 'hpa-boost', 'pod-restart'],
      notifications: notifications.length ? createHealingNotifierChain(notifications) : undefined,
      kubernetes: {
        deployment,
        namespace,
        client: restartClient,
        drainBeforeRestart: true,
        hpa: {
          name: hpaName,
          namespace,
          client: scalingClient,
          boostMinReplicas: Number(process.env.HPA_BOOST_MIN ?? 4),
          restoreAfterMs: Number(process.env.HPA_RESTORE_MS ?? 300_000),
        },
      },
      performance: {
        enabled: true,
        autoScaleOnDegradation: true,
        thresholds: { criticalLatencyMs: 2000, sampleSize: 20 },
      },
    },
    scaling: {
      model: 'time-series-forecast',
      metrics: ['requests', 'latency', 'cpu'],
      horizon: '30m',
      confidence: 0.85,
      capacityPerReplica: Number(process.env.CAPACITY_PER_REPLICA ?? 120),
      hpa: {
        name: hpaName,
        namespace,
        client: scalingClient,
        maxReplicas: Number(process.env.HPA_MAX_REPLICAS ?? 50),
      },
    },
    prometheus: process.env.PROMETHEUS_URL
      ? {
          baseUrl: process.env.PROMETHEUS_URL,
          pollIntervalMs: 60_000,
          queries: {
            requests: \`sum(rate(http_requests_total{service="${deployment}"}[5m]))\`,
            latency:
              \`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="${deployment}"}[5m])) by (le))\`,
            cpu: \`avg(rate(container_cpu_usage_seconds_total{pod=~"${deployment}-.*"}[5m]))\`,
          },
        }
      : undefined,
  });
}

let opsStack: ReturnType<typeof createAgentOpsStack> | null = null;

export function startAgentOpsStack(appName: string) {
  if (opsStack) return opsStack;
  opsStack = createAgentOpsStack(appName);
  opsStack.start();
  return opsStack;
}

export function stopAgentOpsStack() {
  opsStack?.stop();
  opsStack = null;
}
`,
    'deploy/kubernetes/deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployment}
  labels:
    app: ${deployment}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${deployment}
  template:
    metadata:
      labels:
        app: ${deployment}
    spec:
      serviceAccountName: ${deployment}
      containers:
        - name: agent
          image: ${deployment}:latest
          env:
            - name: ENABLE_OPS_STACK
              value: "1"
            - name: K8S_DEPLOYMENT
              value: ${deployment}
            - name: K8S_HPA_NAME
              value: ${hpaName}
            - name: PROMETHEUS_URL
              value: http://prometheus.monitoring.svc:9090
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
`,
    'deploy/kubernetes/hpa.yaml': `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${hpaName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${deployment}
  minReplicas: 2
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
`,
    'deploy/kubernetes/service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: ${deployment}
spec:
  selector:
    app: ${deployment}
  ports:
    - port: 80
      targetPort: 3000
`,
    'deploy/kubernetes/serviceaccount.yaml': `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${deployment}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${deployment}-ops
rules:
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${deployment}-ops
subjects:
  - kind: ServiceAccount
    name: ${deployment}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ${deployment}-ops
`,
    'deploy/kubernetes/kustomization.yaml': `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - serviceaccount.yaml
  - deployment.yaml
  - service.yaml
  - hpa.yaml
`,
  };
}

function agentOsFiles(projectName: string): Record<string, string> {
  const dnaName = agentDnaName(projectName);
  const npm = sanitizeNpmName(projectName);
  const marketplace = marketplacePackage(projectName, {
    description: `${projectName} — Agent OS support-style agent with real tools`,
    systemPrompt: `You are ${projectName}, a support desk agent.
Use lookupOrder for facts. Call processRefund only after lookup. Be concise.`,
    tools: [
      { name: 'lookupOrder', description: 'Look up an order by id' },
      {
        name: 'processRefund',
        description: 'Process a refund (requires approval)',
        requiresApproval: true,
      },
    ],
    policies: [
      {
        id: 'refund-needs-approval',
        tool: 'processRefund',
        effect: 'require_approval',
        priority: 20,
      },
    ],
    keywords: ['agent-os', 'hitl', 'support'],
  });

  return {
    'package.json': JSON.stringify(
      {
        name: npm,
        version: '1.0.0',
        private: true,
        description: `Agent OS mini-app: ${projectName}`,
        scripts: {
          build: 'tsc',
          start: 'node dist/main.js',
          dev: 'ts-node --transpile-only src/main.ts',
          'agent:run': 'hazel agent run dna/agent.marketplace.json',
          'store:publish': 'hazel store publish dna/agent.marketplace.json',
          'store:install': 'hazel store install dna/agent.marketplace.json --cwd .',
        },
        dependencies: {
          '@hazeljs/agent': '^1.0.6',
          '@hazeljs/self-healing': '^2.0.5',
          '@hazeljs/predictive-scaling': '^2.0.5',
        },
        devDependencies: {
          '@types/node': '^20.19.39',
          'ts-node': '^10.9.2',
          typescript: '^5.9.3',
        },
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          outDir: 'dist',
          rootDir: 'src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
        include: ['src/**/*'],
      },
      null,
      2
    ),
    'dna/agent.marketplace.json': marketplace,
    'src/orders.ts': `export type Order = { id: string; status: string; totalUsd: number };

const ORDERS: Record<string, Order> = {
  'ORD-1001': { id: 'ORD-1001', status: 'shipped', totalUsd: 128 },
  'ORD-1002': { id: 'ORD-1002', status: 'delivered', totalUsd: 64 },
};

export function getOrder(id: string): Order | undefined {
  return ORDERS[id.toUpperCase()];
}
`,
    'src/support.agent.ts': `import { Agent, Tool } from '@hazeljs/agent';
import { getOrder } from './orders';

@Agent({
  name: '${dnaName}',
  description: '${projectName} support agent',
  systemPrompt: \`You are ${projectName}. Use lookupOrder for facts. Use processRefund only after lookup.\`,
  maxSteps: 8,
})
export class SupportAgent {
  @Tool({
    name: 'lookupOrder',
    description: 'Look up an order by id (e.g. ORD-1001)',
    parameters: [{ name: 'orderId', type: 'string', required: true }],
  })
  async lookupOrder({ orderId }: { orderId: string }) {
    const order = getOrder(orderId);
    if (!order) return { found: false, error: \`No order \${orderId}\` };
    return { found: true, order };
  }

  @Tool({
    name: 'processRefund',
    description: 'Process a refund — requires human approval',
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', required: true },
      { name: 'amount', type: 'number', required: true },
    ],
  })
  async processRefund({ orderId, amount }: { orderId: string; amount: number }) {
    const order = getOrder(orderId);
    if (!order) return { ok: false, error: \`No order \${orderId}\` };
    return { ok: true, orderId: order.id, amount, status: 'refunded' };
  }
}
`,
    'src/main.ts': `/**
 * Mini Agent OS app — real tools (not DNA stubs).
 * DNA in dna/ can be hot-reloaded / store-installed for prompt+policy overlays.
 */
import {
  AgentRuntime,
  AgentEventType,
  createMockLlmProvider,
  type AgentEvent,
} from '@hazeljs/agent';
import { SupportAgent } from './support.agent';
import { startAgentOpsStack, stopAgentOpsStack } from './ops/stack';

async function main() {
  const input = process.argv.slice(2).join(' ') || 'Where is ORD-1001?';

  if (process.env.ENABLE_OPS_STACK === '1') {
    startAgentOpsStack('${npm}');
    process.on('SIGINT', () => stopAgentOpsStack());
    process.on('SIGTERM', () => stopAgentOpsStack());
  }
  // Demo uses mock LLM. Wire OpenAI (or another provider) in production apps.
  const llm = createMockLlmProvider(
    'Used real @Tool handlers on AgentRuntime. (Replace createMockLlmProvider with your LLM.)'
  );

  const runtime = new AgentRuntime({
    llmProvider: llm,
    enableRetry: false,
    enableCircuitBreaker: false,
  });

  runtime.registerAgent(SupportAgent);
  runtime.registerAgentInstance('${dnaName}', new SupportAgent());

  // Auto-approve refunds unless HITL=1
  if (process.env.HITL !== '1') {
    runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, (event) => {
      const data = (event as AgentEvent<{ requestId?: string }>).data;
      if (data?.requestId) runtime.approveToolExecution(data.requestId, 'demo');
    });
  }

  // DNA file is for store publish/install + CLI smoke.
  // Do not installAgentPackage here if it would re-register tools without handlers.
  // Use DNA overlay for prompt/policies in production only when tools are wired.

  const result = await runtime.execute('${dnaName}', input, { maxSteps: 8 });
  console.log(JSON.stringify({ response: result.response, state: result.state, steps: result.steps.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`,
    'README.md': `# ${projectName}

**Agent OS mini-app** — DNA contract + **real** \`@Tool\` implementations.

| Path | Role |
| --- | --- |
| \`dna/agent.marketplace.json\` | DNA / marketplace package (OpenAPI-for-agents) |
| \`src/support.agent.ts\` | Real tool handlers |
| \`src/main.ts\` | AgentRuntime bootstrap + optional DNA overlay |
| \`src/ops/stack.ts\` | Predictive scaling + self-healing ops stack |
| \`deploy/kubernetes/\` | K8s Deployment, HPA, RBAC for in-cluster ops |

## Quick start

\`\`\`bash
npm install
npm run dev
npm run dev -- I want a refund for ORD-1002

# DNA smoke (stubs — not the same as npm run dev)
npx hazel agent run dna/agent.marketplace.json "hello"

# Package+Store
npm run store:publish
npm run store:install
\`\`\`

Set \`HITL=1\` to pause on \`processRefund\` approvals.

## Production ops (predictive + self-healing)

\`\`\`bash
cp .env.example .env
ENABLE_OPS_STACK=1 npm run dev

# Deploy to Kubernetes (requires kubectl + kustomize)
kubectl apply -k deploy/kubernetes
\`\`\`

- **Proactive:** \`@hazeljs/predictive-scaling\` forecasts traffic and adjusts HPA min replicas
- **Reactive:** \`@hazeljs/self-healing\` heals failures, drains pods, opens Slack/Jira alerts
`,
    ...agentOsOpsFiles(npm, projectName),
  };
}

function skillgateFiles(projectName: string): Record<string, string> {
  const npm = sanitizeNpmName(projectName);
  const marketplace = marketplacePackage(projectName, {
    description: `${projectName} — API concierge (Skillgate-governed REST skills)`,
    systemPrompt: `You are an API concierge. Prefer read skills first. Writes need approval.`,
    tools: [
      { name: 'getOrder', description: 'GET order by id (Skillgate read)' },
      {
        name: 'createRefund',
        description: 'POST refund (Skillgate write + approval)',
        requiresApproval: true,
      },
    ],
    keywords: ['skillgate', 'agent-os', 'openapi'],
  });

  return {
    'package.json': JSON.stringify(
      {
        name: npm,
        version: '1.0.0',
        private: true,
        description: `Skillgate agent starter: ${projectName}`,
        scripts: {
          build: 'tsc',
          report: 'ts-node --transpile-only src/report.ts',
          'agent:run': 'hazel agent run dna/agent.marketplace.json',
          'store:publish': 'hazel store publish dna/agent.marketplace.json',
        },
        dependencies: {
          '@hazeljs/agent': '^1.0.6',
          '@hazeljs/skillgate': '^1.0.6',
        },
        devDependencies: {
          '@types/node': '^20.19.39',
          'ts-node': '^10.9.2',
          typescript: '^5.9.3',
        },
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          outDir: 'dist',
          rootDir: 'src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['src/**/*'],
      },
      null,
      2
    ),
    'dna/agent.marketplace.json': marketplace,
    'openapi/sample.openapi.json': JSON.stringify(
      {
        openapi: '3.0.3',
        info: { title: `${projectName} API`, version: '1.0.0' },
        servers: [{ url: 'http://127.0.0.1:3000' }],
        paths: {
          '/orders/{id}': {
            get: {
              operationId: 'getOrder',
              tags: ['agent'],
              summary: 'Fetch an order by id',
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              'x-hazel-skill': { readOnly: true, class: 'read' },
            },
          },
          '/refunds': {
            post: {
              operationId: 'createRefund',
              tags: ['agent'],
              summary: 'Create a refund',
              'x-hazel-skill': { requiresApproval: true, class: 'write' },
            },
          },
        },
      },
      null,
      2
    ),
    'src/report.ts': `import * as fs from 'fs';
import * as path from 'path';
import { Skillgate, type OpenApiLike } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';

const specPath = path.join(__dirname, '..', 'openapi', 'sample.openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as OpenApiLike;

const gate = Skillgate.fromOpenApi(spec, {
  include: { tags: ['agent'] },
  classify: { writeRequiresApproval: true },
  invoke: { baseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:3000' },
});

const registry = new ToolRegistry();
gate.register(registry, 'api-concierge');

console.log(JSON.stringify(gate.report(), null, 2));
console.log('Registered tools:', registry.getAgentTools('api-concierge').map((t) => t.name));
`,
    'README.md': `# ${projectName}

**Skillgate** starter — OpenAPI → governed agent skills + DNA package.

\`\`\`bash
npm install
npm run report          # Skillgate included/denied report
npx hazel agent run dna/agent.marketplace.json
npx hazel store publish dna/agent.marketplace.json
\`\`\`

See also: full showcase \`hazeljs-skillgate-agent-starter\` in the monorepo.
`,
  };
}

export interface ScaffoldAgentProjectOptions {
  name: string;
  destDir: string;
  template: AgentTemplateId;
  force?: boolean;
}

export interface ScaffoldAgentProjectResult {
  path: string;
  template: AgentTemplateId;
  files: string[];
}

export function scaffoldAgentProject(
  options: ScaffoldAgentProjectOptions
): ScaffoldAgentProjectResult {
  const template = resolveAgentTemplate(options.template);
  const root = path.resolve(options.destDir);

  if (fs.existsSync(root) && fs.readdirSync(root).length > 0 && !options.force) {
    throw new Error(`Destination not empty: ${root} (pass force to overwrite)`);
  }

  const files =
    template === 'bare'
      ? bareFiles(options.name)
      : template === 'skillgate'
        ? skillgateFiles(options.name)
        : agentOsFiles(options.name);

  fs.mkdirSync(root, { recursive: true });
  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    writeFile(root, rel, content);
    written.push(rel);
  }

  return { path: root, template, files: written };
}
