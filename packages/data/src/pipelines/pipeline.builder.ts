import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';

export interface PipelineStepConfig {
  name: string;
  transform?: (data: unknown) => unknown | Promise<unknown>;
  validate?: (data: unknown) => unknown;
}

/**
 * Pipeline Builder - DSL for building pipelines programmatically
 */
@Injectable()
export class PipelineBuilder {
  private steps: PipelineStepConfig[] = [];
  private name = 'unnamed-pipeline';

  setName(name: string): this {
    this.name = name;
    return this;
  }

  addTransform(name: string, transform: (data: unknown) => unknown | Promise<unknown>): this {
    this.steps.push({ name, transform });
    return this;
  }

  addValidate(name: string, validate: (data: unknown) => unknown): this {
    this.steps.push({ name, validate });
    return this;
  }

  async execute<T = unknown>(input: unknown): Promise<T> {
    let data: unknown = input;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      logger.debug(`Pipeline ${this.name}: step ${i + 1} - ${step.name}`);

      if (step.transform) {
        const result = step.transform(data);
        data = result instanceof Promise ? await result : result;
      } else if (step.validate) {
        data = step.validate(data);
      }
    }

    return data as T;
  }

  build(): { name: string; steps: PipelineStepConfig[] } {
    return { name: this.name, steps: [...this.steps] };
  }

  reset(): this {
    this.steps = [];
    this.name = 'unnamed-pipeline';
    return this;
  }
}
