import { EffectGate } from '../gate/effect-gate';
import { EffectJournal } from '../journal/effect-journal';
import { Reversible } from '../effects/effect.decorator';
import { Compensate } from '../effects/compensate.decorator';
import type { EffectRecord } from '../effects/effect-kind';
import type { ToolMetadata } from '@hazeljs/agent';

class GateAgent {
  journal: Array<{ holdId: string }> = [];

  @Reversible({ compensate: 'reserve' })
  async reserve(input: { id: string }) {
    const hold = { holdId: `h-${input.id}` };
    this.journal.push(hold);
    return hold;
  }

  @Compensate('reserve')
  async undoReserve(effect: EffectRecord<{ holdId: string }>) {
    this.journal = this.journal.filter((h) => h.holdId !== effect.output.holdId);
  }

  target = this;
  propertyKey = 'reserve';
}

describe('ToolExecutor + EffectGate integration', () => {
  it('journals reversible tool via effect gate hook', async () => {
    const agent = new GateAgent();
    const journal = new EffectJournal();
    const gate = new EffectGate({
      journal,
      getExecutionContext: () => ({
        runId: 'run-1',
        agentId: 'gate-agent',
        speculative: false,
      }),
    });

    const tool: ToolMetadata = {
      name: 'reserve',
      description: 'reserve',
      propertyKey: 'reserve',
      target: agent,
      method: agent.reserve.bind(agent),
    };

    await gate.afterToolExecute({
      executionId: 'exec-1',
      runId: 'run-1',
      agentId: 'gate-agent',
      tool,
      input: { id: 'x' },
      output: { holdId: 'h-x' },
    });

    const entries = await journal.listRun('run-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].output).toEqual({ holdId: 'h-x' });
  });
});
