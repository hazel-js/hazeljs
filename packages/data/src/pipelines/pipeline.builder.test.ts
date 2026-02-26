import { PipelineBuilder } from './pipeline.builder';

describe('PipelineBuilder', () => {
  let builder: PipelineBuilder;

  beforeEach(() => {
    builder = new PipelineBuilder();
  });

  it('adds transform and executes', async () => {
    builder.addTransform('step1', (d: unknown) => Object.assign({}, d, { a: 1 }));
    builder.addTransform('step2', (d: unknown) => Object.assign({}, d, { b: 2 }));

    const result = await builder.execute<{ x: number; a: number; b: number }>({ x: 0 });
    expect(result).toEqual({ x: 0, a: 1, b: 2 });
  });

  it('handles async transforms', async () => {
    builder.addTransform('async', async (d: unknown) => Object.assign({}, d, { done: true }));
    const result = await builder.execute<{ done: boolean }>({});
    expect(result.done).toBe(true);
  });

  it('setName sets pipeline name', () => {
    builder.setName('my-pipeline');
    const built = builder.build();
    expect(built.name).toBe('my-pipeline');
  });

  it('build returns config', () => {
    builder.addTransform('s1', (d: unknown) => d).addValidate('s2', (d: unknown) => d);
    const config = builder.build();
    expect(config.steps).toHaveLength(2);
    expect(config.name).toBe('unnamed-pipeline');
  });

  it('reset clears steps', async () => {
    builder.addTransform('s1', (d) => d);
    builder.reset();
    const config = builder.build();
    expect(config.steps).toHaveLength(0);
  });
});
