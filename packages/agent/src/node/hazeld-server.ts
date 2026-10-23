/**
 * hazeld — long-lived Agent OS node process.
 */

import * as fs from 'fs';
import { LocalNode, type LocalNodeOptions } from './local-node';
import { LocalControlApiServer } from './control-api';
import { createSecretStore, type SecretStore } from './secrets';
import { DurableJobStore, nextCronDate } from './jobs';
import { ensureHazelHome, hazelHome } from './paths';
import { ScheduleTriggerHandler } from './triggers';
import { createHostServiceManager } from './host-service';
import type { AgentDna } from '../dna/agent-dna';

export interface HazeldServerOptions extends LocalNodeOptions {
  socketPath?: string;
  installHostService?: boolean;
  /** Absolute path / command used when installing host service. */
  hostServiceCommand?: string;
  /** Interval for reconciling durable jobs (ms). */
  jobTickMs?: number;
  /** Interval for platform reconcileAll (ms). Default 30s. */
  reconcileMs?: number;
}

export class HazeldServer {
  readonly node: LocalNode;
  readonly secrets: SecretStore;
  readonly jobs: DurableJobStore;
  private api?: LocalControlApiServer;
  private jobTimer?: ReturnType<typeof setInterval>;
  private reconcileTimer?: ReturnType<typeof setInterval>;
  private readonly unsubs: Array<() => void> = [];
  private readonly options: HazeldServerOptions;

  constructor(options: HazeldServerOptions = {}) {
    this.options = options;
    const home = ensureHazelHome(hazelHome(options.home));
    this.secrets = options.secrets ?? createSecretStore(home.home);
    this.jobs = options.jobs ?? new DurableJobStore(home.jobsPath);
    this.node = new LocalNode({
      ...options,
      secrets: this.secrets,
      jobs: this.jobs,
    });
  }

  async start(): Promise<{ socketPath: string; pid: number }> {
    const home = hazelHome(this.options.home);
    fs.writeFileSync(home.pidPath, String(process.pid));

    // Recover before accepting control traffic.
    await this.node.recover();
    await this.armSchedulesFromDna();
    await this.armSleepJobsFromOccupancy();

    this.api = new LocalControlApiServer({
      node: this.node,
      secrets: this.secrets,
      socketPath: this.options.socketPath ?? home.socketPath,
      onShutdown: () => this.stop(),
      onApply: async () => {
        await this.armSchedulesFromDna();
      },
    });
    await this.api.listen();

    if (this.options.installHostService && this.options.hostServiceCommand) {
      try {
        const mgr = createHostServiceManager({
          command: this.options.hostServiceCommand,
          home: home.home,
        });
        await mgr.install();
      } catch {
        // Host service install is best-effort at boot.
      }
    }

    const tickMs = this.options.jobTickMs ?? 15_000;
    this.jobTimer = setInterval(() => {
      void this.tickJobs();
    }, tickMs);
    if (typeof this.jobTimer.unref === 'function') this.jobTimer.unref();

    const reconcileMs = this.options.reconcileMs ?? 30_000;
    this.reconcileTimer = setInterval(() => {
      void this.node.agentOs.platform.reconcileAll().catch(() => undefined);
    }, reconcileMs);
    if (typeof this.reconcileTimer.unref === 'function') this.reconcileTimer.unref();

    return { socketPath: this.api.path, pid: process.pid };
  }

  async stop(): Promise<void> {
    if (this.jobTimer) clearInterval(this.jobTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    await this.api?.close();
    await this.node.dispose();
    const home = hazelHome(this.options.home);
    try {
      if (fs.existsSync(home.pidPath)) fs.unlinkSync(home.pidPath);
    } catch {
      // ignore
    }
  }

  private async armSchedulesFromDna(): Promise<void> {
    const handler = new ScheduleTriggerHandler(async (agentId, cron) => {
      const id = `sched:${agentId}`;
      this.jobs.upsert({
        id,
        agentId,
        cron,
        kind: 'schedule',
        runAt: nextCronDate(cron).toISOString(),
        createdAt: new Date().toISOString(),
      });
      return () => this.jobs.remove(id);
    });

    for (const agent of await this.node.list()) {
      const cron = scheduleCronFromDna(agent.dna);
      if (cron) {
        this.unsubs.push(await handler.register(agent.id, { type: 'schedule', cron }));
      }
    }
  }

  /** Re-arm sleep jobs from persisted occupancy (durable across hazeld restart). */
  private async armSleepJobsFromOccupancy(): Promise<void> {
    for (const agent of await this.node.list()) {
      if (agent.occupancy.desiredPhase !== 'sleeping' || !agent.occupancy.nextWakeAt) continue;
      const id = `sleep:${agent.id}`;
      this.jobs.upsert({
        id,
        agentId: agent.id,
        kind: 'sleep',
        runAt: agent.occupancy.nextWakeAt,
        input: agent.dna.mission?.goal ?? 'Wake',
        createdAt: new Date().toISOString(),
      });
    }
  }

  private async tickJobs(): Promise<void> {
    for (const job of this.jobs.due()) {
      try {
        if (job.kind === 'sleep') {
          await this.node.agentOs.wake(job.agentId);
        } else {
          await this.node.start(job.agentId, job.input);
        }
      } catch {
        // keep ticking
      }
      if (job.kind === 'schedule' && job.cron) {
        this.jobs.upsert({
          ...job,
          runAt: nextCronDate(job.cron).toISOString(),
        });
      } else {
        this.jobs.remove(job.id);
      }
    }
  }
}

function scheduleCronFromDna(dna: AgentDna): string | undefined {
  if (!dna.schedule) return undefined;
  if (dna.schedule.cron && dna.schedule.kind !== 'daily' && dna.schedule.kind !== 'hourly') {
    return dna.schedule.cron;
  }
  if (dna.schedule.kind === 'hourly') return dna.schedule.cron ?? '0 */1 * * *';
  if (dna.schedule.kind === 'daily') return dna.schedule.cron ?? '0 9 * * *';
  if (dna.schedule.cron) return dna.schedule.cron;
  return undefined;
}

/** Entry for the hazeld binary. */
export async function runHazeldMain(options: HazeldServerOptions = {}): Promise<void> {
  const server = new HazeldServer(options);
  const { socketPath, pid } = await server.start();
  // eslint-disable-next-line no-console
  console.log(`Hazel Agent OS Node (hazeld)`);
  // eslint-disable-next-line no-console
  console.log(`  pid:    ${pid}`);
  // eslint-disable-next-line no-console
  console.log(`  socket: ${socketPath}`);
  // eslint-disable-next-line no-console
  console.log(`  home:   ${hazelHome(options.home).home}`);

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
