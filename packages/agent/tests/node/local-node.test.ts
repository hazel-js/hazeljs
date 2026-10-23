/**
 * LocalNode + control API + hosted LocalDeploymentBackend.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LocalNode,
  LocalControlApiServer,
  controlRequest,
  isDaemonReachable,
  HazeldServer,
  LocalDeploymentBackend,
  createSecretStore,
  DurableJobStore,
  nextCronDate,
  toDisplayStatus,
  hazelHome,
  ensureHazelHome,
} from '../../src';

describe('Local-first Agent OS node', () => {
  let tmp: string;

  beforeEach(() => {
    // Keep under package dir so unix sockets work in sandboxed CI.
    const root = path.join(__dirname, '..', '..', '.tmp-test');
    fs.mkdirSync(root, { recursive: true });
    tmp = fs.mkdtempSync(path.join(root, 'hazel-node-'));
    process.env.HAZEL_HOME = tmp;
    ensureHazelHome(hazelHome(tmp));
  });

  afterEach(() => {
    delete process.env.HAZEL_HOME;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('LocalDeploymentBackend hosted message registers DNA path', async () => {
    const backend = new LocalDeploymentBackend();
    let registered = 0;
    backend.setHosted({
      onApply: async () => {
        registered += 1;
      },
    });
    expect(backend.isHosted()).toBe(true);
    const status = await backend.apply({
      deployment: {
        apiVersion: 'agent.hazeljs.dev/v1alpha1',
        kind: 'AgentDeployment',
        metadata: { name: 'demo' },
        spec: {
          definitionRef: { kind: 'AgentDefinition', name: 'demo' },
          runtimeClassName: 'local',
        },
      },
      definition: {
        definition: {
          apiVersion: 'agent.hazeljs.dev/v1alpha1',
          kind: 'AgentDefinition',
          metadata: { name: 'demo' },
          spec: {},
        },
        dna: {
          format: 'hazeljs.agent.dna',
          version: '1.0.0',
          name: 'demo',
          tools: [],
          exportedAt: new Date().toISOString(),
        },
        source: 'nested',
      },
      runtimeClassName: 'local',
    });
    expect(status.ready).toBe(true);
    expect(status.message).toContain('AgentOS');
    expect(registered).toBe(1);
  });

  it('toDisplayStatus maps office statuses', () => {
    expect(toDisplayStatus('idle')).toBe('Running');
    expect(toDisplayStatus('approval_required')).toBe('WaitingApproval');
    expect(toDisplayStatus('paused')).toBe('Stopped');
  });

  it('LocalNode apply + inspect shows Running', async () => {
    const node = new LocalNode({
      home: tmp,
      projectRoot: tmp,
      useProjectStore: true,
      gatekeeperEnabled: false,
    });
    try {
      const agent = await node.apply({
        name: 'echo_bot',
        mission: 'You echo.',
        skills: [{ name: 'ping', description: 'ping' }],
      });
      expect(agent.name).toBe('echo_bot');
      const view = await node.inspect('echo_bot');
      expect(view.displayStatus).toBe('Running');
      const list = await node.list();
      expect(list.some((a) => a.name === 'echo_bot')).toBe(true);
    } finally {
      await node.dispose();
    }
  });

  it('control API ping / apply / inspect over unix socket', async () => {
    const socketPath = path.join(tmp, 'test.sock');
    const node = new LocalNode({
      home: tmp,
      projectRoot: tmp,
      gatekeeperEnabled: false,
    });
    const secrets = createSecretStore(tmp);
    const server = new LocalControlApiServer({ node, secrets, socketPath });
    await server.listen();
    try {
      expect(await isDaemonReachable(socketPath)).toBe(true);
      const applied = await controlRequest(
        {
          op: 'apply',
          dna: {
            name: 'sock_agent',
            mission: 'hi',
            skills: [],
          },
        },
        socketPath
      );
      expect(applied.ok).toBe(true);
      const inspected = await controlRequest({ op: 'inspect', agentId: 'sock_agent' }, socketPath);
      expect(inspected.ok).toBe(true);
      const data = inspected.data as { displayStatus: string };
      expect(data.displayStatus).toBe('Running');

      await controlRequest({ op: 'secret.set', name: 'API_KEY', value: 's3cret' }, socketPath);
      const has = await controlRequest({ op: 'secret.has', name: 'API_KEY' }, socketPath);
      expect((has.data as { has: boolean }).has).toBe(true);
      expect(await secrets.get('API_KEY')).toBe('s3cret');
    } finally {
      await server.close();
      await node.dispose();
    }
  });

  it('HazeldServer start recovers and serves status', async () => {
    const socketPath = path.join(tmp, 'hazeld.sock');
    const server = new HazeldServer({
      home: tmp,
      projectRoot: tmp,
      socketPath,
      gatekeeperEnabled: false,
      jobTickMs: 60_000,
    });
    const { pid } = await server.start();
    expect(pid).toBe(process.pid);
    try {
      const status = await controlRequest({ op: 'status' }, socketPath);
      expect(status.ok).toBe(true);
      expect((status.data as { healthy: boolean }).healthy).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it('DurableJobStore + nextCronDate persist', () => {
    const jobs = new DurableJobStore(path.join(tmp, 'state', 'jobs.json'));
    jobs.upsert({
      id: 'j1',
      agentId: 'a',
      kind: 'schedule',
      cron: '0 */1 * * *',
      runAt: new Date(0).toISOString(),
      createdAt: new Date().toISOString(),
    });
    expect(jobs.due().length).toBe(1);
    const next = nextCronDate('0 9 * * *', new Date('2026-01-01T10:00:00Z'));
    expect(next.getHours()).toBe(9);
  });

  it('stop/remove unregisters agent', async () => {
    const node = new LocalNode({
      home: tmp,
      projectRoot: tmp,
      gatekeeperEnabled: false,
    });
    try {
      await node.apply({ name: 'tmp_agent', mission: 'x', skills: [] });
      await node.stop('tmp_agent');
      const stopped = await node.inspect('tmp_agent');
      expect(stopped.displayStatus).toBe('Stopped');
      await node.remove('tmp_agent');
      await expect(node.inspect('tmp_agent')).rejects.toThrow(/not found/i);
    } finally {
      await node.dispose();
    }
  });
});
