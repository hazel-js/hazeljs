import 'reflect-metadata';
import { EffectJournal } from '../journal/effect-journal';
import { TransactionCoordinator } from '../transaction/transaction-coordinator';
import { InMemoryQuarantineStore } from '../transaction/quarantine-store';
import { Reversible, getEffectMetadata } from '../effects/effect.decorator';
import { Compensate } from '../effects/compensate.decorator';
import type { EffectRecord } from '../effects/effect-kind';
import type { ToolMetadata } from '@hazeljs/agent';

class SeatAgent {
  released: string[] = [];

  @Reversible({ compensate: 'holdSeat' })
  async holdSeat(_input: { flightId: string }) {
    return { holdId: 'hold-99' };
  }

  @Compensate('holdSeat')
  async releaseHold(effect: EffectRecord<{ holdId: string }>) {
    this.released.push(effect.output.holdId);
  }
}

describe('TransactionCoordinator', () => {
  it('undoes run by compensating journal entries newest-first', async () => {
    const journal = new EffectJournal();
    const agent = new SeatAgent();
    const tool = {
      name: 'holdSeat',
      propertyKey: 'holdSeat',
      target: SeatAgent.prototype,
    } as ToolMetadata;

    await journal.record({
      runId: 'run-1',
      agentId: 'seat-agent',
      tool,
      input: { flightId: 'A' },
      output: { holdId: 'hold-1' },
    });
    await journal.record({
      runId: 'run-1',
      agentId: 'seat-agent',
      tool,
      input: { flightId: 'B' },
      output: { holdId: 'hold-2' },
    });

    const coordinator = new TransactionCoordinator({
      journal,
      quarantine: new InMemoryQuarantineStore(),
      resolveAgentInstance: () => agent,
      resolveTool: () => tool,
    });

    const result = await coordinator.undoRun('run-1');
    expect(result.compensated).toBe(2);
    expect(agent.released).toEqual(['hold-2', 'hold-1']);
  });

  it('quarantines failed compensations', async () => {
    const journal = new EffectJournal();
    const quarantine = new InMemoryQuarantineStore();

    class FailAgent {
      @Reversible({ compensate: 'fail' })
      async fail() {
        return { id: 1 };
      }
    }

    const tool = {
      name: 'fail',
      propertyKey: 'fail',
      target: FailAgent.prototype,
    } as ToolMetadata;

    await journal.record({
      runId: 'run-x',
      agentId: 'fail-agent',
      tool,
      input: {},
      output: { id: 1 },
    });

    const coordinator = new TransactionCoordinator({
      journal,
      quarantine,
      maxRetries: 1,
      resolveAgentInstance: () => new FailAgent(),
      resolveTool: () => tool,
    });

    const result = await coordinator.undoRun('run-x');
    expect(result.failed).toBe(1);
    expect(quarantine.list()).toHaveLength(1);
  });
});
