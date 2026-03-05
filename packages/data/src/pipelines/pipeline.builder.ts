import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { RetryConfig, DLQConfig } from '../data.types';

type TransformFn = (data: unknown) => unknown | Promise<unknown>;
type ValidateFn = (data: unknown) => unknown;
type CatchFn = (data: unknown, error: Error) => unknown | Promise<unknown>;
type ConditionFn = (data: unknown) => boolean;

export interface PipelineStepConfig {
  name: string;
  transform?: TransformFn;
  validate?: ValidateFn;
  catch?: CatchFn;
  when?: ConditionFn;
  retry?: RetryConfig;
  timeoutMs?: number;
  dlq?: DLQConfig;
  /** Parallel transforms — all run concurrently, results merged */
  parallel?: TransformFn[];
  /** Branch on a condition: truthy → left builder, falsy → right builder */
  branch?: {
    condition: ConditionFn;
    left: PipelineBuilder;
    right: PipelineBuilder;
  };
}

export interface PipelineDefinition {
  name: string;
  steps: PipelineStepConfig[];
}

async function runWithRetry(
  fn: () => Promise<unknown>,
  retry: RetryConfig,
  stepName: string
): Promise<unknown> {
  const { attempts, delay = 500, backoff = 'fixed' } = retry;
  let lastError: Error = new Error('Unknown');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn(); } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) {
        const wait = backoff === 'exponential' ? delay * Math.pow(2, attempt - 1) : delay;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

async function runWithTimeout(
  fn: () => Promise<unknown>,
  ms: number,
  stepName: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${ms}ms`)), ms);
    fn().then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

/**
 * PipelineBuilder — immutable, fluent DSL for building ETL pipelines programmatically.
 *
 * Each builder method returns a **new** instance — the original is never mutated.
 *
 * @example
 * const pipeline = new PipelineBuilder()
 *   .setName('orders')
 *   .addTransform('normalize', (d) => ({ ...d, email: d.email.toLowerCase() }))
 *   .when((d) => d.active, (b) => b.addTransform('enrich', enrich))
 *   .addValidate('validate', validateFn);
 *
 * const result = await pipeline.execute(rawData);
 */
@Service()
export class PipelineBuilder {
  private readonly _name: string;
  private readonly _steps: ReadonlyArray<PipelineStepConfig>;

  constructor(name = 'unnamed-pipeline', steps: PipelineStepConfig[] = []) {
    this._name = name;
    this._steps = steps;
  }

  // ─── Identity ──────────────────────────────────────────────────────────────

  setName(name: string): PipelineBuilder {
    return new PipelineBuilder(name, [...this._steps]);
  }

  // ─── Steps ─────────────────────────────────────────────────────────────────

  addTransform(
    name: string,
    transform: TransformFn,
    options: { when?: ConditionFn; retry?: RetryConfig; timeoutMs?: number; dlq?: DLQConfig } = {}
  ): PipelineBuilder {
    return new PipelineBuilder(this._name, [
      ...this._steps,
      { name, transform, ...options },
    ]);
  }

  addValidate(name: string, validate: ValidateFn, options: { when?: ConditionFn } = {}): PipelineBuilder {
    return new PipelineBuilder(this._name, [
      ...this._steps,
      { name, validate, ...options },
    ]);
  }

  /**
   * Run multiple transforms concurrently. Results are merged (Object.assign) into
   * the current data if they are objects, otherwise replaced with an array of results.
   */
  parallel(name: string, transforms: TransformFn[]): PipelineBuilder {
    return new PipelineBuilder(this._name, [
      ...this._steps,
      { name, parallel: transforms },
    ]);
  }

  /**
   * Conditional branch: if `condition(data)` is true, run `thenBuilder` steps,
   * otherwise run `elseBuilder` steps (default: identity).
   */
  branch(
    name: string,
    condition: ConditionFn,
    thenBuilder: (b: PipelineBuilder) => PipelineBuilder,
    elseBuilder?: (b: PipelineBuilder) => PipelineBuilder
  ): PipelineBuilder {
    const left = thenBuilder(new PipelineBuilder());
    const right = elseBuilder ? elseBuilder(new PipelineBuilder()) : new PipelineBuilder();
    return new PipelineBuilder(this._name, [
      ...this._steps,
      { name, branch: { condition, left, right } },
    ]);
  }

  /**
   * Attach a per-step error handler. If the previous step throws, `handler` is
   * called with `(data, error)` and its return value becomes the new data.
   */
  catch(handler: CatchFn): PipelineBuilder {
    if (this._steps.length === 0) return this;
    const steps = [...this._steps];
    const last = { ...steps[steps.length - 1], catch: handler };
    steps[steps.length - 1] = last;
    return new PipelineBuilder(this._name, steps);
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  async execute<T = unknown>(input: unknown): Promise<T> {
    let data: unknown = input;

    for (let i = 0; i < this._steps.length; i++) {
      const step = this._steps[i];
      logger.debug(`Pipeline "${this._name}": step ${i + 1} — ${step.name}`);

      // Conditional skip
      if (step.when && !step.when(data)) {
        logger.debug(`Step "${step.name}" skipped`);
        continue;
      }

      const runStep = async (): Promise<unknown> => {
        if (step.branch) {
          const { condition, left, right } = step.branch;
          return condition(data) ? left.execute(data) : right.execute(data);
        }

        if (step.parallel && step.parallel.length > 0) {
          const results = await Promise.all(step.parallel.map((fn) => {
            const r = fn(data);
            return r instanceof Promise ? r : Promise.resolve(r);
          }));
          if (results.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
            return Object.assign({}, data, ...results);
          }
          return results;
        }

        if (step.transform) {
          const r = step.transform(data);
          return r instanceof Promise ? await r : r;
        }

        if (step.validate) {
          return step.validate(data);
        }

        return data;
      };

      try {
        let promise: Promise<unknown>;

        if (step.retry) {
          promise = runWithRetry(runStep, step.retry, step.name) as Promise<unknown>;
        } else {
          promise = runStep();
        }

        if (step.timeoutMs) {
          promise = runWithTimeout(() => promise, step.timeoutMs, step.name) as Promise<unknown>;
        }

        data = await promise;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (step.dlq) {
          await Promise.resolve(step.dlq.handler(data, error, step.name));
        } else if (step.catch) {
          data = await Promise.resolve(step.catch(data, error));
        } else {
          throw error;
        }
      }
    }

    return data as T;
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  /** Serialize the pipeline definition to a plain object (steps with functions are omitted). */
  toSchema(): PipelineDefinition {
    return {
      name: this._name,
      steps: this._steps.map((s) => ({
        name: s.name,
        ...(s.when ? { conditional: true } : {}),
        ...(s.parallel ? { parallel: true, count: s.parallel.length } : {}),
        ...(s.branch ? { branch: true } : {}),
        ...(s.retry ? { retry: s.retry } : {}),
        ...(s.timeoutMs ? { timeoutMs: s.timeoutMs } : {}),
      })),
    };
  }

  build(): PipelineDefinition {
    return this.toSchema();
  }

  /** Create a fresh pipeline from a definition (transforms must be re-registered). */
  static create(name?: string): PipelineBuilder {
    return new PipelineBuilder(name);
  }

  /**
   * @deprecated Use `new PipelineBuilder()` directly. Kept for backward compat.
   * Note: this instance is now immutable — reset() returns a new empty builder.
   */
  reset(): PipelineBuilder {
    return new PipelineBuilder(this._name);
  }

  get name(): string { return this._name; }
  get steps(): ReadonlyArray<PipelineStepConfig> { return this._steps; }
}
