/**
 * Optional bridge: validate + profile training data with @hazeljs/data when available.
 * Falls back to a no-op pass-through when @hazeljs/data is not installed.
 */

import type { TrainingData } from '../ml.types';

export interface PrepareTrainingDataOptions {
  /** Dataset name for quality reports */
  dataset?: string;
  /** Require quality checks to pass (throws if failed) */
  failOnQuality?: boolean;
  /** Minimum quality score 0–100 */
  minScore?: number;
  /**
   * Optional Schema-like validator from @hazeljs/data:
   * { validate(value) => { success, data } | { success: false, errors } }
   */
  schema?: {
    validate: (
      value: unknown
    ) =>
      | { success: true; data: unknown }
      | { success: false; errors: Array<{ path: string; message: string }> };
  };
  /**
   * Optional QualityService-like instance from @hazeljs/data.
   * If omitted, we try dynamic require of @hazeljs/data.
   */
  qualityService?: {
    runChecks: (
      dataset: string,
      data: unknown
    ) => Promise<{ passed: boolean; score: number; checks: unknown[] }>;
    profile?: (dataset: string, records: Record<string, unknown>[]) => unknown;
  };
}

export interface PreparedTrainingData {
  data: TrainingData;
  quality?: { passed: boolean; score: number; checks: unknown[] };
  profile?: unknown;
  validatedSamples?: unknown[];
}

function tryLoadDataQuality(): PrepareTrainingDataOptions['qualityService'] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('@hazeljs/data') as {
      QualityService: new () => PrepareTrainingDataOptions['qualityService'] & object;
    };
    return new data.QualityService();
  } catch {
    return undefined;
  }
}

/**
 * Prepare training data: optional Schema validation + QualityService profiling.
 *
 * @example
 * import { Schema, QualityService } from '@hazeljs/data';
 * import { prepareTrainingData, TrainerService } from '@hazeljs/ml';
 *
 * const prepared = await prepareTrainingData(
 *   { samples },
 *   { schema: SampleSchema, qualityService: new QualityService(), failOnQuality: true }
 * );
 * await trainer.train('text-naive-bayes', prepared.data);
 */
export async function prepareTrainingData(
  data: TrainingData,
  options: PrepareTrainingDataOptions = {}
): Promise<PreparedTrainingData> {
  const samples = (data.samples ?? data.data) as unknown;
  const rows = Array.isArray(samples) ? samples : samples != null ? [samples] : [];

  let validatedSamples = rows;
  if (options.schema) {
    const out: unknown[] = [];
    for (const row of rows) {
      const result = options.schema.validate(row);
      if (!result.success) {
        const msg = result.errors.map((e) => e.message).join('; ');
        throw new Error(`Training data schema validation failed: ${msg}`);
      }
      out.push(result.data);
    }
    validatedSamples = out;
  }

  const qualityService = options.qualityService ?? tryLoadDataQuality();
  let quality: PreparedTrainingData['quality'];
  let profile: unknown;

  if (qualityService && validatedSamples.length > 0) {
    const dataset = options.dataset ?? 'training';
    quality = await qualityService.runChecks(dataset, validatedSamples);
    if (options.failOnQuality && !quality.passed) {
      throw new Error(`Training data quality checks failed (score=${quality.score})`);
    }
    if (options.minScore !== undefined && quality.score < options.minScore) {
      throw new Error(
        `Training data quality score ${quality.score} below minScore ${options.minScore}`
      );
    }
    if (qualityService.profile) {
      profile = qualityService.profile(dataset, validatedSamples as Record<string, unknown>[]);
    }
  }

  const prepared: TrainingData = {
    ...data,
    samples: validatedSamples,
  };

  return { data: prepared, quality, profile, validatedSamples };
}
