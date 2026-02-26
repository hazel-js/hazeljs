import { ETLService } from './etl.service';
import { SchemaValidator } from '../validators/schema.validator';
import { Pipeline, Transform, Validate } from '../decorators';
import { Schema } from '../schema/schema';

@Pipeline('test-pipeline')
class TestPipeline {
  @Transform({ step: 1, name: 'double' })
  double(data: unknown) {
    const n = (data as { x: number }).x;
    return { x: n * 2 };
  }

  @Validate({
    step: 2,
    name: 'validate',
    schema: Schema.object({ x: Schema.number().min(0) }),
  })
  validate(data: unknown) {
    return data;
  }

  @Transform({ step: 3, name: 'add' })
  add(data: unknown) {
    return { ...(data as object), y: 10 };
  }
}

@Pipeline('transform-only')
class TransformOnlyPipeline {
  @Transform({ step: 1, name: 'a' })
  a(data: unknown) {
    return { ...(data as object), a: 1 };
  }
}

@Pipeline('no-steps')
class NoStepsPipeline {}

describe('ETLService', () => {
  let etlService: ETLService;

  beforeEach(() => {
    etlService = new ETLService(new SchemaValidator());
  });

  it('executes pipeline steps sequentially', async () => {
    const pipeline = new TestPipeline();
    const result = await etlService.execute<{ x: number; y: number }>(pipeline, { x: 5 });
    expect(result).toEqual({ x: 10, y: 10 });
  });

  it('extractSteps returns sorted steps', () => {
    const pipeline = new TestPipeline();
    const steps = etlService.extractSteps(pipeline);
    expect(steps).toHaveLength(3);
    expect(steps[0].step).toBe(1);
    expect(steps[1].step).toBe(2);
    expect(steps[2].step).toBe(3);
  });

  it('throws when pipeline has no steps', async () => {
    const pipeline = new NoStepsPipeline();
    await expect(etlService.execute(pipeline, {})).rejects.toThrow('has no steps');
  });

  it('validates data at validate step', async () => {
    const pipeline = new TestPipeline();
    await expect(etlService.execute(pipeline, { x: -1 })).rejects.toThrow();
  });

  it('extractSteps returns only transform/validate steps', () => {
    const pipeline = new TransformOnlyPipeline();
    const steps = etlService.extractSteps(pipeline);
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe('transform');
  });
});
