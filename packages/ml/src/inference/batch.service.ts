import { Service } from '@hazeljs/core';
import { PredictorService } from './predictor.service';
import { PredictionResult } from '../ml.types';
import logger from '@hazeljs/core';

export interface BatchPredictionOptions {
  batchSize?: number;
  concurrency?: number;
}

/**
 * Batch Service - Batch processing for inference
 * Handles bulk prediction requests efficiently
 */
@Service()
export class BatchService {
  constructor(private readonly predictorService: PredictorService) {}

  async predictBatch<T = unknown>(
    modelName: string,
    inputs: unknown[],
    options: BatchPredictionOptions = {},
    version?: string
  ): Promise<PredictionResult<T>[]> {
    const { batchSize = 32, concurrency = 4 } = options;

    logger.debug(`Batch prediction: ${inputs.length} inputs, batchSize=${batchSize}`);

    const results = new Array<PredictionResult<T>>(inputs.length);
    const batches: { input: unknown; idx: number }[][] = [];

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize).map((input, j) => ({ input, idx: i + j }));
      batches.push(batch);
    }

    for (let i = 0; i < batches.length; i += concurrency) {
      const batchGroup = batches.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batchGroup.flatMap((batch) =>
          batch.map(({ input, idx }) =>
            this.predictorService
              .predict<T>(modelName, input, version)
              .then((r) => ({ idx, r }) as const)
          )
        )
      );
      for (const { idx, r } of batchResults) {
        results[idx] = r;
      }
    }

    return results;
  }
}
