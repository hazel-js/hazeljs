import { HazelAI } from '../../hazel-ai';
import { HCELBuilder } from '../hcel.builder';
import { HCELEngine } from '../hcel.engine';
import { HCELError, HCELErrorCode } from '../hcel.error';
import { createMemoryHCELResultCache } from '../hcel.cache';
import type { HCELChain } from '../hcel.types';
import { PromptOperation } from '../hcel.operations';

describe('HCEL production behavior', () => {
  let ai: HazelAI;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    ai = new HazelAI();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries retriable operations when retryPolicy is set', async () => {
    let calls = 0;
    const flakyOp = {
      id: 'flaky',
      type: 'mock',
      config: {},
      metadata: { name: 'mock', retriable: true },
      async execute(): Promise<string> {
        calls++;
        if (calls < 2) {
          throw new Error('transient');
        }
        return 'ok';
      },
    };

    const engine = new HCELEngine();
    const chain: HCELChain = {
      id: 'c1',
      operations: [flakyOp as never],
      config: {
        retryPolicy: {
          maxAttempts: 3,
          initialDelay: 100,
          maxDelay: 500,
          backoffMultiplier: 2,
        },
      },
    };

    const run = engine.execute(chain, undefined);
    await jest.advanceTimersByTimeAsync(150);
    const result = await run;
    expect(result.output).toBe('ok');
    expect(calls).toBe(2);
  });

  it('throws STREAMING_NOT_SUPPORTED when last op is not prompt', async () => {
    const engine = new HCELEngine();
    const chain: HCELChain = {
      id: 'c2',
      operations: [
        {
          id: 'm1',
          type: 'ml',
          config: {},
          metadata: { name: 'ml', retriable: false },
          async execute(): Promise<string> {
            return 'x';
          },
        } as never,
      ],
      config: {},
    };

    const gen = engine.stream(chain, 'in');
    await expect(gen.next()).rejects.toMatchObject({
      code: HCELErrorCode.STREAMING_NOT_SUPPORTED,
    });
  });

  it('ifElse builds a single conditional root', () => {
    const thenB = ai.hazel.prompt('then');
    const elseB = ai.hazel.prompt('else');
    const chain = ai.hazel.ifElse(() => true, thenB, elseB);
    const summary = chain.getSummary();
    expect(summary.operationCount).toBe(1);
    expect(summary.operations[0]).toContain('conditional');
  });

  it('parallel accepts trailing strategy option', () => {
    const b1 = new HCELBuilder(ai).prompt('a');
    const b2 = new HCELBuilder(ai).prompt('b');
    const root = new HCELBuilder(ai);
    root.parallel(b1, b2, { strategy: 'race' });
    const op = root.getOperations()[0];
    expect(op.type).toBe('parallel');
    expect((op.config as Record<string, unknown>).strategy).toBe('race');
  });

  it('execute uses result cache when caching is enabled', async () => {
    const cache = createMemoryHCELResultCache('test-hcel');
    const op = new PromptOperation(ai, { template: 'hi' });
    const engine = new HCELEngine(cache);
    const chain: HCELChain = {
      id: 'c3',
      operations: [op],
      config: {
        caching: { enabled: true, ttl: 60, store: cache },
      },
    };

    let calls = 0;
    jest.spyOn(ai, 'chat').mockImplementation(async () => {
      calls++;
      return 'once';
    });

    await engine.execute(chain, 'x');
    await engine.execute(chain, 'x');
    expect(calls).toBe(1);
  });

  it('restore returns persisted result without re-running LLM', async () => {
    const cache = createMemoryHCELResultCache('test-hcel-restore');
    const op = new PromptOperation(ai, { template: 'hi' });
    const engine = new HCELEngine(cache);
    const chain: HCELChain = {
      id: 'c4',
      operations: [op],
      config: {
        persistence: { key: 'k1', enabled: true, ttlMs: 60_000 },
        caching: { enabled: false, ttl: 0, store: cache },
      },
    };

    let calls = 0;
    jest.spyOn(ai, 'chat').mockImplementation(async () => {
      calls++;
      return 'saved';
    });

    await engine.execute(chain, 'x');

    const restoreChain: HCELChain = {
      ...chain,
      config: {
        ...chain.config,
        persistence: { restoreKey: 'k1' },
      },
    };

    const r2 = await engine.execute(restoreChain, 'x');
    expect(r2.output).toBe('saved');
    expect(calls).toBe(1);
  });

  it('adaptive flag surfaces metadata on engine result', async () => {
    jest.spyOn(ai, 'chat').mockResolvedValue('ok');
    const engine = new HCELEngine();
    const op = new PromptOperation(ai, { template: 'x' });
    const chain: HCELChain = {
      id: 'ad',
      operations: [op],
      config: { adaptive: true },
    };
    const r = await engine.execute(chain, 'in');
    expect(r.output).toBe('ok');
    expect(r.metadata.adaptiveRequested).toBe(true);
    expect(r.metadata.adaptiveChoices?.length).toBeGreaterThan(0);
  });
});

describe('HCELError', () => {
  it('exposes code and operation context', () => {
    const err = HCELError.validationFailed('prompt', 'op1', 'chain1');
    expect(err).toBeInstanceOf(HCELError);
    expect(err.code).toBe(HCELErrorCode.VALIDATION_FAILED);
    expect(err.operationId).toBe('op1');
    expect(err.chainId).toBe('chain1');
  });
});
