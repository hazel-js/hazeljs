import { Service } from '@hazeljs/core';
import { getPipelineMetadata, getTransformMetadata, getValidateMetadata } from '../decorators';
import { SchemaValidator } from '../validators/schema.validator';
import type { BaseSchema } from '../schema/schema';
import type { RetryConfig, DLQConfig } from '../data.types';
import logger from '@hazeljs/core';

export interface PipelineStep {
  step: number;
  name: string;
  type: 'transform' | 'validate';
  method: string;
  schema?: BaseSchema;
  when?: (data: unknown) => boolean;
  retry?: RetryConfig;
  timeoutMs?: number;
  dlq?: DLQConfig;
}

export interface PipelineExecutionEvent {
  pipeline: string;
  step: number;
  stepName: string;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export type PipelineEventHandler = (event: PipelineExecutionEvent) => void;

/** Runs a promise with a per-call timeout. */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stepName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error(`Step "${stepName}" timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

/** Executes fn with retry + exponential/fixed backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  retry: RetryConfig,
  stepName: string
): Promise<T> {
  const { attempts, delay = 500, backoff = 'fixed' } = retry;
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) {
        const wait = backoff === 'exponential' ? delay * Math.pow(2, attempt - 1) : delay;
        logger.debug(`Step "${stepName}" attempt ${attempt} failed. Retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/**
 * ETL Service — orchestrates pipeline execution.
 *
 * Features:
 * - Sequential step execution (output N → input N+1)
 * - Conditional steps via `when` predicate
 * - Per-step retry with fixed/exponential backoff
 * - Per-step execution timeout
 * - Dead letter queue (DLQ) for graceful failure handling
 * - Pipeline event hooks for observability
 */
@Service()
export class ETLService {
  private eventHandlers: PipelineEventHandler[] = [];

  constructor(private readonly schemaValidator: SchemaValidator) {}

  /** Register a handler called after each step completes or fails. */
  onStepComplete(handler: PipelineEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: PipelineExecutionEvent): void {
    for (const h of this.eventHandlers) {
      try {
        h(event);
      } catch {
        /* noop */
      }
    }
  }

  extractSteps(instance: object): PipelineStep[] {
    const steps: PipelineStep[] = [];
    const proto = Object.getPrototypeOf(instance);

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor?.value && typeof descriptor.value === 'function') {
        const transformMeta = getTransformMetadata(proto, key);
        const validateMeta = getValidateMetadata(proto, key);

        if (transformMeta) {
          steps.push({
            step: transformMeta.step,
            name: transformMeta.name,
            type: 'transform',
            method: key,
            when: transformMeta.when,
            retry: transformMeta.retry,
            timeoutMs: transformMeta.timeoutMs,
            dlq: transformMeta.dlq,
          });
        } else if (validateMeta) {
          steps.push({
            step: validateMeta.step,
            name: validateMeta.name,
            type: 'validate',
            method: key,
            schema: validateMeta.schema as BaseSchema,
            when: validateMeta.when,
            retry: validateMeta.retry,
            timeoutMs: validateMeta.timeoutMs,
            dlq: validateMeta.dlq,
          });
        }
      }
    }

    return steps.sort((a, b) => a.step - b.step);
  }

  async execute<T = unknown>(pipelineInstance: object, input: unknown): Promise<T> {
    const metadata = getPipelineMetadata(pipelineInstance.constructor);
    const steps = this.extractSteps(pipelineInstance);

    if (steps.length === 0) {
      throw new Error(`Pipeline ${metadata?.name ?? 'unknown'} has no steps`);
    }

    logger.debug(`Executing pipeline ${metadata?.name} with ${steps.length} steps`);

    let data: unknown = input;
    const instance = pipelineInstance as Record<string, (d: unknown) => Promise<unknown> | unknown>;

    for (const step of steps) {
      const fn = instance[step.method];
      if (typeof fn !== 'function') {
        throw new Error(`Step ${step.name} method ${step.method} not found`);
      }

      // Conditional skip
      if (step.when && !step.when(data)) {
        logger.debug(`Step "${step.name}" skipped (when predicate returned false)`);
        this.emit({
          pipeline: metadata?.name ?? 'unknown',
          step: step.step,
          stepName: step.name,
          durationMs: 0,
          success: true,
          skipped: true,
        });
        continue;
      }

      const t0 = Date.now();

      const runStep = async (): Promise<unknown> => {
        if (step.type === 'validate' && step.schema) {
          data = this.schemaValidator.validate(step.schema, data);
        }
        const result = fn.call(pipelineInstance, data);
        return result instanceof Promise ? await result : result;
      };

      try {
        let stepPromise = step.retry ? withRetry(runStep, step.retry, step.name) : runStep();

        if (step.timeoutMs) {
          stepPromise = withTimeout(stepPromise, step.timeoutMs, step.name);
        }

        data = await stepPromise;
        this.emit({
          pipeline: metadata?.name ?? 'unknown',
          step: step.step,
          stepName: step.name,
          durationMs: Date.now() - t0,
          success: true,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.emit({
          pipeline: metadata?.name ?? 'unknown',
          step: step.step,
          stepName: step.name,
          durationMs: Date.now() - t0,
          success: false,
          error: error.message,
        });

        if (step.dlq) {
          logger.debug(`Step "${step.name}" failed — routing to DLQ`);
          await Promise.resolve(step.dlq.handler(data, error, step.name));
          // Continue with unchanged data when routed to DLQ
        } else {
          throw error;
        }
      }
    }

    return data as T;
  }

  /**
   * Execute multiple items through the pipeline in parallel.
   * Items that fail are routed to the DLQ if configured, otherwise they propagate.
   */
  async executeBatch<T = unknown>(
    pipelineInstance: object,
    items: unknown[],
    options: { concurrency?: number } = {}
  ): Promise<{ results: T[]; errors: Array<{ item: unknown; error: Error }> }> {
    const { concurrency = 10 } = options;
    const results: T[] = [];
    const errors: Array<{ item: unknown; error: Error }> = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        batch.map((item) => this.execute<T>(pipelineInstance, item))
      );
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        if (s.status === 'fulfilled') {
          results.push(s.value);
        } else {
          errors.push({
            item: batch[j],
            error: s.reason instanceof Error ? s.reason : new Error(String(s.reason)),
          });
        }
      }
    }

    return { results, errors };
  }
}
