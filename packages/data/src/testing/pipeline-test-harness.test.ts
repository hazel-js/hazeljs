import { Pipeline, Transform } from '../decorators';
import { ETLService } from '../pipelines/etl.service';
import { SchemaValidator } from '../validators/schema.validator';
import { PipelineTestHarness } from './pipeline-test-harness';

@Pipeline('TestPipeline')
class TestPipeline {
  @Transform({ step: 1, name: 'double' })
  double(data: { x: number }) {
    return { ...data, x: data.x * 2 };
  }

  @Transform({ step: 2, name: 'add' })
  add(data: { x: number }) {
    return { ...data, x: data.x + 1 };
  }
}

describe('PipelineTestHarness', () => {
  it('runs pipeline and captures events', async () => {
    const schemaValidator = new SchemaValidator();
    const etlService = new ETLService(schemaValidator);
    const pipeline = new TestPipeline();
    const harness = PipelineTestHarness.create(etlService, pipeline);

    const { result, events, durationMs } = await harness.run({ x: 5 });

    expect(result).toEqual({ x: 11 });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.success)).toBe(true);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it('runAndAssertSuccess returns result', async () => {
    const schemaValidator = new SchemaValidator();
    const etlService = new ETLService(schemaValidator);
    const harness = PipelineTestHarness.create(etlService, new TestPipeline());

    const result = await harness.runAndAssertSuccess<{ x: number }>({ x: 1 });
    expect(result.x).toBe(3);
  });

  it('runAndAssertSuccess throws when step fails', async () => {
    @Pipeline('FailingPipeline')
    class FailingPipeline {
      @Transform({ step: 1, name: 'fail' })
      fail() {
        throw new Error('Step failed');
      }
    }
    const schemaValidator = new SchemaValidator();
    const etlService = new ETLService(schemaValidator);
    const harness = PipelineTestHarness.create(etlService, new FailingPipeline());

    await expect(harness.runAndAssertSuccess({})).rejects.toThrow('Step failed');
  });

  it('runAndAssertSuccess throws when step fails with DLQ (events show failure)', async () => {
    @Pipeline('DLQFailingPipeline')
    class DLQFailingPipeline {
      @Transform({
        step: 1,
        name: 'fail',
        dlq: { handler: () => {} },
      })
      fail() {
        throw new Error('DLQ step failed');
      }
    }
    const schemaValidator = new SchemaValidator();
    const etlService = new ETLService(schemaValidator);
    const harness = PipelineTestHarness.create(etlService, new DLQFailingPipeline());

    await expect(harness.runAndAssertSuccess({})).rejects.toThrow('Pipeline steps failed');
  });
});
