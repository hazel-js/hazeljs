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

  it('throws when step method not found on instance', async () => {
    const pipeline = new TestPipeline();
    (pipeline as unknown as Record<string, unknown>).double = null;
    await expect(etlService.execute(pipeline, { x: 5 })).rejects.toThrow('not found');
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

  it('onStepComplete emits events for each step', async () => {
    const events: Array<{ step: number; stepName: string; success: boolean }> = [];
    etlService.onStepComplete((e) =>
      events.push({ step: e.step, stepName: e.stepName, success: e.success })
    );
    const pipeline = new TestPipeline();
    await etlService.execute(pipeline, { x: 5 });
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.success)).toBe(true);
    expect(events.map((e) => e.stepName)).toEqual(['double', 'validate', 'add']);
  });

  it('executeBatch returns results and errors', async () => {
    const pipeline = new TestPipeline();
    const { results, errors } = await etlService.executeBatch<{ x: number; y: number }>(
      pipeline,
      [{ x: 1 }, { x: -1 }, { x: 2 }],
      { concurrency: 2 }
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ x: 2, y: 10 });
    expect(results[1]).toEqual({ x: 4, y: 10 });
    expect(errors).toHaveLength(1);
    expect(errors[0].item).toEqual({ x: -1 });
  });

  it('executeBatch wraps non-Error rejections', async () => {
    @Pipeline('throw-string')
    class ThrowStringPipeline {
      @Transform({ step: 1, name: 'fail' })
      fail() {
        throw 'string rejection';
      }
    }
    const { errors } = await etlService.executeBatch(new ThrowStringPipeline(), [{}]);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBeInstanceOf(Error);
    expect(errors[0].error.message).toContain('string rejection');
  });
});

@Pipeline('conditional-pipeline')
class ConditionalPipeline {
  @Transform({ step: 1, name: 'always' })
  always(data: unknown) {
    return { ...(data as object), step: 1 };
  }

  @Transform({
    step: 2,
    name: 'when-true',
    when: (d: unknown) => (d as { skip?: boolean }).skip !== true,
  })
  whenStep(data: unknown) {
    return { ...(data as object), step: 2 };
  }
}

describe('ETLService conditional steps', () => {
  let etlService: ETLService;

  beforeEach(() => {
    etlService = new ETLService(new SchemaValidator());
  });

  it('skips step when when predicate returns false', async () => {
    const pipeline = new ConditionalPipeline();
    const events: Array<{ stepName: string; skipped?: boolean }> = [];
    etlService.onStepComplete((e) => events.push({ stepName: e.stepName, skipped: e.skipped }));
    const result = await etlService.execute<{ step: number; skip?: boolean }>(pipeline, {
      skip: true,
    });
    expect(result.step).toBe(1);
    expect(events.find((e) => e.stepName === 'when-true')?.skipped).toBe(true);
  });

  it('runs step when when predicate returns true', async () => {
    const pipeline = new ConditionalPipeline();
    const result = await etlService.execute<{ step: number }>(pipeline, {});
    expect(result.step).toBe(2);
  });
});

@Pipeline('retry-pipeline')
class RetryPipeline {
  attempts = 0;
  @Transform({ step: 1, name: 'retry', retry: { attempts: 3, delay: 10, backoff: 'exponential' } })
  retryStep(data: unknown) {
    this.attempts++;
    if (this.attempts < 2) throw new Error('Fail');
    return { ...(data as object), ok: true };
  }
}

const dlqCaptured: Array<{ item: unknown; error: string }> = [];

@Pipeline('dlq-pipeline')
class DLQPipeline {
  @Transform({
    step: 1,
    name: 'fail',
    dlq: {
      handler: (item, err) => {
        dlqCaptured.push({ item, error: err.message });
      },
    },
  })
  failStep(data: unknown) {
    if ((data as { skip?: boolean }).skip) return data;
    throw new Error('DLQ test error');
  }
}

describe('ETLService retry and DLQ', () => {
  let etlService: ETLService;

  beforeEach(() => {
    etlService = new ETLService(new SchemaValidator());
    dlqCaptured.length = 0;
  });

  it('retries step on failure', async () => {
    const pipeline = new RetryPipeline();
    const result = await etlService.execute<{ ok: boolean }>(pipeline, {});
    expect(result.ok).toBe(true);
    expect(pipeline.attempts).toBe(2);
  });

  it('dlq receives failed item and pipeline continues with unchanged data', async () => {
    const pipeline = new DLQPipeline();
    const result = await etlService.execute<{ x: number }>(pipeline, { x: 1 });
    expect(dlqCaptured).toHaveLength(1);
    expect(dlqCaptured[0].error).toBe('DLQ test error');
    expect(result).toEqual({ x: 1 });
  });
});

@Pipeline('timeout-pipeline')
class TimeoutPipeline {
  @Transform({ step: 1, name: 'slow', timeoutMs: 50 })
  async slowStep() {
    await new Promise((r) => setTimeout(r, 200));
    return { done: true };
  }
}

@Pipeline('retry-fixed')
class RetryFixedPipeline {
  attempts = 0;
  @Transform({ step: 1, name: 'retry', retry: { attempts: 3, delay: 5, backoff: 'fixed' } })
  retryStep() {
    this.attempts++;
    if (this.attempts < 2) throw new Error('Fail');
    return { ok: true };
  }
}

describe('ETLService timeout and retry fixed', () => {
  let etlService: ETLService;

  beforeEach(() => {
    etlService = new ETLService(new SchemaValidator());
  });

  it('times out when step exceeds timeoutMs', async () => {
    const pipeline = new TimeoutPipeline();
    await expect(etlService.execute(pipeline, {})).rejects.toThrow('timed out');
  });

  it('retries with fixed backoff', async () => {
    const pipeline = new RetryFixedPipeline();
    const result = await etlService.execute<{ ok: boolean }>(pipeline, {});
    expect(result.ok).toBe(true);
    expect(pipeline.attempts).toBe(2);
  });

  it('emit catches handler errors', async () => {
    const pipeline = new TestPipeline();
    etlService.onStepComplete(() => {
      throw new Error('Handler error');
    });
    const result = await etlService.execute<{ x: number; y: number }>(pipeline, { x: 5 });
    expect(result).toEqual({ x: 10, y: 10 });
  });
});
