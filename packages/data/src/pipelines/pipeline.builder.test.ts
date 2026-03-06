import { PipelineBuilder } from './pipeline.builder';

describe('PipelineBuilder', () => {
  let builder: PipelineBuilder;

  beforeEach(() => {
    builder = new PipelineBuilder();
  });

  it('adds transform and executes', async () => {
    const pipeline = builder
      .addTransform('step1', (d: unknown) => Object.assign({}, d, { a: 1 }))
      .addTransform('step2', (d: unknown) => Object.assign({}, d, { b: 2 }));

    const result = await pipeline.execute<{ x: number; a: number; b: number }>({ x: 0 });
    expect(result).toEqual({ x: 0, a: 1, b: 2 });
  });

  it('handles async transforms', async () => {
    const pipeline = builder.addTransform('async', async (d: unknown) =>
      Object.assign({}, d, { done: true })
    );
    const result = await pipeline.execute<{ done: boolean }>({});
    expect(result.done).toBe(true);
  });

  it('setName sets pipeline name', () => {
    const built = builder.setName('my-pipeline').build();
    expect(built.name).toBe('my-pipeline');
  });

  it('build returns config', () => {
    const config = builder
      .addTransform('s1', (d: unknown) => d)
      .addValidate('s2', (d: unknown) => d)
      .build();
    expect(config.steps).toHaveLength(2);
    expect(config.name).toBe('unnamed-pipeline');
  });

  it('reset clears steps', async () => {
    const withStep = builder.addTransform('s1', (d) => d);
    const cleared = withStep.reset();
    const config = cleared.build();
    expect(config.steps).toHaveLength(0);
  });

  it('is immutable — original is unmodified after chaining', () => {
    builder.addTransform('step1', (d) => d);
    expect(builder.steps).toHaveLength(0); // original unchanged
  });

  it('branch runs left path when condition is true', async () => {
    const pipeline = builder.branch(
      'classify',
      (d) => (d as { type: string }).type === 'a',
      (b) => b.addTransform('enrichA', (d) => Object.assign({}, d, { enriched: 'A' })),
      (b) => b.addTransform('enrichB', (d) => Object.assign({}, d, { enriched: 'B' }))
    );

    const resultA = await pipeline.execute<{ type: string; enriched: string }>({ type: 'a' });
    expect(resultA.enriched).toBe('A');

    const resultB = await pipeline.execute<{ type: string; enriched: string }>({ type: 'b' });
    expect(resultB.enriched).toBe('B');
  });

  it('parallel runs transforms concurrently and merges results', async () => {
    const pipeline = builder.parallel('enrich', [
      (d) => Object.assign({}, d, { a: 1 }),
      (d) => Object.assign({}, d, { b: 2 }),
    ]);
    const result = await pipeline.execute<{ a: number; b: number }>({});
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  it('catch handles step errors', async () => {
    const pipeline = builder
      .addTransform('fail', () => {
        throw new Error('step failed');
      })
      .catch((_data, _err) => ({ recovered: true }));

    const result = await pipeline.execute<{ recovered: boolean }>({});
    expect(result.recovered).toBe(true);
  });

  it('toSchema returns serializable definition', () => {
    const schema = builder
      .addTransform('step1', (d) => d)
      .addValidate('step2', (d) => d)
      .toSchema();
    expect(schema.name).toBe('unnamed-pipeline');
    expect(schema.steps).toHaveLength(2);
    expect(schema.steps[0].name).toBe('step1');
  });

  it('retry retries failed steps', async () => {
    let attempts = 0;
    const pipeline = builder.addTransform(
      'flaky',
      () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
        return { ok: true };
      },
      { retry: { attempts: 3, delay: 0 } }
    );
    const result = await pipeline.execute<{ ok: boolean }>({});
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it('addTransform with when option skips when false', async () => {
    const pipeline = builder.addTransform('cond', (d) => Object.assign({}, d, { ran: true }), {
      when: (d) => (d as { run?: boolean }).run === true,
    });
    const result = await pipeline.execute<{ run?: boolean; ran?: boolean }>({ run: false });
    expect(result.ran).toBeUndefined();
    const result2 = await pipeline.execute<{ run?: boolean; ran?: boolean }>({ run: true });
    expect(result2.ran).toBe(true);
  });

  it('addValidate with when option', async () => {
    const pipeline = builder.addValidate('v', (d) => d, { when: (d) => (d as { ok: boolean }).ok });
    const result = await pipeline.execute({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('PipelineBuilder.create returns new instance', () => {
    const b = PipelineBuilder.create('test');
    expect(b.name).toBe('test');
    expect(b.steps).toHaveLength(0);
  });

  it('conditional step is skipped when predicate returns false', async () => {
    let ran = false;
    const pipeline = builder.addTransform(
      'conditional',
      (d) => {
        ran = true;
        return d;
      },
      { when: () => false }
    );
    await pipeline.execute({});
    expect(ran).toBe(false);
  });

  it('parallel returns array when results are not all objects', async () => {
    const pipeline = builder.parallel('mixed', [() => 1, () => 2]);
    const result = await pipeline.execute<number[]>({});
    expect(result).toEqual([1, 2]);
  });

  it('parallel returns array when some results are null', async () => {
    const pipeline = builder.parallel('withNull', [
      (d) => Object.assign({}, d, { a: 1 }),
      () => null,
    ]);
    const result = await pipeline.execute<unknown[]>({});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('branch without elseBuilder uses identity for right path', async () => {
    const pipeline = builder.branch(
      'cond',
      (d) => (d as { flag: boolean }).flag,
      (b) => b.addTransform('left', (d) => Object.assign({}, d, { side: 'left' }))
    );
    const left = await pipeline.execute<{ flag: boolean; side: string }>({ flag: true });
    expect(left.side).toBe('left');
    const right = await pipeline.execute<{ flag: boolean }>({ flag: false });
    expect(right).toEqual({ flag: false });
  });

  it('catch on empty steps returns this', () => {
    const result = builder.catch(() => ({}));
    expect(result).toBe(builder);
    expect(result.steps).toHaveLength(0);
  });

  it('timeoutMs rejects when step exceeds timeout', async () => {
    const pipeline = builder.addTransform(
      'slow',
      () => new Promise((r) => setTimeout(() => r({}), 200)),
      { timeoutMs: 10 }
    );
    await expect(pipeline.execute({})).rejects.toThrow('timed out');
  });

  it('dlq handler is called on step failure', async () => {
    const dlqItems: unknown[] = [];
    const pipeline = builder.addTransform(
      'fail',
      () => {
        throw new Error('fail');
      },
      {
        dlq: {
          handler: (data, err, step) => {
            dlqItems.push({ data, err: err.message, step });
          },
        },
      }
    );
    const result = await pipeline.execute({});
    expect(result).toEqual({});
    expect(dlqItems).toHaveLength(1);
    expect(dlqItems[0]).toMatchObject({ step: 'fail', err: 'fail' });
  });

  it('validate step runs when no transform', async () => {
    const pipeline = builder.addValidate('v', (d) => d);
    const result = await pipeline.execute({ x: 1 });
    expect(result).toEqual({ x: 1 });
  });

  it('step with no transform or validate returns data', async () => {
    const pipeline = builder.addTransform('id', (d) => d);
    const result = await pipeline.execute({ a: 1 });
    expect(result).toEqual({ a: 1 });
  });

  it('retry with exponential backoff', async () => {
    let attempts = 0;
    const pipeline = builder.addTransform(
      'flaky',
      () => {
        attempts++;
        if (attempts < 2) throw new Error('retry');
        return { ok: true };
      },
      { retry: { attempts: 2, delay: 1, backoff: 'exponential' } }
    );
    const result = await pipeline.execute<{ ok: boolean }>({});
    expect(result.ok).toBe(true);
    expect(attempts).toBe(2);
  });
});
