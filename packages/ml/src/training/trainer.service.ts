import { Service } from '@hazeljs/core';
import { ModelRegistry } from '../registry/model.registry';
import { PipelineService } from './pipeline.service';
import { ExperimentService } from '../experiments/experiment.service';
import { getModelMetadata, getTrainMetadata } from '../decorators';
import { getExperimentMetadata } from '../experiments/experiment.decorator';
import { TrainingData, TrainingResult } from '../ml.types';
import logger from '@hazeljs/core';

/**
 * Trainer Service - Training orchestration for ML models.
 * Honors @Train({ pipeline }) and @Experiment auto-logging when those services are available.
 */
@Service()
export class TrainerService {
  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly pipelineService?: PipelineService,
    private readonly experimentService?: ExperimentService
  ) {}

  async train(modelName: string, data: TrainingData, version?: string): Promise<TrainingResult> {
    const model = this.modelRegistry.get(modelName, version);
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }

    const trainMethod = model.trainMethod;
    if (!trainMethod) {
      throw new Error(`Model ${modelName} has no training method`);
    }

    const instance = model.instance as Record<
      string,
      (data: TrainingData) => Promise<TrainingResult>
    >;
    const trainFn = instance[trainMethod];
    if (typeof trainFn !== 'function') {
      throw new Error(`Training method ${trainMethod} not found on model`);
    }

    const trainMeta = getTrainMetadata(Object.getPrototypeOf(model.instance), trainMethod);
    let trainingData = data;

    // Run named preprocessing pipeline when @Train({ pipeline }) is set
    if (trainMeta?.pipeline && this.pipelineService) {
      const pipe = this.pipelineService.getPipeline(trainMeta.pipeline);
      if (pipe) {
        logger.debug(`Running train pipeline "${trainMeta.pipeline}" for ${modelName}`);
        trainingData = (await this.pipelineService.run(trainMeta.pipeline, data)) as TrainingData;
      }
    }

    const experimentMeta = getExperimentMetadata(model.instance.constructor);
    let runId: string | undefined;
    if (experimentMeta && this.experimentService) {
      let experiment = this.experimentService
        .listExperiments()
        .find((e) => e.name === experimentMeta.name);
      if (!experiment) {
        experiment = this.experimentService.createExperiment(experimentMeta.name, {
          description: experimentMeta.description,
          tags: experimentMeta.tags,
        });
      }
      const run = this.experimentService.startRun(experiment.id, {
        name: `${modelName}@${model.metadata.version}`,
        params: {
          modelName,
          version: model.metadata.version,
          pipeline: trainMeta?.pipeline,
          batchSize: trainMeta?.batchSize,
          epochs: trainMeta?.epochs,
        },
        tags: experimentMeta.tags,
      });
      runId = run.id;
      if (experimentMeta.autoLogParams && trainMeta) {
        this.experimentService.logMetrics(run.id, {
          batchSize: trainMeta.batchSize ?? 0,
          epochs: trainMeta.epochs ?? 0,
        });
      }
    }

    logger.debug(`Starting training for model: ${modelName}`);
    try {
      const result = await trainFn.call(instance, trainingData);
      logger.debug(`Training completed for model: ${modelName}`, result);

      if (runId && this.experimentService && experimentMeta?.autoLogMetrics) {
        const metrics: Record<string, number> = {};
        if (typeof result.accuracy === 'number') metrics.accuracy = result.accuracy;
        if (typeof result.loss === 'number') metrics.loss = result.loss;
        if (result.metrics) Object.assign(metrics, result.metrics);
        this.experimentService.logMetrics(runId, metrics);
        this.experimentService.endRun(runId, 'completed');
      }

      // Persist artifact path hint when modelPath returned
      if (result.modelPath && result.metrics) {
        try {
          const versions = this.modelRegistry.getVersions(modelName);
          const entry = versions.find((v) => v.version === (version ?? model.metadata.version));
          if (entry) {
            entry.path = result.modelPath;
            entry.metrics = result.metrics;
          }
        } catch {
          /* ignore */
        }
      }

      return result;
    } catch (err) {
      if (runId && this.experimentService) {
        this.experimentService.endRun(runId, 'failed');
      }
      throw err;
    }
  }

  discoverTrainMethod(instance: object): string | undefined {
    const metadata = getModelMetadata(instance.constructor);
    if (!metadata) return undefined;

    const proto = Object.getPrototypeOf(instance);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor?.value && typeof descriptor.value === 'function') {
        if (getTrainMetadata(proto, key)) {
          return key;
        }
      }
    }
    return undefined;
  }
}
