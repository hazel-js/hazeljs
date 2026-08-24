/**
 * Travel agent demo — three-branch trip planning with reversible seat holds.
 */

import { Agent, AgentStateManager, Tool, type ToolMetadata } from '@hazeljs/agent';
import { Pure, Read, Reversible, Irreversible } from '../effects/effect.decorator';
import { Compensate } from '../effects/compensate.decorator';
import type { EffectRecord } from '../effects/effect-kind';
import { EffectGate } from '../gate/effect-gate';
import { createAgentVmRuntime } from '../runtime/create-agent-vm-runtime';
import type { SpeculationBranchFn } from '../speculation/speculation-scheduler';

export interface FlightOption {
  flightId: string;
  from: string;
  to: string;
  price: number;
}

export interface HoldRecord {
  holdId: string;
  flightId: string;
}

/** Shared in-memory store for demo — tracks active holds. */
export class TravelHoldStore {
  readonly holds = new Map<string, HoldRecord>();
  readonly released: string[] = [];
  readonly charges: Array<{ amount: number }> = [];

  hold(flightId: string): HoldRecord {
    const holdId = `hold-${this.holds.size + 1}`;
    const record = { holdId, flightId };
    this.holds.set(holdId, record);
    return record;
  }

  release(holdId: string): void {
    this.holds.delete(holdId);
    this.released.push(holdId);
  }
}

const FLIGHTS: FlightOption[] = [
  { flightId: 'AA100', from: 'NYC', to: 'LON', price: 450 },
  { flightId: 'BA200', from: 'NYC', to: 'LON', price: 520 },
  { flightId: 'VS300', from: 'NYC', to: 'LON', price: 480 },
];

const DEMO_FLIGHT_IDS = FLIGHTS.map((f) => f.flightId);

@Agent({ name: 'travel-agent', description: 'Plans trips with reversible holds' })
export class TravelAgent {
  constructor(private readonly store: TravelHoldStore) {}

  @Tool({ name: 'searchFlights', description: 'Search available flights', readOnly: true })
  @Read()
  async searchFlights(input: { from: string; to: string }): Promise<FlightOption[]> {
    return FLIGHTS.filter((f) => f.from === input.from && f.to === input.to);
  }

  @Tool({ name: 'holdSeat', description: 'Hold a seat temporarily' })
  @Reversible({ compensate: 'holdSeat' })
  async holdSeat(input: { flightId: string }): Promise<HoldRecord> {
    return this.store.hold(input.flightId);
  }

  @Compensate('holdSeat')
  async releaseHold(effect: EffectRecord<HoldRecord>): Promise<void> {
    this.store.release(effect.output.holdId);
  }

  @Tool({ name: 'chargeCard', description: 'Charge customer card' })
  @Irreversible()
  async chargeCard(input: { amount: number }): Promise<{ charged: boolean }> {
    this.store.charges.push({ amount: input.amount });
    return { charged: true };
  }

  @Tool({ name: 'scoreOption', description: 'Score a flight option' })
  @Pure()
  async scoreOption(input: { price: number }): Promise<{ score: number }> {
    return { score: 1 - input.price / 1000 };
  }
}

export function createTravelAgent(store = new TravelHoldStore()): TravelAgent {
  return new TravelAgent(store);
}

export interface TravelSpeculationDemoResult {
  runId: string;
  branches: number;
  winnerBranchId: string;
  rolledBackBranches: string[];
  activeHolds: number;
  releasedHolds: number;
  winner: unknown;
}

export interface RunTravelSpeculationDemoOptions {
  branches?: number;
  flightIds?: string[];
  sessionId?: string;
}

/**
 * One-call demo: fork K seat-hold branches, commit the winner, compensate losers.
 */
export async function runTravelSpeculationDemo(
  options: number | RunTravelSpeculationDemoOptions = 3
): Promise<TravelSpeculationDemoResult> {
  const opts: RunTravelSpeculationDemoOptions =
    typeof options === 'number' ? { branches: options } : options;
  const branches = Math.min(8, Math.max(2, opts.branches ?? 3));
  const flightIds = opts.flightIds?.length ? opts.flightIds : DEMO_FLIGHT_IDS;

  const store = new TravelHoldStore();
  const agent = createTravelAgent(store);
  const stateManager = new AgentStateManager();
  const parentCtx = stateManager.createContext(
    'travel-agent',
    opts.sessionId ?? 'travel-speculate',
    'NYC→LON'
  );

  const toolMeta = (key: string): ToolMetadata =>
    ({
      name: key,
      propertyKey: key,
      target: Object.getPrototypeOf(agent) as object,
    }) as ToolMetadata;

  const vm = createAgentVmRuntime({
    stateManager,
    resolveAgentInstance: () => agent,
    resolveTool: (_id, key) => toolMeta(key),
  });

  const runId = EffectGate.newRunId();
  const holdTool = toolMeta('holdSeat');

  const result = await vm.scheduler.speculate(
    runId,
    parentCtx.executionId,
    { branches, scorer: 'heuristic' },
    (async (branchId: string, branchIndex: number) => {
      const flightId = flightIds[branchIndex % flightIds.length];
      const hold = await agent.holdSeat({ flightId });
      await vm.journal.record({
        runId,
        branchId,
        agentId: 'travel-agent',
        tool: holdTool,
        input: { flightId },
        output: hold,
      });
      return { holdId: hold.holdId, flightId };
    }) as SpeculationBranchFn,
    { agentId: 'travel-agent' }
  );

  return {
    runId,
    branches,
    winnerBranchId: result.winnerBranchId,
    rolledBackBranches: result.rolledBackBranches,
    activeHolds: store.holds.size,
    releasedHolds: store.released.length,
    winner: result.winnerOutput,
  };
}
