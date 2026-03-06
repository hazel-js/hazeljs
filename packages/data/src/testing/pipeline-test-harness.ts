import type { ETLService } from '../pipelines/etl.service';
import type { PipelineExecutionEvent } from '../pipelines/etl.service';

export interface StepSnapshot {
  step: number;
  stepName: string;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface PipelineRunResult<T = unknown> {
  result: T;
  events: StepSnapshot[];
  durationMs: number;
}

/**
 * Test harness for pipeline execution.
 * Wraps a pipeline, runs it, and captures per-step execution events.
 *
 * @example
 * const harness = PipelineTestHarness.create(etlService, myPipeline);
 * const { result, events } = await harness.run({ raw: 'data' });
 * expect(events.every(e => e.success)).toBe(true);
 */
export class PipelineTestHarness {
  private events: StepSnapshot[] = [];

  constructor(
    private readonly etlService: ETLService,
    private readonly pipelineInstance: object
  ) {
    this.etlService.onStepComplete((e: PipelineExecutionEvent) => {
      this.events.push({
        step: e.step,
        stepName: e.stepName,
        durationMs: e.durationMs,
        success: e.success,
        skipped: e.skipped,
        error: e.error,
      });
    });
  }

  /**
   * Run the pipeline with the given input.
   */
  async run<T = unknown>(input: unknown): Promise<PipelineRunResult<T>> {
    this.events = [];
    const t0 = Date.now();
    const result = await this.etlService.execute<T>(this.pipelineInstance, input);
    const durationMs = Date.now() - t0;
    return { result, events: [...this.events], durationMs };
  }

  /**
   * Run the pipeline and assert no step failed.
   * Throws if any step failed.
   */
  async runAndAssertSuccess<T = unknown>(input: unknown): Promise<T> {
    const { result, events } = await this.run<T>(input);
    const failed = events.filter((e) => !e.success && !e.skipped);
    if (failed.length > 0) {
      throw new Error(
        `Pipeline steps failed: ${failed.map((e) => `${e.stepName}: ${e.error}`).join('; ')}`
      );
    }
    return result;
  }

  static create(etlService: ETLService, pipelineInstance: object): PipelineTestHarness {
    return new PipelineTestHarness(etlService, pipelineInstance);
  }
}
