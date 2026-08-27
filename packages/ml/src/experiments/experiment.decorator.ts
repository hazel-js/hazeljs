/**
 * @Experiment decorator - Auto-track training runs
 */

import 'reflect-metadata';

export const EXPERIMENT_METADATA_KEY = Symbol('hazel:experiment:metadata');

export interface ExperimentOptions {
  name?: string;
  description?: string;
  tags?: string[];
  autoLogParams?: boolean;
  autoLogMetrics?: boolean;
}

export interface ExperimentMetadata {
  name: string;
  description?: string;
  tags?: string[];
  autoLogParams: boolean;
  autoLogMetrics: boolean;
}

/**
 * Mark a class as an ML experiment for auto-tracking.
 * When combined with @Train, training runs are automatically logged.
 *
 * @example
 * ```typescript
 * @Experiment({
 *   name: 'sentiment-classifier',
 *   description: 'Training sentiment classification models',
 *   tags: ['nlp', 'classification']
 * })
 * @Model({ name: 'sentiment', version: '1.0.0', framework: 'custom' })
 * @Injectable()
 * class SentimentClassifier {
 *   @Train()
 *   async train(data: TrainingData) {
 *     // This run will be automatically tracked
 *   }
 * }
 * ```
 */
export function Experiment(options: ExperimentOptions = {}): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return function (target: Function): void {
    const metadata: ExperimentMetadata = {
      name: options.name ?? target.name,
      description: options.description,
      tags: options.tags,
      autoLogParams: options.autoLogParams ?? true,
      autoLogMetrics: options.autoLogMetrics ?? true,
    };

    Reflect.defineMetadata(EXPERIMENT_METADATA_KEY, metadata, target);
  };
}

export function getExperimentMetadata(target: object): ExperimentMetadata | undefined {
  return Reflect.getMetadata(EXPERIMENT_METADATA_KEY, target);
}

export function hasExperimentMetadata(target: object): boolean {
  return Reflect.hasMetadata(EXPERIMENT_METADATA_KEY, target);
}
