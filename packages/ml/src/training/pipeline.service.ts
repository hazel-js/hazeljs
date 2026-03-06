import { Service } from '@hazeljs/core';
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
@Service()
export class PipelineService {
  private pipelines: Map<string, PipelineStep[]> = new Map();

  registerPipeline(name: string, steps: PipelineStep[]): void {
    this.pipelines.set(name, steps);
    logger.debug(`Registered pipeline: ${name} with ${steps.length} steps`);
  }

  /**
   * Run a registered pipeline by name.
   */
  async run(name: string, data: TrainingData): Promise<TrainingData>;

  /**
   * Run an ad-hoc pipeline with inline steps (no registration required).
   */
  async run(data: TrainingData, steps: PipelineStep[]): Promise<TrainingData>;

  async run(
    nameOrData: string | TrainingData,
    dataOrSteps: TrainingData | PipelineStep[]
  ): Promise<TrainingData> {
    let data: TrainingData;
    let steps: PipelineStep[];
    let label: string;

    if (typeof nameOrData === 'string') {
      label = nameOrData;
      data = dataOrSteps as TrainingData;
      const registered = this.pipelines.get(nameOrData);
      if (!registered) {
        throw new Error(`Pipeline not found: ${nameOrData}`);
      }
      steps = registered;
    } else {
      label = 'inline';
      data = nameOrData;
      steps = dataOrSteps as PipelineStep[];
    }

    return this.executeSteps(data, steps, label);
  }

  private async executeSteps(
    data: TrainingData,
    steps: PipelineStep[],
    label: string
  ): Promise<TrainingData> {
    let result: unknown = data;
    for (const step of steps) {
      logger.debug(`Pipeline ${label}: executing step ${step.name}`);
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
