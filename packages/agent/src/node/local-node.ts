/**
 * LocalNode — HazelNode backed by in-process AgentOS.
 */

import * as path from 'path';
import { AgentOS, type AgentOSOptions } from '../os/agent-os';
import type { AgentDna } from '../dna/agent-dna';
import type { DefineAgentInput } from '../os/define-agent';
import type { OfficeAgent } from '../os/types';
import type { AgentRun } from '../run/agent-run.types';
import { AgentRunStatus } from '../run/agent-run.types';
import type { HumanTask, HumanTaskService } from '../run/human-task.service';
import type { ToolAuthorizationGate } from '../authorization/tool-authorization-gate.interface';
import type { AgentExecutionResult } from '../types/agent.types';
import { createAgentOSStore, type AgentOSStore } from './store';
import { hazelHome, ensureHazelHome, projectHazelPaths } from './paths';
import { tryCreateLocalGatekeeper } from './gatekeeper';
import type { DurableJobStore } from './jobs';
import type { SecretStore } from './secrets';
import { createSecretStore } from './secrets';
import { activateSecrets, resolveDnaSecrets } from './secret-resolve';
import { toDisplayStatus, type AgentInspectView, type HazelNode, type NodeStatus } from './types';
import { VERSION } from './version';

export interface LocalNodeOptions extends AgentOSOptions {
  nodeId?: string;
  home?: string;
  /** When true (default), use project .hazel/ for platform + runs. */
  useProjectStore?: boolean;
  gatekeeperEnabled?: boolean;
  /** Soft concurrent run limit (node-level). */
  maxConcurrentRuns?: number;
  /** Shared durable job store (hazeld). When set, sleep wakes persist across restart. */
  jobs?: DurableJobStore;
  /** Secret store (defaults to encrypted file under HAZEL_HOME). */
  secrets?: SecretStore;
}

export class LocalNode implements HazelNode {
  readonly id: string;
  readonly agentOs: AgentOS;
  readonly store: AgentOSStore;
  readonly secrets: SecretStore;
  private readonly startedAt = Date.now();
  private readonly gatekeeperEnabled: boolean;
  private readonly maxConcurrentRuns: number;
  private readonly agentSecrets = new Map<string, Record<string, string>>();
  private gatekeeperBackend: string = 'off';

  constructor(options: LocalNodeOptions = {}) {
    this.id = options.nodeId ?? 'local';
    this.gatekeeperEnabled = options.gatekeeperEnabled !== false;
    this.maxConcurrentRuns = options.maxConcurrentRuns ?? 5;

    const home = ensureHazelHome(hazelHome(options.home));
    const projectRoot = options.projectRoot ?? process.cwd();
    const project = projectHazelPaths(projectRoot);
    const useProject = options.useProjectStore !== false;

    const platformStore =
      options.storePath ?? (useProject ? project.platformStore : home.platformStore);
    const durableDir = options.durableDir ?? (useProject ? project.durableDir : home.runsDir);
    const timelinePath = options.timelinePath ?? path.join(durableDir, 'timeline.jsonl');
    const eventsPath = options.eventsPath ?? home.eventsPath;

    this.store = createAgentOSStore({
      home: home.home,
      projectRoot,
      platformStore,
      durableDir,
      eventsPath,
    });
    this.secrets = options.secrets ?? createSecretStore(home.home);

    const createGate =
      options.createAuthorizationGate ??
      (this.gatekeeperEnabled
        ? (humanTasks: HumanTaskService): ToolAuthorizationGate | undefined => {
            const gk = tryCreateLocalGatekeeper(humanTasks);
            if (gk) this.gatekeeperBackend = gk.approvalBackend;
            return gk?.authorizationGate;
          }
        : undefined);

    this.agentOs = new AgentOS({
      ...options,
      projectRoot,
      storePath: platformStore,
      durableDir,
      timelinePath,
      eventsPath,
      workerId: options.workerId ?? `hazeld-${process.pid}`,
      createAuthorizationGate: createGate,
      authorizationGate: options.authorizationGate,
      durableJobs: options.jobs,
    });
  }

  gatekeeperStatus(): 'Healthy' | 'Off' | 'Missing' {
    if (!this.gatekeeperEnabled) return 'Off';
    return this.gatekeeperBackend === 'off' ? 'Missing' : 'Healthy';
  }

  async status(): Promise<NodeStatus> {
    const agents = await this.agentOs.list();
    const runs = await this.agentOs.listRuns();
    const active = runs.filter(
      (r) =>
        r.status === AgentRunStatus.RUNNING ||
        r.status === AgentRunStatus.QUEUED ||
        r.status === AgentRunStatus.WAITING_FOR_HUMAN ||
        r.status === AgentRunStatus.SUSPENDED
    );
    const waiting = runs.filter((r) => r.status === AgentRunStatus.WAITING_FOR_HUMAN);
    const paths = hazelHome();
    return {
      id: this.id,
      healthy: true,
      uptimeMs: Date.now() - this.startedAt,
      version: VERSION,
      agents: {
        running: agents.filter((a) => a.status === 'idle' || a.status === 'working').length,
        stopped: agents.filter((a) => a.status === 'paused' || a.status === 'terminated').length,
        failed: agents.filter((a) => a.status === 'failed').length,
        sleeping: agents.filter((a) => a.status === 'sleeping').length,
        waiting: agents.filter((a) => a.status === 'waiting' || a.status === 'approval_required')
          .length,
      },
      runs: { active: active.length, waiting: waiting.length },
      storage: { status: 'Healthy', path: this.store.paths.home },
      daemon: {
        status: 'Running',
        pid: process.pid,
        socket: paths.socketPath,
      },
    };
  }

  async register(dna: AgentDna | DefineAgentInput): Promise<OfficeAgent> {
    return this.apply(dna);
  }

  async apply(dna: AgentDna | DefineAgentInput): Promise<OfficeAgent> {
    const agent = await this.agentOs.deploy(dna);
    const resolved = await resolveDnaSecrets(agent.dna, this.secrets);
    this.agentSecrets.set(agent.name, resolved);
    return agent;
  }

  async start(agentId: string, input?: string): Promise<AgentRun | undefined> {
    const runs = await this.agentOs.listRuns();
    const active = runs.filter((r) => r.status === AgentRunStatus.RUNNING).length;
    if (active >= this.maxConcurrentRuns) {
      throw new Error(
        `maxConcurrentRuns (${this.maxConcurrentRuns}) exceeded — stop a run or raise the limit`
      );
    }
    const secrets = this.agentSecrets.get(agentId) ?? {};
    const restore = activateSecrets(secrets);
    try {
      return await this.agentOs.start(agentId, input);
    } finally {
      restore();
    }
  }

  async stop(agentId: string): Promise<OfficeAgent> {
    return this.agentOs.pause(agentId);
  }

  async restart(agentId: string): Promise<OfficeAgent> {
    return this.agentOs.restart(agentId);
  }

  async remove(agentId: string): Promise<void> {
    this.agentSecrets.delete(agentId);
    return this.agentOs.terminate(agentId);
  }

  async inspect(agentId: string): Promise<AgentInspectView> {
    const agent = await this.agentOs.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    const runs = await this.agentOs.listRuns(agentId);
    const successful = runs.filter((r) => r.status === AgentRunStatus.COMPLETED).length;
    const failed = runs.filter((r) => r.status === AgentRunStatus.FAILED).length;
    const waiting = runs.filter(
      (r) => r.status === AgentRunStatus.WAITING_FOR_HUMAN || r.status === AgentRunStatus.SUSPENDED
    ).length;
    const skills = (agent.dna.tools ?? []).map((t) => t.name);
    const display =
      waiting > 0 && (agent.status === 'approval_required' || agent.status === 'waiting')
        ? toDisplayStatus(agent.status)
        : runs.some((r) => r.status === AgentRunStatus.WAITING_FOR_HUMAN)
          ? 'WaitingApproval'
          : runs.some(
                (r) =>
                  r.status === AgentRunStatus.SUSPENDED &&
                  (r.metadata as { pendingToolName?: string } | undefined)?.pendingToolName
              )
            ? 'WaitingApproval'
            : toDisplayStatus(agent.status);
    return {
      agent,
      displayStatus: display,
      pid: process.pid,
      uptimeMs: Date.now() - this.startedAt,
      version: agent.dna.version ?? 'v1',
      runs: {
        total: runs.length,
        successful,
        failed,
        waiting,
      },
      health: {
        runtime: 'Healthy',
        storage: 'Healthy',
        gatekeeper: this.gatekeeperStatus(),
      },
      skills,
      restartPolicy: 'always',
      model: agent.dna.model ?? agent.dna.modelConfig?.model,
    };
  }

  async list(): Promise<OfficeAgent[]> {
    return this.agentOs.list();
  }

  async listApprovals(): Promise<HumanTask[]> {
    return this.agentOs.listApprovals();
  }

  async approve(taskId: string, by = 'cli'): Promise<AgentExecutionResult> {
    return this.agentOs.approve(taskId, by);
  }

  async deny(taskId: string, by = 'cli'): Promise<AgentExecutionResult> {
    return this.agentOs.reject(taskId, by);
  }

  async listRuns(agentId?: string): Promise<AgentRun[]> {
    return this.agentOs.listRuns(agentId);
  }

  async recover(): Promise<{
    reclaimed: number;
    rearmed: number;
    continued: number;
    preservedHitl: number;
  }> {
    const base = await this.agentOs.recover();
    const { continued, preservedHitl } = await continueSuspendedRuns(this);
    // Re-resolve secrets for registered agents (values stay in-daemon).
    for (const agent of await this.list()) {
      this.agentSecrets.set(agent.name, await resolveDnaSecrets(agent.dna, this.secrets));
    }
    return { ...base, continued, preservedHitl };
  }

  async dispose(): Promise<void> {
    await this.agentOs.dispose();
  }
}

/**
 * Conservative continue: HITL waits stay pending; non-HITL SUSPENDED/RUNNING zombies
 * without a durable HITL checkpoint are marked Failed (never silent irreversible retry).
 */
async function continueSuspendedRuns(
  node: LocalNode
): Promise<{ continued: number; preservedHitl: number }> {
  const { isDurableHitlCheckpoint } = await import('../run/durable-hitl.types');
  let continued = 0;
  let preservedHitl = 0;
  const runs = await node.listRuns();
  for (const run of runs) {
    // Waiting for human is already the durable wait state — never fail or re-enter tools.
    if (run.status === AgentRunStatus.WAITING_FOR_HUMAN) {
      preservedHitl += 1;
      continue;
    }
    if (run.status !== AgentRunStatus.SUSPENDED && run.status !== AgentRunStatus.RUNNING) {
      continue;
    }
    const cps = await node.store.checkpoints.list(run.id);
    const hitl = [...cps].reverse().find((c) => isDurableHitlCheckpoint(c.payload));
    if (hitl) {
      preservedHitl += 1;
      continue;
    }
    try {
      await node.store.runs.updateStatus(run.id, AgentRunStatus.FAILED, {
        error: {
          message: 'Recovered after node restart without safe HITL checkpoint (no silent retry)',
          code: 'NODE_RECOVER_NO_CHECKPOINT',
        },
      });
      node.store.events.emit({
        type: 'ResourceReconciled',
        kind: 'AgentRun',
        name: run.agentName,
        ready: false,
        reason: 'NODE_RECOVER_NO_CHECKPOINT',
        message: `Run ${run.id} marked Failed after unsafe restart`,
        attributes: { runId: run.id, code: 'NODE_RECOVER_NO_CHECKPOINT' },
      });
      continued += 1;
    } catch {
      // Transition may be illegal for some statuses — skip.
    }
  }
  return { continued, preservedHitl };
}
