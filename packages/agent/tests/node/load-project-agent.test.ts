/**
 * loadProjectAgent + AgentOS deploy wiring.
 *
 * Uses dist/ so the fixture's @hazeljs/agent require shares Reflect metadata
 * Symbols with the loader (jest/ts-jest would fork a second copy of src).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const agentPkgRoot = path.resolve(__dirname, '../..');
const distLoader = path.join(agentPkgRoot, 'dist/node/load-project-agent.js');
const distOs = path.join(agentPkgRoot, 'dist/os/agent-os.js');
const distReady = fs.existsSync(distLoader) && fs.existsSync(distOs);

function tmpProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-project-agent-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-bot',
      version: '1.0.0',
      private: true,
      dependencies: {
        '@hazeljs/agent': `file:${agentPkgRoot}`,
      },
    })
  );
  // Point node at the package under test without a full npm install.
  const nm = path.join(root, 'node_modules');
  fs.mkdirSync(path.join(nm, '@hazeljs'), { recursive: true });
  fs.symlinkSync(agentPkgRoot, path.join(nm, '@hazeljs', 'agent'));
  const reflectEntry = require.resolve('reflect-metadata');
  const reflectMeta = path.dirname(reflectEntry);
  fs.symlinkSync(reflectMeta, path.join(nm, 'reflect-metadata'));
  return root;
}

function writeAgentJs(root: string, agentName: string): void {
  const body = `'use strict';
require('reflect-metadata');
const { Agent, Tool } = require('@hazeljs/agent');

class FixtureAgent {
  async lookup_order(input) {
    return { found: true, orderId: String(input.orderId || '').toUpperCase(), via: 'agent.js' };
  }
  async issue_refund(input) {
    return { ok: true, orderId: input.orderId, amount: input.amount, via: 'agent.js' };
  }
}

const descLookup = Object.getOwnPropertyDescriptor(FixtureAgent.prototype, 'lookup_order');
const descRefund = Object.getOwnPropertyDescriptor(FixtureAgent.prototype, 'issue_refund');
Tool({
  parameters: [{ name: 'orderId', type: 'string', required: true }],
})(FixtureAgent.prototype, 'lookup_order', descLookup);
Tool({
  requiresApproval: true,
  parameters: [
    { name: 'orderId', type: 'string', required: true },
    { name: 'amount', type: 'number', required: true },
  ],
})(FixtureAgent.prototype, 'issue_refund', descRefund);
Agent({ name: '${agentName}' })(FixtureAgent);

module.exports = { FixtureAgent, agentName: '${agentName}' };
`;
  fs.writeFileSync(path.join(root, 'agent.js'), body);
}

(distReady ? describe : describe.skip)('loadProjectAgent (dist)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadProjectAgent } = require(
    distLoader
  ) as typeof import('../../src/node/load-project-agent');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AgentOS } = require(distOs) as typeof import('../../src/os/agent-os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { defineAgent } = require(
    path.join(agentPkgRoot, 'dist/os/define-agent.js')
  ) as typeof import('../../src/os/define-agent');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockLlmProvider } = require(
    path.join(agentPkgRoot, 'dist/llm/http-llm.provider.js')
  ) as typeof import('../../src/llm/http-llm.provider');

  let root: string;

  beforeEach(() => {
    root = tmpProject();
  });

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns undefined when no agent file exists', () => {
    expect(loadProjectAgent(root, 'desk')).toBeUndefined();
  });

  it('loads @Tool handlers from agent.js', async () => {
    writeAgentJs(root, 'desk');
    const project = loadProjectAgent(root, 'desk');
    expect(project?.filePath).toContain('agent.js');
    expect(Object.keys(project!.handlers).sort()).toEqual(['issue_refund', 'lookup_order']);
    const result = await project!.handlers.lookup_order({ orderId: 'ord-1' });
    expect(result).toEqual({ found: true, orderId: 'ORD-1', via: 'agent.js' });
  });

  it('wires project handlers on AgentOS.deploy', async () => {
    writeAgentJs(root, 'desk');
    const osPlane = new AgentOS({
      projectRoot: root,
      llmProvider: createMockLlmProvider('Done.'),
    });
    try {
      await osPlane.deploy(
        defineAgent({
          name: 'desk',
          mission: 'Help with orders',
          skills: [
            { name: 'lookup_order', description: 'Look up an order' },
            {
              name: 'issue_refund',
              description: 'Issue a refund',
              requiresApproval: true,
            },
          ],
          autonomy: 'high',
        })
      );
      const tools = osPlane.runtime.getAgentTools('desk');
      const lookup = tools.find((t) => t.name === 'lookup_order');
      expect(lookup?.method).toBeDefined();
      const out = await lookup!.method!.call(lookup!.target, { orderId: 'ORD-2042' });
      expect(out).toEqual({ found: true, orderId: 'ORD-2042', via: 'agent.js' });
    } finally {
      await osPlane.dispose();
    }
  });
});

describe('loadProjectAgent (src discovery)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadProjectAgent } =
    require('../../src/node/load-project-agent') as typeof import('../../src/node/load-project-agent');

  it('returns undefined for empty project root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-empty-'));
    try {
      expect(loadProjectAgent(root)).toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
