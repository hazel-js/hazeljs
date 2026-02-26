import { Injectable } from '@hazeljs/core';
import { getPipelineMetadata, getTransformMetadata, getValidateMetadata } from '../decorators';
import { SchemaValidator } from '../validators/schema.validator';
import type { BaseSchema } from '../schema/schema';
import logger from '@hazeljs/core';

export interface PipelineStep {
  step: number;
  name: string;
  type: 'transform' | 'validate';
  method: string;
  schema?: BaseSchema;
}

/**
 * ETL Service - Orchestrates pipeline execution
 * Executes steps sequentially: output from step N → input to step N+1
 */
@Injectable()
export class ETLService {
  constructor(private readonly schemaValidator: SchemaValidator) {}

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
          });
        } else if (validateMeta) {
          steps.push({
            step: validateMeta.step,
            name: validateMeta.name,
            type: 'validate',
            method: key,
            schema: validateMeta.schema as BaseSchema,
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

      if (step.type === 'validate' && step.schema) {
        data = this.schemaValidator.validate(step.schema, data);
      }

      const result = fn.call(pipelineInstance, data);
      data = result instanceof Promise ? await result : result;
    }

    return data as T;
  }
}
