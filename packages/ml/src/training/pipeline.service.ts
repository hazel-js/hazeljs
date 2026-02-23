import { Injectable } from '@hazeljs/core';
import { TrainingData } from '../ml.types';
import logger from '@hazeljs/core';

export interface PipelineStep {
  name: string;
  transform: (data: unknown) => Promise<unknown> | unknown;
}

/**
 * Pipeline Service - ETL pipelines for training data preparation
 * Handles data transformation before model training
 */
@Injectable()
export class PipelineService {
  private pipelines: Map<string, PipelineStep[]> = new Map();

  registerPipeline(name: string, steps: PipelineStep[]): void {
    this.pipelines.set(name, steps);
    logger.debug(`Registered pipeline: ${name} with ${steps.length} steps`);
  }

  async run(name: string, data: TrainingData): Promise<TrainingData> {
    const steps = this.pipelines.get(name);
    if (!steps) {
      throw new Error(`Pipeline not found: ${name}`);
    }

    let result: unknown = data;
    for (const step of steps) {
      logger.debug(`Pipeline ${name}: executing step ${step.name}`);
      result = await Promise.resolve(step.transform(result));
    }

    return result as TrainingData;
  }

  getPipeline(name: string): PipelineStep[] | undefined {
    return this.pipelines.get(name);
  }

  listPipelines(): string[] {
    return Array.from(this.pipelines.keys());
  }
}
