/**
 * App-facing OrganismHost — thin facade over OrganismRuntime for product services.
 *
 * Prefer this when embedding @hazeljs/organism in an ops / platform service
 * instead of reinventing start/observe/inspect/simulate lifecycle wrappers.
 */

import {
  createOrganism,
  type CreateOrganismOptions,
  type SimulateOptions,
} from '../core/organism-runtime';
import type { OrganismRuntime } from '../core/organism-runtime';
import type {
  AgentOutcomeReport,
  EnvironmentSignal,
  OrganismDecision,
  OrganismInspectState,
} from '../types/organism.types';

export interface OrganismHost {
  readonly id: string;
  /** Underlying runtime for advanced use (genealogy, market, events). */
  readonly runtime: OrganismRuntime;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  observe(
    signal: Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>
  ): Promise<OrganismDecision | undefined>;
  inspect(): Promise<OrganismInspectState>;
  reportOutcome(agentId: string, report: AgentOutcomeReport): Promise<void>;
  emergencyStop(reason?: string): Promise<void>;
  terminate(reason?: string): Promise<void>;
  simulate(options: SimulateOptions): Promise<OrganismInspectState>;
  listAgents(): Promise<Awaited<ReturnType<OrganismRuntime['listAgents']>>>;
}

class OrganismHostImpl implements OrganismHost {
  constructor(public readonly runtime: OrganismRuntime) {}

  get id(): string {
    return this.runtime.id;
  }

  start(): Promise<void> {
    return this.runtime.start();
  }

  pause(): Promise<void> {
    return this.runtime.pause();
  }

  resume(): Promise<void> {
    return this.runtime.resume();
  }

  observe(
    signal: Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>
  ): Promise<OrganismDecision | undefined> {
    return this.runtime.observe(signal);
  }

  inspect(): Promise<OrganismInspectState> {
    return this.runtime.inspect();
  }

  reportOutcome(agentId: string, report: AgentOutcomeReport): Promise<void> {
    return this.runtime.reportOutcome(agentId, report);
  }

  async emergencyStop(reason?: string): Promise<void> {
    void reason;
    await this.runtime.emergencyStop();
  }

  async terminate(reason?: string): Promise<void> {
    void reason;
    await this.runtime.terminate();
  }

  simulate(options: SimulateOptions): Promise<OrganismInspectState> {
    return this.runtime.simulate(options);
  }

  listAgents(): Promise<Awaited<ReturnType<OrganismRuntime['listAgents']>>> {
    return this.runtime.listAgents();
  }
}

/**
 * Create an OrganismHost from the same options as createOrganism.
 * This is the recommended entry point for external products (e.g. Zynli ops).
 */
export async function createOrganismHost(options: CreateOrganismOptions): Promise<OrganismHost> {
  const runtime = await createOrganism(options);
  return new OrganismHostImpl(runtime);
}

/** Wrap an existing OrganismRuntime as OrganismHost. */
export function wrapOrganismRuntime(runtime: OrganismRuntime): OrganismHost {
  return new OrganismHostImpl(runtime);
}
