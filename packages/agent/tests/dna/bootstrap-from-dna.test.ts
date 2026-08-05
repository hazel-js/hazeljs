/**
 * bootstrapRuntimeFromDna (AOS-011 CLI foundation)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  bootstrapRuntimeFromDna,
  createAgentClassFromDna,
  createMockLlmProvider,
  exportAgentDna,
  resolveDnaSource,
} from '../../src';
import { AgentRunStatus } from '../../src/run/agent-run.types';
import { AgentState } from '../../src/types/agent.types';

describe('bootstrapRuntimeFromDna', () => {
  it('executes a DNA agent with mock LLM and durable store', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-boot-'));
    const dna = exportAgentDna({
      name: 'cli-desk',
      description: 'CLI bootstrap agent',
      systemPrompt: 'Be brief.',
      tools: [{ name: 'ping', description: 'Ping stub' }],
    });
    const dnaPath = path.join(dir, 'cli-desk.dna.json');
    fs.writeFileSync(dnaPath, JSON.stringify(dna, null, 2));

    const { runtime, store } = bootstrapRuntimeFromDna(dnaPath, {
      llmProvider: createMockLlmProvider('Hello from mock'),
      storeDir: path.join(dir, 'runs'),
      workerId: 'test-worker',
      stubTools: true,
    });

    const result = await runtime.execute('cli-desk', 'hi', { maxSteps: 3 });
    expect(result.state).toBe(AgentState.COMPLETED);
    expect(result.response).toContain('Hello');
    const run = await store!.runRepository.get(result.executionId);
    expect(run?.status).toBe(AgentRunStatus.COMPLETED);
    expect(run?.leaseOwner).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('resolves DNA from object / marketplace package and applies policies + handlers', async () => {
    const dna = exportAgentDna({
      name: 'policy-desk',
      tools: [{ name: 'echo', description: 'Echo' }],
      policies: [{ id: 'p1', tool: '*', effect: 'allow' }],
      metadata: { capabilities: ['chat'] },
    });
    expect(resolveDnaSource(dna).name).toBe('policy-desk');
    expect(resolveDnaSource({ name: 'pkg', version: '1.0.0', dna }).name).toBe('policy-desk');

    const Klass = createAgentClassFromDna(
      exportAgentDna({ name: 'bare', metadata: { capabilities: 'not-array' as never } })
    );
    expect(Klass.name).toBe('Dna_bare');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-boot2-'));
    const timelinePath = path.join(dir, 'custom-timeline.jsonl');
    let echoed: unknown;
    const {
      runtime,
      store,
      timelinePath: tp,
    } = bootstrapRuntimeFromDna(dna, {
      llmProvider: createMockLlmProvider('ok'),
      timelinePath,
      stubTools: false,
      durableSuspend: false,
      toolHandlers: {
        echo: async (input) => {
          echoed = input;
          return { echoed: input };
        },
      },
    });
    expect(store).toBeUndefined();
    expect(tp).toBe(timelinePath);
    expect(runtime).toBeDefined();
    expect(echoed).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('registers stub tools only when stubTools is true', () => {
    const dna = exportAgentDna({
      name: 'stub-desk',
      tools: [{ name: 'ping', description: 'Ping' }],
    });
    const withStubs = bootstrapRuntimeFromDna(dna, {
      llmProvider: createMockLlmProvider(),
      stubTools: true,
    });
    expect(withStubs.runtime).toBeDefined();

    const noStubs = bootstrapRuntimeFromDna(dna, {
      llmProvider: createMockLlmProvider(),
      stubTools: false,
    });
    expect(noStubs.runtime).toBeDefined();
  });
});
