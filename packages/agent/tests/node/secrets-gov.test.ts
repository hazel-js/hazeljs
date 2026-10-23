/**
 * Secret store + redaction + refund approval path.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  EncryptedFileSecretStore,
  createSecretStore,
  resolveDnaSecrets,
  redactSecrets,
  getDaemonSecret,
  activateSecrets,
  HazeldServer,
  ensureHazelHome,
  hazelHome,
  AgentRunStatus,
  AgentState,
  tryCreateLocalGatekeeper,
  type LLMProvider,
  type LLMChatRequest,
  type LLMChatResponse,
} from '../../src';

describe('secrets prod path', () => {
  let tmp: string;

  beforeEach(() => {
    const root = path.join(__dirname, '..', '..', '.tmp-test');
    fs.mkdirSync(root, { recursive: true });
    tmp = fs.mkdtempSync(path.join(root, 'sec-'));
    process.env.HAZEL_HOME = tmp;
    ensureHazelHome(hazelHome(tmp));
  });

  afterEach(() => {
    delete process.env.HAZEL_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('round-trips encrypted secrets without echoing', async () => {
    const store = createSecretStore(tmp);
    await store.set('OPENAI_API_KEY', 'sk-test-secret-value');
    expect(await store.get('OPENAI_API_KEY')).toBe('sk-test-secret-value');
    expect(store.backend === 'encrypted-file' || store.backend === 'keytar').toBe(true);

    const fileStore = new EncryptedFileSecretStore(tmp);
    const master = fileStore.masterKeyPath;
    expect(fs.existsSync(master)).toBe(true);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(master).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it('resolves DNA env secret refs in-daemon', async () => {
    const store = createSecretStore(tmp);
    await store.set('API_TOKEN', 'tok_abc');
    const resolved = await resolveDnaSecrets(
      {
        format: 'hazeljs.agent.dna',
        version: '1.0.0',
        name: 'x',
        tools: [],
        exportedAt: new Date().toISOString(),
        env: {
          PLAIN: 'ok',
          API_TOKEN: { secret: 'API_TOKEN' },
          MISSING: { secret: 'NOPE' },
        },
      },
      store
    );
    expect(resolved.PLAIN).toBe('ok');
    expect(resolved.API_TOKEN).toBe('tok_abc');
    expect(resolved.MISSING).toBeUndefined();

    const restore = activateSecrets(resolved);
    expect(getDaemonSecret('API_TOKEN')).toBe('tok_abc');
    restore();
  });

  it('redacts secret-looking keys in log payloads', () => {
    const redacted = redactSecrets({
      toolName: 'refund',
      apiKey: 'sk-live-xxx',
      nested: { password: 'hunter2', orderId: '1' },
    });
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect((redacted.nested as { password: string }).password).toBe('[REDACTED]');
    expect((redacted.nested as { orderId: string }).orderId).toBe('1');
  });
});

describe('refund → approve governance', () => {
  let tmp: string;
  const refundCalls: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    refundCalls.length = 0;
    const root = path.join(__dirname, '..', '..', '.tmp-test');
    fs.mkdirSync(root, { recursive: true });
    tmp = fs.mkdtempSync(path.join(root, 'gov-'));
    process.env.HAZEL_HOME = tmp;
    ensureHazelHome(hazelHome(tmp));
  });

  afterEach(() => {
    delete process.env.HAZEL_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('refund tool waits for approval then completes on approve', async () => {
    let calls = 0;
    const llm: LLMProvider = {
      async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
        calls += 1;
        if (calls === 1) {
          return {
            content: '',
            finishReason: 'tool_calls',
            tool_calls: [
              {
                id: 'c1',
                type: 'function',
                function: {
                  name: 'refund',
                  arguments: JSON.stringify({ amount: 10, orderId: 'o1' }),
                },
              },
            ],
          };
        }
        return { content: 'done', finishReason: 'stop' };
      },
    };

    const server = new HazeldServer({
      home: tmp,
      projectRoot: tmp,
      socketPath: path.join(tmp, 'g.sock'),
      gatekeeperEnabled: false,
      jobTickMs: 60_000,
      reconcileMs: 60_000,
      llmProvider: llm,
      skillHandlers: {
        refund: async (input: Record<string, unknown>) => {
          refundCalls.push(input);
          return { ok: true };
        },
      },
    });
    await server.start();
    try {
      await server.node.apply({
        name: 'support_desk',
        mission: 'Handle refunds',
        skills: [
          { name: 'lookup_order', description: 'Look up an order' },
          { name: 'refund', description: 'Issue a refund', requiresApproval: true },
        ],
      });
      const waitingExec = await server.node.agentOs.runtime.execute(
        'support_desk',
        'refund order o1',
        { maxSteps: 5 }
      );
      expect(waitingExec.state).toBe(AgentState.WAITING_FOR_APPROVAL);
      expect(refundCalls).toHaveLength(0);

      const run = await server.node.store.runs.get(waitingExec.executionId);
      expect(
        [AgentRunStatus.SUSPENDED, AgentRunStatus.WAITING_FOR_HUMAN].includes(run!.status)
      ).toBe(true);

      const approvals = await server.node.listApprovals();
      const id = approvals[0]?.id ?? run!.id;
      const done = await server.node.approve(id, 'cli');
      expect(done.state).toBe(AgentState.COMPLETED);
      expect(refundCalls).toHaveLength(1);
    } finally {
      await server.stop();
    }
  }, 30_000);

  it('tryCreateLocalGatekeeper returns bundle when peer present', async () => {
    const { createDurableRunStore } = await import('../../src');
    const store = createDurableRunStore(path.join(tmp, 'runs'));
    const gk = tryCreateLocalGatekeeper(store.humanTaskService);
    // Peer is a workspace package — expect Healthy path when resolvable.
    if (gk) {
      expect(gk.enabled).toBe(true);
      expect(typeof gk.authorizationGate.execute).toBe('function');
    }
  });
});
