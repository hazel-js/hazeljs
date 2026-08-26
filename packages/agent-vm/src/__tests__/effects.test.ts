import 'reflect-metadata';
import { EffectKind } from '../effects/effect-kind';
import { inferEffectKind } from '../effects/infer';
import { Pure, Reversible, getEffectMetadata } from '../effects/effect.decorator';
import { Compensate, findCompensateMethod } from '../effects/compensate.decorator';
import type { ToolMetadata } from '@hazeljs/agent';

class DemoAgent {
  @Pure()
  async compute() {
    return 1;
  }

  @Reversible({ compensate: 'compute' })
  async reserve() {
    return { id: 'r1' };
  }

  @Compensate('compute')
  async undoCompute() {
    /* noop */
  }
}

describe('effect decorators', () => {
  it('stores effect metadata on methods', () => {
    const meta = getEffectMetadata(DemoAgent.prototype, 'compute');
    expect(meta?.kind).toBe(EffectKind.PURE);
  });

  it('infers read from readOnly tool flag', () => {
    const tool = {
      name: 'lookup',
      propertyKey: 'lookup',
      readOnly: true,
      target: DemoAgent.prototype,
    } as ToolMetadata;
    expect(inferEffectKind(tool)).toBe(EffectKind.READ);
  });

  it('defaults to irreversible when no decorator', () => {
    const tool = {
      name: 'pay',
      propertyKey: 'pay',
      target: DemoAgent.prototype,
    } as ToolMetadata;
    expect(inferEffectKind(tool)).toBe(EffectKind.IRREVERSIBLE);
  });

  it('finds compensate handler by tool name', () => {
    const agent = new DemoAgent();
    const handler = findCompensateMethod(agent, 'compute');
    expect(handler?.propertyKey).toBe('undoCompute');
  });
});
