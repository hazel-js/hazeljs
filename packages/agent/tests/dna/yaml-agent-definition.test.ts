/**
 * AgentDefinition YAML → DNA → AgentOS.deploy (local apply path without hazeld).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { parseDna, type AgentDna } from '../../src/dna/agent-dna';
import { AgentOS } from '../../src/os/agent-os';
import { createMockLlmProvider } from '../../src/llm/http-llm.provider';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { projectAgentFromModule } from '../../src/node/load-project-agent';

const LOCAL_TEMPLATE_YAML = `
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDefinition
metadata:
  name: my_bot
spec:
  dna:
    format: hazeljs.agent.dna
    version: "1.0.0"
    name: my_bot
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

function extractDnaFromDoc(doc: unknown): AgentDna {
  if (!doc || typeof doc !== 'object') {
    throw new Error('expected document object');
  }
  const o = doc as Record<string, unknown>;
  if (o.format === 'hazeljs.agent.dna') return parseDna(o as unknown as AgentDna);
  if (o.kind === 'AgentDefinition' && (o.spec as { dna?: unknown })?.dna) {
    return parseDna((o.spec as { dna: AgentDna }).dna);
  }
  if (o.dna && typeof o.dna === 'object') return parseDna(o.dna as unknown as AgentDna);
  return parseDna(o as unknown as AgentDna);
}

describe('AgentDefinition YAML DNA', () => {
  it('parses template-shaped YAML into valid DNA with HITL tool', () => {
    const doc = parseYaml(LOCAL_TEMPLATE_YAML);
    const dna = extractDnaFromDoc(doc);
    expect(dna.format).toBe('hazeljs.agent.dna');
    expect(dna.name).toBe('my_bot');
    expect(dna.systemPrompt).toMatch(/order-support/i);
    expect(dna.tools?.map((t) => t.name)).toEqual(['lookup_order', 'issue_refund']);
    expect(dna.tools?.find((t) => t.name === 'issue_refund')?.requiresApproval).toBe(true);
    expect(dna.schedule?.kind).toBe('manual');
  });

  it('deploys YAML DNA and keeps requiresApproval on issue_refund', async () => {
    @Agent({ name: 'my_bot' })
    class MyBotAgent {
      @Tool()
      async lookup_order({ orderId }: { orderId: string }) {
        return { found: true as const, orderId };
      }

      @Tool({ requiresApproval: true })
      async issue_refund({ orderId, amount }: { orderId: string; amount: number }) {
        return { ok: true as const, orderId, amount };
      }
    }

    const project = projectAgentFromModule(
      { MyBotAgent },
      { preferredAgentName: 'my_bot', filePath: 'agent.ts' }
    );
    const spy = jest
      .spyOn(
        require('../../src/node/load-project-agent') as typeof import('../../src/node/load-project-agent'),
        'loadProjectAgent'
      )
      .mockReturnValue(project);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-yaml-apply-'));
    const dna = extractDnaFromDoc(parseYaml(LOCAL_TEMPLATE_YAML));
    const osPlane = new AgentOS({
      projectRoot: root,
      llmProvider: createMockLlmProvider('Done.'),
    });

    try {
      const deployed = await osPlane.deploy(dna);
      expect(deployed.id).toBe('my_bot');

      const tools = osPlane.runtime.getAgentTools('my_bot');
      const refund = tools.find((t) => t.name === 'issue_refund');
      const lookup = tools.find((t) => t.name === 'lookup_order');
      expect(lookup).toBeDefined();
      expect(refund?.requiresApproval).toBe(true);

      const out = await lookup!.method!.call(lookup!.target, { orderId: 'ORD-2042' });
      expect(out).toEqual({ found: true, orderId: 'ORD-2042' });

      // Platform store should persist the applied DNA (not empty tools).
      const resourcesPath = path.join(root, '.hazel', 'platform', 'resources.json');
      expect(fs.existsSync(resourcesPath)).toBe(true);
      const store = JSON.parse(fs.readFileSync(resourcesPath, 'utf8')) as {
        items: Array<{ kind: string; spec?: { dna?: AgentDna } }>;
      };
      const def = store.items.find((i) => i.kind === 'AgentDefinition');
      expect(def?.spec?.dna?.name).toBe('my_bot');
      expect(def?.spec?.dna?.tools?.map((t) => t.name)).toEqual([
        'lookup_order',
        'issue_refund',
      ]);
      expect(def?.spec?.dna?.tools?.find((t) => t.name === 'issue_refund')?.requiresApproval).toBe(
        true
      );
    } finally {
      spy.mockRestore();
      await osPlane.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
