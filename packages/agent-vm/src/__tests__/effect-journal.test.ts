import { EffectJournal } from '../journal/effect-journal';
import { InMemoryJournalStore } from '../journal/stores/memory-journal.store';
import { EffectKind } from '../effects/effect-kind';
import { Reversible } from '../effects/effect.decorator';
import type { ToolMetadata } from '@hazeljs/agent';

class HoldAgent {
  @Reversible({ compensate: 'holdSeat' })
  async holdSeat() {
    return { holdId: 'h1' };
  }
}

describe('EffectJournal', () => {
  it('records reversible tool executions', async () => {
    const journal = new EffectJournal(new InMemoryJournalStore());
    const tool = {
      name: 'holdSeat',
      propertyKey: 'holdSeat',
      target: HoldAgent.prototype,
    } as ToolMetadata;

    const entry = await journal.record({
      runId: 'run-1',
      branchId: 'branch-a',
      agentId: 'travel',
      tool,
      input: { flightId: 'AA100' },
      output: { holdId: 'h1' },
      effectKind: EffectKind.REVERSIBLE,
    });

    expect(entry?.toolName).toBe('holdSeat');
    const listed = await journal.listBranch('branch-a');
    expect(listed).toHaveLength(1);
  });

  it('skips non-reversible effects', async () => {
    const journal = new EffectJournal();
    const tool = {
      name: 'search',
      propertyKey: 'search',
      readOnly: true,
      target: HoldAgent.prototype,
    } as ToolMetadata;

    const entry = await journal.record({
      runId: 'run-1',
      agentId: 'travel',
      tool,
      input: {},
      output: [],
      effectKind: EffectKind.READ,
    });

    expect(entry).toBeUndefined();
  });
});
