/**
 * loadProjectAgent + projectAgentFromModule + AgentOS deploy wiring.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { loadProjectAgent, projectAgentFromModule } from '../../src/node/load-project-agent';
import { AgentOS } from '../../src/os/agent-os';
import { defineAgent } from '../../src/os/define-agent';
import { createMockLlmProvider } from '../../src/llm/http-llm.provider';

const agentPkgRoot = path.resolve(__dirname, '../..');
const distLoader = path.join(agentPkgRoot, 'dist/node/load-project-agent.js');
const distOs = path.join(agentPkgRoot, 'dist/os/agent-os.js');
const distReady = fs.existsSync(distLoader) && fs.existsSync(distOs);

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('projectAgentFromModule (src)', () => {
  @Agent({ name: 'desk' })
  class DeskAgent {
    @Tool({
      parameters: [{ name: 'orderId', type: 'string', description: 'Order id', required: true }],
    })
    async lookup_order({ orderId }: { orderId: string }) {
      return { found: true as const, orderId: orderId.toUpperCase() };
    }

    @Tool({
      name: 'issue_refund',
      requiresApproval: true,
      parameters: [
        { name: 'orderId', type: 'string', description: 'Order id', required: true },
        { name: 'amount', type: 'number', description: 'Amount', required: true },
      ],
    })
    async refund({ orderId, amount }: { orderId: string; amount: number }) {
      return { ok: true as const, orderId, amount };
    }
  }

  @Agent({ name: 'other' })
  class OtherAgent {
    @Tool()
    async ping() {
      return { ok: true };
    }
  }

  it('extracts @Tool handlers and prefers DNA name', async () => {
    const project = projectAgentFromModule(
      { DeskAgent, OtherAgent },
      { preferredAgentName: 'desk', filePath: 'agent.ts' }
    );
    expect(Object.keys(project.handlers).sort()).toEqual(['issue_refund', 'lookup_order']);
    await expect(project.handlers.lookup_order({ orderId: 'ord-1' })).resolves.toEqual({
      found: true,
      orderId: 'ORD-1',
    });
    await expect(project.handlers.issue_refund({ orderId: 'ORD-1', amount: 10 })).resolves.toEqual({
      ok: true,
      orderId: 'ORD-1',
      amount: 10,
    });
  });

  it('picks the sole @Agent when no preferred name', () => {
    const project = projectAgentFromModule({ DeskAgent });
    expect(project.agentClass).toBe(DeskAgent);
  });

  it('throws when no @Agent class is exported', () => {
    expect(() => projectAgentFromModule({ notAnAgent: 1 })).toThrow(/no @Agent class/);
  });

  it('throws when preferred name matches none of several agents', () => {
    expect(() =>
      projectAgentFromModule({ DeskAgent, OtherAgent }, { preferredAgentName: 'missing' })
    ).toThrow(/Multiple @Agent classes/);
  });

  it('throws when sole agent name mismatches DNA', () => {
    expect(() => projectAgentFromModule({ OtherAgent }, { preferredAgentName: 'desk' })).toThrow(
      /does not match DNA name "desk"/
    );
  });
});

describe('loadProjectAgent (src I/O)', () => {
  it('returns undefined when no agent file exists', () => {
    const root = tmpDir('hazel-empty-');
    try {
      expect(loadProjectAgent(root)).toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads agent.js from project root', async () => {
    const root = tmpDir('hazel-js-agent-');
    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'tmp', version: '1.0.0' })
      );
      // Write a CommonJS module that reuses this test file's already-decorated class via a thin shim:
      // instead, export a plain class and rely on projectAgentFromModule for decorator coverage;
      // here we only assert candidate resolution + require of a handler map module.
      fs.writeFileSync(
        path.join(root, 'agent.js'),
        `'use strict';
class Plain {}
module.exports = { Plain };
`
      );
      expect(() => loadProjectAgent(root, 'desk')).toThrow(/no @Agent class/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves src/agent.js candidate', () => {
    const root = tmpDir('hazel-src-agent-');
    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'tmp', version: '1.0.0' })
      );
      fs.mkdirSync(path.join(root, 'src'));
      fs.writeFileSync(path.join(root, 'src/agent.js'), 'module.exports = {};\n');
      expect(() => loadProjectAgent(root)).toThrow(/no @Agent class/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws when agent.ts is present but tsx is missing', () => {
    const root = tmpDir('hazel-tsx-missing-');
    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'tmp', version: '1.0.0' })
      );
      fs.writeFileSync(path.join(root, 'agent.ts'), 'export class X {}');
      expect(() => loadProjectAgent(root)).toThrow(/Install tsx/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('AgentOS deploy with project agent wiring', () => {
  @Agent({ name: 'desk' })
  class WiredAgent {
    @Tool()
    async lookup_order({ orderId }: { orderId: string }) {
      return { found: true as const, orderId, via: 'wired' };
    }
  }

  it('registers project class/handlers via loadProjectAgent', async () => {
    const project = projectAgentFromModule(
      { WiredAgent },
      { preferredAgentName: 'desk', filePath: 'agent.ts' }
    );
    const spy = jest
      .spyOn(
        require('../../src/node/load-project-agent') as typeof import('../../src/node/load-project-agent'),
        'loadProjectAgent'
      )
      .mockReturnValue(project);

    const root = tmpDir('hazel-os-wire-');
    const osPlane = new AgentOS({
      projectRoot: root,
      llmProvider: createMockLlmProvider('Done.'),
    });
    try {
      await osPlane.deploy(
        defineAgent({
          name: 'desk',
          mission: 'Orders',
          skills: [{ name: 'lookup_order', description: 'Look up' }],
          autonomy: 'high',
        })
      );
      // Re-deploy replaces the prior registration (unregister path).
      await osPlane.deploy(
        defineAgent({
          name: 'desk',
          mission: 'Orders again',
          skills: [{ name: 'lookup_order', description: 'Look up' }],
          autonomy: 'high',
        })
      );
      const tools = osPlane.runtime.getAgentTools('desk');
      const lookup = tools.find((t) => t.name === 'lookup_order');
      const out = await lookup!.method!.call(lookup!.target, { orderId: 'ORD-1' });
      expect(out).toEqual({ found: true, orderId: 'ORD-1', via: 'wired' });
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      await osPlane.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('warns and falls back when loadProjectAgent throws', async () => {
    const root = tmpDir('hazel-os-bad-');
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'tmp', version: '1.0.0' })
    );
    fs.writeFileSync(path.join(root, 'agent.js'), 'module.exports = { nope: true };\n');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const osPlane = new AgentOS({
      projectRoot: root,
      llmProvider: createMockLlmProvider('Done.'),
    });
    try {
      await osPlane.deploy(
        defineAgent({
          name: 'desk',
          mission: 'Orders',
          skills: ['lookup_order'],
          autonomy: 'high',
        })
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not load project agent.ts'));
      expect(osPlane.runtime.getAgentMetadata('desk')).toBeDefined();
    } finally {
      warn.mockRestore();
      await osPlane.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function tmpProject(): string {
  const root = tmpDir('hazel-project-agent-');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-bot',
      version: '1.0.0',
      private: true,
      dependencies: { '@hazeljs/agent': `file:${agentPkgRoot}` },
    })
  );
  const nm = path.join(root, 'node_modules');
  fs.mkdirSync(path.join(nm, '@hazeljs'), { recursive: true });
  fs.symlinkSync(agentPkgRoot, path.join(nm, '@hazeljs', 'agent'));
  const reflectEntry = require.resolve('reflect-metadata');
  fs.symlinkSync(path.dirname(reflectEntry), path.join(nm, 'reflect-metadata'));
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
Tool({ parameters: [{ name: 'orderId', type: 'string', required: true }] })(
  FixtureAgent.prototype, 'lookup_order', descLookup
);
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

(distReady ? describe : describe.skip)('loadProjectAgent (dist E2E)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadProjectAgent: loadDist } = require(
    distLoader
  ) as typeof import('../../src/node/load-project-agent');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AgentOS: DistOS } = require(distOs) as typeof import('../../src/os/agent-os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { defineAgent: defineDist } = require(
    path.join(agentPkgRoot, 'dist/os/define-agent.js')
  ) as typeof import('../../src/os/define-agent');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockLlmProvider: mockDist } = require(
    path.join(agentPkgRoot, 'dist/llm/http-llm.provider.js')
  ) as typeof import('../../src/llm/http-llm.provider');

  let root: string;

  beforeEach(() => {
    root = tmpProject();
  });

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('wires project handlers on AgentOS.deploy', async () => {
    writeAgentJs(root, 'desk');
    const osPlane = new DistOS({
      projectRoot: root,
      llmProvider: mockDist('Done.'),
    });
    try {
      await osPlane.deploy(
        defineDist({
          name: 'desk',
          mission: 'Help with orders',
          skills: [
            { name: 'lookup_order', description: 'Look up an order' },
            { name: 'issue_refund', description: 'Issue a refund', requiresApproval: true },
          ],
          autonomy: 'high',
        })
      );
      const tools = osPlane.runtime.getAgentTools('desk');
      const lookup = tools.find((t) => t.name === 'lookup_order');
      const out = await lookup!.method!.call(lookup!.target, { orderId: 'ORD-2042' });
      expect(out).toEqual({ found: true, orderId: 'ORD-2042', via: 'agent.js' });
    } finally {
      await osPlane.dispose();
    }
  });
});
