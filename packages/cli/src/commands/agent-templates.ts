/**
 * Agent OS project templates for `hazel agent new` / `hazel new agent`.
 *
 * DNA ≈ OpenAPI for agents (contract). `agents/*.agent.ts` = real `@Tool` handlers.
 * `hazel apply` loads `agents/index.ts` (or `./agent.ts`) into hazeld. `hazel agent run` on DNA alone still uses stubs.
 */

import * as fs from 'fs';
import * as path from 'path';

export type AgentTemplateId = 'local' | 'context' | 'bare' | 'agent-os' | 'skillgate';

export interface AgentTemplateMeta {
  id: AgentTemplateId;
  label: string;
  description: string;
}

export const AGENT_TEMPLATES: AgentTemplateMeta[] = [
  {
    id: 'local',
    label: 'Local Agent OS (default)',
    description:
      'Order-support desk: agents/*.agent.ts barrel + agent.yaml — hazel apply (no Kubernetes)',
  },
  {
    id: 'context',
    label: 'Context desk (CAG+RAG+KAG+Memory)',
    description:
      'Local Agent OS + agents/ barrel + ContextService — policy cache, handbook RAG, entity graph, prefs, HITL',
  },
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

function toPascalCase(name: string): string {
  const parts = sanitizeNpmName(name).split(/[-_]+/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') || 'Desk';
}

/** Shared OpenAI / Agent OS env template for scaffolds. */
function agentEnvExample(extra = ''): string {
  return `# Required for real tool selection via OpenAI (otherwise hazeld / AgentOS uses mock LLM)
OPENAI_API_KEY=

# Optional
HAZEL_AGENT_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
${extra}`;
}

function localFiles(projectName: string): Record<string, string> {
  const dnaName = agentDnaName(projectName);
  const npm = sanitizeNpmName(projectName);
  const display = projectName.trim() || npm;
  const className = `${toPascalCase(projectName)}Agent`;
  return {
    'package.json': JSON.stringify(
      {
        name: npm,
        version: '1.0.0',
        private: true,
        description: `Order-support desk agent — ${display}`,
        scripts: {
          start: 'hazel apply agent.yaml',
          inspect: `hazel inspect ${dnaName}`,
          ps: 'hazel ps',
          doctor: 'hazel doctor',
          run: `hazel run ${dnaName}`,
        },
        dependencies: {
          '@hazeljs/agent': '^2.1.0',
          '@hazeljs/agent-gatekeeper': '^2.1.0',
          '@hazeljs/config': '^2.1.0',
          '@hazeljs/core': '^2.1.0',
          '@hazeljs/eval': '^2.1.0',
          '@hazeljs/prompts': '^2.1.0',
          '@hazeljs/rag': '^2.1.0',
          '@hazeljs/resilience': '^2.1.0',
        },
        devDependencies: {
          '@hazeljs/cli': '^2.1.0',
          typescript: '^5.3.3',
          '@types/node': '^20.0.0',
          tsx: '^4.19.0',
        },
        keywords: ['hazeljs', 'agent-os', 'local-first', 'support-desk'],
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'tsconfig.json': localAgentTsconfig(),
    'agents/index.ts': localAgentsIndex(className),
    'agents/desk.agent.ts': localDeskAgentTs(dnaName, className),
    'agent.yaml': localAgentYaml(dnaName, display),
    'README.md': localAgentReadme(display, dnaName),
    '.env.example': agentEnvExample(),
    '.npmrc': 'legacy-peer-deps=true\n',
  };
}

function localAgentTsconfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["agents/**/*.ts", "*.ts"]
}
`;
}

/** AgentModule-style barrel — import every agent file so @Agent registers. */
function localAgentsIndex(className: string): string {
  return `/**
 * Project agents barrel (same idea as importing classes before AgentModule.forRoot()).
 * hazeld loads this file via loadProjectAgents() and matches DNA name → @Agent class.
 */
export { ${className} } from './desk.agent';

// Add new agents here, then apply a matching YAML (spec.dna.name === @Agent name):
// export { ShippingAgent } from './shipping.agent';
`;
}

/** Desk agent: look up orders + HITL refunds. */
function localDeskAgentTs(dnaName: string, className: string): string {
  return `import { Agent, Tool } from '@hazeljs/agent';

/** Sample orders — replace with your DB / API. */
const ORDERS: Record<string, { customer: string; item: string; total: number; status: string }> = {
  'ORD-2042': {
    customer: 'Amina R.',
    item: 'Hazel field jacket — size M',
    total: 148,
    status: 'delivered',
  },
  'ORD-1990': {
    customer: 'Jon K.',
    item: 'Agent OS sticker pack',
    total: 12,
    status: 'shipped',
  },
};

export const agentName = '${dnaName}';

/** Handlers only — prompt, tool catalog, and HITL flags live in agent.yaml. */
@Agent({ name: agentName })
export class ${className} {
  @Tool({
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id, e.g. ORD-2042', required: true },
    ],
  })
  async lookup_order({ orderId }: { orderId: string }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    if (!order) return { found: false as const, orderId: id };
    return { found: true as const, orderId: id, ...order };
  }

  @Tool({
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id', required: true },
      { name: 'amount', type: 'number', description: 'Refund amount in USD', required: true },
    ],
  })
  async issue_refund({ orderId, amount }: { orderId: string; amount: number }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    return {
      ok: true,
      orderId: id,
      amount: amount ?? order?.total ?? 0,
      currency: 'USD',
      ledgerRef: \`rfnd_\${Date.now().toString(36)}\`,
    };
  }
}
`;
}

function localAgentYaml(dnaName: string, display: string): string {
  return `# DNA contract for ${display} — identity, prompt, tool catalog.
# Handlers: agents/desk.agent.ts (via agents/index.ts). Apply: hazel apply agent.yaml
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDefinition
metadata:
  name: ${dnaName}
spec:
  dna:
    format: hazeljs.agent.dna
    version: "1.0.0"
    name: ${dnaName}
    description: Order support desk — lookup + HITL refunds
    systemPrompt: |
      You are a local order-support desk agent.
      Use lookup_order, then issue_refund only when a refund is clearly requested.
      Refunds require human approval.
    tools:
      - name: lookup_order
        description: Look up an order by id (try ORD-2042)
        parameters:
          - name: orderId
            type: string
            description: Order id, e.g. ORD-2042
            required: true
      - name: issue_refund
        description: Issue a refund (requires approval)
        requiresApproval: true
        parameters:
          - name: orderId
            type: string
            description: Order id
            required: true
          - name: amount
            type: number
            description: Refund amount in USD
            required: true
    schedule:
      kind: manual
`;
}

function localAgentReadme(display: string, dnaName: string): string {
  return `# ${display}

Order-support desk agent for local Agent OS.

**What it does:** look up sample orders (\`ORD-2042\`) and issue refunds that **pause for human approval**.

## Prerequisites

- **Node.js 18+**
- Packages listed in \`package.json\` (installed via \`npm install\`):
  - \`@hazeljs/agent\` — runtime, \`@Tool\`, hazeld
  - \`@hazeljs/agent-gatekeeper\` — HITL approvals
  - \`@hazeljs/config\` — loads project \`.env\` (\`loadEnvFiles\`) for hazeld
  - \`@hazeljs/core\` + peers (\`prompts\`, \`rag\`, \`resilience\`, …)
  - \`@hazeljs/cli\` (dev) — \`hazel\` / \`hazeld\` binaries
- **OpenAI API key** for real tool selection (optional — without it hazeld uses a mock LLM)

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
\`\`\`

| File | Role |
| --- | --- |
| \`agent.yaml\` | DNA — prompt, tool catalog, HITL (\`spec.dna.name\` must match \`@Agent({ name })\`) |
| \`agents/index.ts\` | Barrel — import/export every agent file (AgentModule-style) |
| \`agents/desk.agent.ts\` | Desk \`@Agent\` + \`@Tool\` handlers |
| \`.env.example\` | \`OPENAI_API_KEY\`, optional model / base URL |

## Getting started

\`\`\`bash
# Apply every AgentDefinition YAML in this folder (starts hazeld if needed)
hazel apply --all

# Or apply one / several files
hazel apply agent.yaml

hazel ps
hazel inspect ${dnaName}
hazel run ${dnaName} "look up order ORD-2042"
hazel run ${dnaName} "refund order ORD-2042"
hazel approvals
hazel approve <taskId>
\`\`\`

\`hazel apply\` starts \`hazeld\` if needed — agents stay Running after you close the terminal.
Re-run \`hazel apply\` (or \`--all\`) after editing agent files to reload handlers.

## Lifecycle commands

| Command | What it does |
| --- | --- |
| \`hazel apply --all\` | Register / reload every DNA YAML in the project root |
| \`hazel apply <file…>\` | Register / reload one or more YAML files |
| \`hazel ps\` | List agents and status (Running / Stopped) |
| \`hazel inspect <name>\` | Show DNA, tools, occupancy for one agent |
| \`hazel run <name> "…"\` | Send a message to a Running agent |
| \`hazel stop <name>\` | Pause an agent (stays listed as Stopped) |
| \`hazel start <name>\` | Resume a stopped agent |
| \`hazel restart <name>\` | Stop then start |
| \`hazel delete <name>\` | Remove the agent from hazeld (unregisters it) |
| \`hazel approvals\` | List pending HITL approvals |
| \`hazel approve <taskId>\` | Approve a waiting tool call |
| \`hazel deny <taskId>\` | Deny a waiting tool call |

\`\`\`bash
hazel stop ${dnaName}       # pause only
hazel start ${dnaName}      # resume
hazel delete ${dnaName}     # remove from hazeld (files stay on disk)
hazel apply agent.yaml      # register again from YAML
\`\`\`

## Add another agent

1. Create \`agents/shipping.agent.ts\` with \`@Agent({ name: 'shipping' })\` and \`@Tool\` methods.
2. Export it from \`agents/index.ts\` (e.g. \`export { ShippingAgent } from './shipping.agent';\`).
3. Add \`shipping.yaml\` with \`spec.dna.name: shipping\` and a \`tools:\` catalog matching your \`@Tool\` methods.
4. Apply:

\`\`\`bash
hazel apply shipping.yaml
# or reload everything:
hazel apply --all
\`\`\`

hazeld loads \`agents/index.ts\` and matches **DNA name → \`@Agent({ name })\`**. Names must match exactly.

- **With \`OPENAI_API_KEY\`:** OpenAI function calling selects tools.
- **Without a key:** mock LLM replies (tools still registered; no real selection).
- If hazeld was already running before you set the key, **restart** it so it reloads \`.env\`.

Want CAG + RAG + KAG + Memory on the same path?  
\`hazel new agent my-desk --template=context\`

Guide: [Run Your First Autonomous Agent Locally](https://hazeljs.ai/docs/guides/local-agent-os)
`;
}

function contextFiles(projectName: string): Record<string, string> {
  const dnaName = agentDnaName(projectName);
  const npm = sanitizeNpmName(projectName);
  const display = projectName.trim() || npm;
  const className = `${toPascalCase(projectName)}Agent`;
  return {
    'package.json': JSON.stringify(
      {
        name: npm,
        version: '1.0.0',
        private: true,
        description: `Context desk — ${display} (CAG+RAG+KAG+Memory + HITL)`,
        scripts: {
          start: 'hazel apply agent.yaml',
          inspect: `hazel inspect ${dnaName}`,
          ps: 'hazel ps',
          doctor: 'hazel doctor',
          run: `hazel run ${dnaName}`,
          demo: 'tsx scripts/walkthrough.ts',
        },
        dependencies: {
          '@hazeljs/agent': '^2.1.0',
          '@hazeljs/agent-gatekeeper': '^2.1.0',
          '@hazeljs/config': '^2.1.0',
          '@hazeljs/context': '^2.1.0',
          '@hazeljs/core': '^2.1.0',
          '@hazeljs/cag': '^2.1.0',
          '@hazeljs/eval': '^2.1.0',
          '@hazeljs/kag': '^2.1.0',
          '@hazeljs/memory': '^2.1.0',
          '@hazeljs/prompts': '^2.1.0',
          '@hazeljs/rag': '^2.1.0',
          '@hazeljs/resilience': '^2.1.0',
        },
        devDependencies: {
          '@hazeljs/cli': '^2.1.0',
          typescript: '^5.3.3',
          '@types/node': '^20.0.0',
          tsx: '^4.19.0',
        },
        keywords: ['hazeljs', 'agent-os', 'context', 'rag', 'cag', 'kag', 'memory'],
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["agents/**/*.ts", "*.ts", "scripts/**/*.ts"]
}
`,
    'kb/policy.md': contextKbPolicy(),
    'kb/faq.md': contextKbFaq(),
    'kb/graph.json': contextKbGraph(),
    'context.ts': contextDeskTs(),
    'agents/index.ts': localAgentsIndex(className),
    'agents/desk.agent.ts': contextAgentTs(dnaName, className),
    'agent.yaml': contextAgentYaml(dnaName, display),
    'scripts/walkthrough.ts': contextWalkthroughTs(dnaName),
    'README.md': contextAgentReadme(display, dnaName),
    '.env.example': agentEnvExample(),
    '.npmrc': 'legacy-peer-deps=true\n',
  };
}

function contextKbPolicy(): string {
  return `# Refund & returns policy (stable)

- Damaged goods: full refund within **30 days** of delivery when photo evidence is attached.
- Change of mind: return within 14 days; restocking fee 10% if opened.
- Shipping delays over 7 business days: offer $15 credit or free expedited reship.
- Refunds over $100 always require human approval before money moves.
`;
}

function contextKbFaq(): string {
  return `# Support handbook

## Escalating a shipping delay
If tracking shows no movement for 5+ days, open a carrier ticket, notify the customer, and offer a $15 credit or expedited reship per policy.

## Damaged item intake
Ask for photos of the item and packaging. Quote the 30-day damaged-goods window. Do not issue a refund until lookup_order confirms delivery.

## Contact preferences
Honor the customer's preferred channel (email / SMS / phone) when drafting follow-ups.
`;
}

function contextKbGraph(): string {
  return JSON.stringify(
    {
      orders: {
        'ORD-2042': {
          customerId: 'cust_amina',
          customer: 'Amina R.',
          sku: 'HZ-JACKET-M',
          product: 'Hazel field jacket — size M',
          total: 148,
          status: 'delivered',
        },
        'ORD-1990': {
          customerId: 'cust_jon',
          customer: 'Jon K.',
          sku: 'HZ-STICKER',
          product: 'Agent OS sticker pack',
          total: 12,
          status: 'shipped',
        },
      },
      edges: [
        { from: 'ORD-2042', rel: 'OWNED_BY', to: 'cust_amina' },
        { from: 'ORD-2042', rel: 'CONTAINS', to: 'HZ-JACKET-M' },
        { from: 'ORD-1990', rel: 'OWNED_BY', to: 'cust_jon' },
        { from: 'ORD-1990', rel: 'CONTAINS', to: 'HZ-STICKER' },
      ],
    },
    null,
    2
  );
}

function contextDeskTs(): string {
  return `import * as fs from 'fs';
import * as path from 'path';
import { ContextService, CONTEXT_EVENTS, type AssembledContext } from '@hazeljs/context';
import {
  createDefaultMemoryStore,
  MemoryCategory,
  MemoryService,
} from '@hazeljs/memory';

const kbDir = path.join(__dirname, 'kb');
const TENANT = 'desk-local';

function readKb(name: string): string {
  return fs.readFileSync(path.join(kbDir, name), 'utf8');
}

type GraphDoc = {
  orders: Record<
    string,
    {
      customerId: string;
      customer: string;
      sku: string;
      product: string;
      total: number;
      status: string;
    }
  >;
  edges: Array<{ from: string; rel: string; to: string }>;
};

function chunkFaq(faq: string): Array<{ id: string; content: string }> {
  return faq
    .split(/\\n##\\s+/)
    .map((block, i) => block.trim())
    .filter(Boolean)
    .map((block, i) => ({
      id: \`faq-\${i}\`,
      content: block.startsWith('#') ? block : \`## \${block}\`,
    }));
}

function scorePassage(query: string, content: string): number {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  const hay = content.toLowerCase();
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits += 1;
  return hits / terms.length;
}

let boot: Promise<{
  service: ContextService;
  memory: MemoryService;
}> | null = null;

/** Offline ContextService: CAG policy + RAG FAQ + KAG graph + Memory prefs. */
export async function getDeskContext() {
  if (!boot) {
    boot = (async () => {
      const policy = readKb('policy.md');
      const faqChunks = chunkFaq(readKb('faq.md'));
      const graph = JSON.parse(readKb('graph.json')) as GraphDoc;

      const store = createDefaultMemoryStore();
      const memory = new MemoryService(store);
      await memory.initialize();

      const service = new ContextService({
        strategy: 'auto',
        sources: ['cache', 'rag', 'knowledge', 'memory'],
        maxTokens: 1200,
        cag: {
          async getContext() {
            return {
              context: { text: policy.trim(), fingerprint: 'policy-v1' },
              hit: true,
            };
          },
        },
        rag: {
          async search(query: string, options?: { topK?: number }) {
            const topK = options?.topK ?? 3;
            return faqChunks
              .map((c) => ({ ...c, score: scorePassage(query, c.content) }))
              .filter((c) => c.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, topK)
              .map((c) => ({ id: c.id, content: c.content, score: c.score }));
          },
        },
        kag: {
          async ask(question: string) {
            const match = question.toUpperCase().match(/ORD-?\\d+/);
            const id = match
              ? match[0].startsWith('ORD')
                ? match[0].replace(/^ORD(?!-)/, 'ORD-')
                : match[0]
              : 'ORD-2042';
            const normalized = id.startsWith('ORD-') ? id : \`ORD-\${id.replace(/\\D/g, '')}\`;
            const order = graph.orders[normalized];
            if (!order) {
              return {
                answer: \`No graph node for \${normalized}\`,
                explanation: 'entity miss',
                confidence: 0.2,
              };
            }
            const edges = graph.edges.filter((e) => e.from === normalized);
            return {
              answer: \`\${normalized} is owned by \${order.customer} (\${order.customerId}) and contains \${order.product} [\${order.sku}] — status \${order.status}, total $\${order.total}.\`,
              explanation: edges.map((e) => \`\${e.from} -[\${e.rel}]-> \${e.to}\`).join('; '),
              evidence: [{ orderId: normalized, ...order, edges }],
              confidence: 0.95,
            };
          },
        },
        memory: {
          async query({ userId, limit }) {
            const items = await memory.query({ userId, limit: limit ?? 20 });
            return items.map((item) => ({
              key: item.key,
              value: item.value,
              category: String(item.category),
            }));
          },
        },
      });

      service.on(CONTEXT_EVENTS.PLANNED, (payload: unknown) => {
        const p = payload as { plan?: { sources?: string[]; rationale?: string[] } };
        const sources = p.plan?.sources?.join(', ') ?? '(none)';
        const why = (p.plan?.rationale ?? []).join(' | ') || '—';
        // eslint-disable-next-line no-console
        console.log(\`  [context] plan → \${sources}\`);
        // eslint-disable-next-line no-console
        console.log(\`  [context] why  → \${why}\`);
      });

      return { service, memory };
    })();
  }
  return boot;
}

export async function assembleContext(
  query: string,
  opts?: { userId?: string; sessionId?: string }
): Promise<AssembledContext> {
  const { service } = await getDeskContext();
  return service.assemble({
    query,
    tenantId: TENANT,
    userId: opts?.userId ?? 'desk-user',
    sessionId: opts?.sessionId,
    agentId: 'context-desk',
  });
}

export async function rememberPreference(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const { memory } = await getDeskContext();
  await memory.save({
    userId,
    category: MemoryCategory.PREFERENCE,
    key,
    value,
    source: 'explicit',
    confidence: 1,
    evidence: [],
  });
}
`;
}

function contextAgentTs(dnaName: string, className: string): string {
  return `import { Agent, Tool } from '@hazeljs/agent';
import { assembleContext, rememberPreference } from '../context';

const ORDERS: Record<string, { customer: string; item: string; total: number; status: string }> = {
  'ORD-2042': {
    customer: 'Amina R.',
    item: 'Hazel field jacket — size M',
    total: 148,
    status: 'delivered',
  },
  'ORD-1990': {
    customer: 'Jon K.',
    item: 'Agent OS sticker pack',
    total: 12,
    status: 'shipped',
  },
};

export const agentName = '${dnaName}';

/**
 * Context desk — local Agent OS + CAG/RAG/KAG/Memory planner + HITL refunds.
 */
@Agent({
  name: agentName,
  description: 'Support desk with multi-layer context + HITL refunds',
  systemPrompt: [
    'You are a local order-support desk agent with a context planner.',
    'Call assemble_context before answering policy, handbook, entity, or preference questions.',
    'Use lookup_order for order facts, remember for lasting preferences, issue_refund only when a refund is clearly requested.',
    'Refunds require human approval — never invent approval.',
  ].join(' '),
  maxSteps: 10,
})
export class ${className} {
  @Tool({
    name: 'assemble_context',
    description:
      'Plan + assemble CAG/RAG/KAG/Memory for a question (logs which sources the planner picked)',
    parameters: [
      { name: 'query', type: 'string', description: 'User question', required: true },
      { name: 'userId', type: 'string', description: 'User id for memory', required: false },
    ],
  })
  async assemble_context({ query, userId }: { query: string; userId?: string }) {
    const assembled = await assembleContext(query, { userId: userId ?? 'desk-user' });
    return {
      sourcesUsed: assembled.sourcesUsed,
      rationale: assembled.plan.rationale,
      text: assembled.text,
      tokenEstimate: assembled.tokenEstimate,
    };
  }

  @Tool({
    name: 'remember',
    description: 'Store a lasting preference for this user (Memory layer)',
    parameters: [
      { name: 'userId', type: 'string', description: 'User id', required: false },
      { name: 'key', type: 'string', description: 'Preference key, e.g. contact_channel', required: true },
      { name: 'value', type: 'string', description: 'Preference value, e.g. email', required: true },
    ],
  })
  async remember({
    userId,
    key,
    value,
  }: {
    userId?: string;
    key: string;
    value: string;
  }) {
    const uid = userId ?? 'desk-user';
    await rememberPreference(uid, key, value);
    return { ok: true, userId: uid, key, value };
  }

  @Tool({
    name: 'lookup_order',
    description: 'Look up an order by id (try ORD-2042)',
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id, e.g. ORD-2042', required: true },
    ],
  })
  async lookup_order({ orderId }: { orderId: string }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    if (!order) return { found: false as const, orderId: id };
    return { found: true as const, orderId: id, ...order };
  }

  @Tool({
    name: 'issue_refund',
    description: 'Issue a refund (pauses for human approval)',
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id', required: true },
      { name: 'amount', type: 'number', description: 'Refund amount in USD', required: true },
    ],
  })
  async issue_refund({ orderId, amount }: { orderId: string; amount: number }) {
    const id = (orderId || 'ORD-2042').toUpperCase();
    const order = ORDERS[id];
    return {
      ok: true,
      orderId: id,
      amount: amount ?? order?.total ?? 0,
      currency: 'USD',
      ledgerRef: \`rfnd_\${Date.now().toString(36)}\`,
    };
  }
}
`;
}

function contextAgentYaml(dnaName: string, display: string): string {
  return `# DNA for ${display} — context desk (CAG+RAG+KAG+Memory + HITL).
# Handlers: agents/desk.agent.ts (via agents/index.ts) · Context: context.ts · Seeds: kb/
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDefinition
metadata:
  name: ${dnaName}
spec:
  dna:
    format: hazeljs.agent.dna
    version: "1.0.0"
    name: ${dnaName}
    description: Support desk with ContextService + HITL refunds
    systemPrompt: |
      You are a local order-support desk agent with a context planner.
      Call assemble_context for policy/handbook/entity/preference questions.
      Use lookup_order, remember, and issue_refund (HITL) as needed.
    tools:
      - name: assemble_context
        description: Plan + assemble CAG/RAG/KAG/Memory for a question
      - name: remember
        description: Store a lasting preference (Memory)
      - name: lookup_order
        description: Look up an order by id
      - name: issue_refund
        description: Issue a refund (requires approval)
        requiresApproval: true
    schedule:
      kind: manual
`;
}

function contextWalkthroughTs(dnaName: string): string {
  return `/**
 * Offline walkthrough — shows ContextService source picks (no API key).
 * HITL refund path: hazel apply && hazel run … && hazel approvals
 */
import { assembleContext, rememberPreference } from '../context';

async function main(): Promise<void> {
  console.log('\\n=== Context desk walkthrough (${dnaName}) ===\\n');

  const policy = await assembleContext('What is the refund policy for damaged goods?');
  console.log('1) Policy question');
  console.log('   sources:', policy.sourcesUsed.join(', '));
  console.log('   snippet:', policy.text.slice(0, 160).replace(/\\n/g, ' '), '…\\n');

  const handbook = await assembleContext('How do I escalate a shipping delay according to the handbook?');
  console.log('2) Handbook / RAG');
  console.log('   sources:', handbook.sourcesUsed.join(', '));
  console.log('   snippet:', handbook.text.slice(0, 160).replace(/\\n/g, ' '), '…\\n');

  const entity = await assembleContext('Who owns ORD-2042 and which product is related?');
  console.log('3) Entity / KAG');
  console.log('   sources:', entity.sourcesUsed.join(', '));
  console.log('   snippet:', entity.text.slice(0, 160).replace(/\\n/g, ' '), '…\\n');

  await rememberPreference('desk-user', 'contact_channel', 'email');
  const pref = await assembleContext('Remember — what contact channel do I prefer?', {
    userId: 'desk-user',
  });
  console.log('4) Memory preference');
  console.log('   sources:', pref.sourcesUsed.join(', '));
  console.log('   snippet:', pref.text.slice(0, 160).replace(/\\n/g, ' '), '…\\n');

  console.log('5) HITL refund (needs hazeld):');
  console.log('   hazel apply agent.yaml');
  console.log('   hazel run ${dnaName} "refund order ORD-2042"');
  console.log('   hazel approvals && hazel approve <taskId>\\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
`;
}

function contextAgentReadme(display: string, dnaName: string): string {
  return `# ${display}

**Context desk** — local Agent OS + multi-layer context + HITL refunds.

## Prerequisites

- **Node.js 18+**
- \`npm install\` (includes \`@hazeljs/agent\`, \`@hazeljs/agent-gatekeeper\`, \`@hazeljs/config\`, context/RAG peers, \`@hazeljs/cli\`)
- **OpenAI API key** for real tool selection (optional — mock LLM without it)

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Set OPENAI_API_KEY=sk-...
\`\`\`

| Layer | Demo prompt |
| --- | --- |
| **CAG** | "What is the refund policy for damaged goods?" |
| **RAG** | "How do I escalate a shipping delay?" |
| **KAG** | "Who owns ORD-2042 and what product is it?" |
| **Memory** | \`remember\` contact_channel=email, then ask again |
| **HITL** | "Refund ORD-2042" → \`hazel approve\` |

| File | Role |
| --- | --- |
| \`agents/index.ts\` | Barrel — import/export every \`@Agent\` file |
| \`agents/desk.agent.ts\` | Tools: assemble_context, remember, lookup_order, issue_refund |
| \`context.ts\` | \`ContextService\` planner + offline CAG/RAG/KAG/Memory ports |
| \`kb/\` | policy.md, faq.md, graph.json |
| \`agent.yaml\` | DNA for \`hazel apply\` (matches \`@Agent\` name via barrel) |
| \`.env.example\` | \`OPENAI_API_KEY\`, optional model / base URL |

## Getting started

\`\`\`bash
# Offline context planner walkthrough (no hazeld)
npm run demo

# Apply DNA + start hazeld, then chat
hazel apply --all
hazel ps
hazel inspect ${dnaName}
hazel run ${dnaName} "What is the refund policy for damaged goods?"
hazel run ${dnaName} "refund order ORD-2042"
hazel approvals
hazel approve <taskId>
\`\`\`

\`hazel apply\` starts \`hazeld\` if needed. Re-run after editing \`agents/\` or YAML.

## Lifecycle commands

| Command | What it does |
| --- | --- |
| \`hazel apply --all\` | Register / reload every DNA YAML in the project root |
| \`hazel apply <file…>\` | Register / reload one or more YAML files |
| \`hazel ps\` | List agents and status |
| \`hazel inspect <name>\` | Show DNA, tools, occupancy |
| \`hazel run <name> "…"\` | Send a message |
| \`hazel stop <name>\` / \`start\` / \`restart\` | Pause / resume / bounce |
| \`hazel delete <name>\` | Remove from hazeld (files stay on disk) |
| \`hazel approvals\` / \`approve\` / \`deny\` | HITL gatekeeper |

\`\`\`bash
hazel stop ${dnaName}
hazel start ${dnaName}
hazel delete ${dnaName}
hazel apply agent.yaml
\`\`\`

## Add another agent

1. Create \`agents/foo.agent.ts\` with \`@Agent({ name: 'foo' })\` and \`@Tool\` methods.
2. Export it from \`agents/index.ts\`.
3. Add \`foo.yaml\` with matching \`spec.dna.name\` and tool catalog.
4. \`hazel apply foo.yaml\` or \`hazel apply --all\`.

hazeld matches **DNA name → \`@Agent({ name })\`**. Restart hazeld after changing \`.env\` if it was already running.

Deeper package labs (Meridian): \`example:rag\` · \`example:cag\` · \`example:kag\` · \`example:context\`

Guide: [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os)
`;
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
        dependencies: {
          '@hazeljs/agent': '^2.1.0',
        },
        devDependencies: {
          '@hazeljs/cli': '^2.1.0',
        },
        keywords: ['hazeljs', 'agent-os', 'dna'],
        license: 'Apache-2.0',
      },
      null,
      2
    ),
    'dna/agent.marketplace.json': pkgJson,
    '.env.example': agentEnvExample(),
    'README.md': `# ${projectName}

Bare **Agent DNA** package — contract only (OpenAPI-for-agents). No \`@Tool\` handlers yet.

## Prerequisites

- **Node.js 18+**
- \`npm install\` (\`@hazeljs/agent\` + \`@hazeljs/cli\`)
- Optional: \`OPENAI_API_KEY\` for a real LLM (\`hazel agent run\` uses a mock without it, or pass \`--mock\`)

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Optionally set OPENAI_API_KEY=sk-...
\`\`\`

| File | Role |
| --- | --- |
| \`dna/agent.marketplace.json\` | DNA + marketplace metadata (prompt, tools catalog) |
| \`.env.example\` | Optional \`OPENAI_API_KEY\` |

## Getting started

\`\`\`bash
# 1) Smoke-run DNA with stub tools
npx hazel agent run dna/agent.marketplace.json "hello"
npx hazel agent run dna/agent.marketplace.json "hello" --mock

# 2) Publish to the local store, then install into an app
npx hazel store publish dna/agent.marketplace.json
npx hazel store install @local/${sanitizeNpmName(projectName)}-agent --cwd /path/to/app
\`\`\`

## Commands

| Command | What it does |
| --- | --- |
| \`npx hazel agent run dna/agent.marketplace.json "…"\` | Run DNA with **stub** tools (+ mock/real LLM) |
| \`npx hazel agent run … --mock\` | Force mock LLM (no API key needed) |
| \`npx hazel store publish dna/agent.marketplace.json\` | Publish package to local store |
| \`npx hazel store install @local/… --cwd <app>\` | Install DNA package into another project |

## Important

- \`hazel agent run\` uses **stub** handlers — fine for packaging smoke, not production.
- For real tools + local daemon: \`hazel new agent my-desk\` (local template) → \`hazel apply --all\`.
- For API-governed skills: \`hazel new agent my-api --template=skillgate\`.

Guide: [Agent DNA & marketplace](https://hazeljs.ai/docs/guides/local-agent-os)
`,
  };
}

function agentOsOpsFiles(npm: string, _projectName: string): Record<string, string> {
  const deployment = npm;
  const hpaName = `${npm}-hpa`;

  return {
    '.env.example': agentEnvExample(`# Agent runtime
HITL=0

# Ops stack (proactive scaling + reactive self-healing)
ENABLE_OPS_STACK=0
K8S_DEPLOYMENT=${deployment}
K8S_NAMESPACE=default
K8S_HPA_NAME=${hpaName}
PROMETHEUS_URL=http://prometheus.monitoring.svc:9090
SLACK_BOT_TOKEN=
PAGERDUTY_ROUTING_KEY=
`),
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
          '@hazeljs/agent': '^2.1.0',
          '@hazeljs/config': '^2.1.0',
          '@hazeljs/core': '^2.1.0',
          '@hazeljs/self-healing': '^2.1.0',
          '@hazeljs/predictive-scaling': '^2.1.0',
        },
        devDependencies: {
          '@hazeljs/cli': '^2.1.0',
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
  resolveLlmFromEnv,
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
  // Uses OPENAI_API_KEY from env/.env when set; otherwise mock LLM.
  const llm = resolveLlmFromEnv();

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

**Agent OS mini-app** — DNA contract + **real** \`@Tool\` handlers in a Node process (not hazeld).

## Prerequisites

- **Node.js 18+**
- \`npm install\` (\`@hazeljs/agent\`, \`@hazeljs/core\`, \`@hazeljs/config\`, ops packages, \`@hazeljs/cli\`)
- **OpenAI API key** for real tool selection (optional — mock without it)

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Set OPENAI_API_KEY=sk-...
\`\`\`

| Path | Role |
| --- | --- |
| \`dna/agent.marketplace.json\` | DNA / marketplace package (prompt + tool catalog) |
| \`src/support.agent.ts\` | Real \`@Agent\` / \`@Tool\` handlers |
| \`src/main.ts\` | \`AgentRuntime\` bootstrap (\`resolveLlmFromEnv\`) |
| \`src/ops/stack.ts\` | Predictive scaling + self-healing ops stack |
| \`deploy/kubernetes/\` | K8s Deployment, HPA, RBAC for in-cluster ops |
| \`.env.example\` | \`OPENAI_API_KEY\`, \`HITL\`, ops flags |

## Getting started

\`\`\`bash
# 1) Run the mini-app with real tools
npm run dev
npm run dev -- "I want a refund for ORD-1002"

# 2) Optional: DNA smoke with stub tools (not the same as npm run dev)
npx hazel agent run dna/agent.marketplace.json "hello"

# 3) Publish / install the DNA package
npm run store:publish
npm run store:install
\`\`\`

Set \`HITL=1\` in \`.env\` to pause on \`processRefund\` approvals.

## Commands

| Command | What it does |
| --- | --- |
| \`npm run dev\` | Start AgentRuntime with real \`@Tool\` handlers |
| \`npm run dev -- "…"\` | Same, with a one-shot user message |
| \`npx hazel agent run dna/…\` | DNA-only smoke (**stubs** — packaging check) |
| \`npm run store:publish\` | Publish DNA to local store |
| \`npm run store:install\` | Install published package |
| \`ENABLE_OPS_STACK=1 npm run dev\` | Enable predictive scaling + self-healing |
| \`kubectl apply -k deploy/kubernetes\` | Deploy ops-capable workload to the cluster |

## Add / change tools

1. Edit \`src/support.agent.ts\` — add \`@Tool\` methods (and keep DNA \`tools\` in sync if you publish).
2. Update \`dna/agent.marketplace.json\` tool catalog / prompt if the contract changes.
3. Re-run \`npm run dev\`.

For a **local hazeld daemon** multi-agent layout (\`agents/*.agent.ts\` + \`hazel apply --all\`), use:

\`\`\`bash
hazel new agent my-desk
\`\`\`

## Production ops (predictive + self-healing)

\`\`\`bash
ENABLE_OPS_STACK=1 npm run dev
kubectl apply -k deploy/kubernetes
\`\`\`

- **Proactive:** \`@hazeljs/predictive-scaling\` forecasts traffic and adjusts HPA min replicas
- **Reactive:** \`@hazeljs/self-healing\` heals failures, drains pods, opens Slack/Jira alerts

Guide: [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os)
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
          '@hazeljs/agent': '^2.1.0',
          '@hazeljs/skillgate': '^2.1.0',
        },
        devDependencies: {
          '@hazeljs/cli': '^2.1.0',
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
    '.env.example': agentEnvExample(`# Skillgate upstream API
API_BASE_URL=http://127.0.0.1:3000
`),
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

## Prerequisites

- **Node.js 18+**
- \`npm install\` (\`@hazeljs/agent\`, \`@hazeljs/skillgate\`, \`@hazeljs/cli\`)
- Optional: \`OPENAI_API_KEY\` for \`hazel agent run\` (or pass \`--mock\`)
- Optional: upstream API at \`API_BASE_URL\` (default \`http://127.0.0.1:3000\`)

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Optionally set OPENAI_API_KEY=sk-... and API_BASE_URL=...
\`\`\`

| File | Role |
| --- | --- |
| \`openapi/sample.openapi.json\` | Sample OpenAPI (\`getOrder\` read, \`createRefund\` write+approval) |
| \`src/report.ts\` | Skillgate \`fromOpenApi\` → include/deny report + registry |
| \`dna/agent.marketplace.json\` | DNA / marketplace package for store + CLI smoke |
| \`.env.example\` | \`OPENAI_API_KEY\`, \`API_BASE_URL\` |

## Getting started

\`\`\`bash
# 1) See which OpenAPI ops become agent skills
npm run report

# 2) Smoke-run DNA (stub tools unless you wire Skillgate into a runtime)
npm run agent:run
npx hazel agent run dna/agent.marketplace.json "get order ORD-1" --mock

# 3) Publish the DNA package
npm run store:publish
\`\`\`

## Commands

| Command | What it does |
| --- | --- |
| \`npm run report\` | Print Skillgate included/denied skills + registered tool names |
| \`npm run agent:run\` | \`hazel agent run\` against the DNA package |
| \`npx hazel agent run dna/… --mock\` | DNA smoke with mock LLM |
| \`npm run store:publish\` | Publish DNA to local store |

## Customize

1. Edit \`openapi/sample.openapi.json\` — add paths / \`x-hazel-skill\` metadata.
2. Point \`API_BASE_URL\` at your real API.
3. Re-run \`npm run report\` to verify include/deny + approval classes.
4. Update \`dna/agent.marketplace.json\` if the published tool catalog should change.

For a **local hazeld** desk with \`agents/*.agent.ts\` + \`hazel apply --all\`:

\`\`\`bash
hazel new agent my-desk
\`\`\`

See also: full showcase \`hazeljs-skillgate-agent-starter\` in the monorepo.

Guide: [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os)
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
    template === 'local'
      ? localFiles(options.name)
      : template === 'context'
        ? contextFiles(options.name)
        : template === 'bare'
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
