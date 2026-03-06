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
});
