import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { DataSource, DataSink } from '../connectors/connector.interface';
import { ETLService } from './etl.service';
import { QualityService, type DataQualityReport } from '../quality/quality.service';
import { TelemetryService } from '../telemetry/telemetry';

export interface PipelineRunnerOptions {
  /** Data source to read from */
  source: DataSource;
  /** Data sink to write transformed records to */
  sink: DataSink;
  /** Decorator pipeline instance (uses ETLService.execute per record) */
  pipeline?: object;
  /** Inline transform when no pipeline is provided */
  transform?: (record: unknown) => unknown | Promise<unknown>;
  /** Optional quality service (falls back to injected one) */
  quality?: QualityService;
  /** Dataset name for quality checks */
  qualityDataset?: string;
  /** Fail the run if quality checks fail (default: false — still writes) */
  failOnQuality?: boolean;
  /** Dead-letter sink for failed records */
  dlqSink?: DataSink;
  /** Pipeline name for telemetry/lineage */
  pipelineName?: string;
  /** Skip writing when transform returns null/undefined (default: false) */
  skipNull?: boolean;
}

export interface PipelineRunnerResult {
  read: number;
  written: number;
  failed: number;
  skipped: number;
  quality?: DataQualityReport;
  errors: Array<{ index: number; error: string }>;
  durationMs: number;
}

/**
 * PipelineRunner — first-class source → transform → quality → sink loop.
 */
@Service()
export class PipelineRunner {
  constructor(
    private readonly etlService?: ETLService,
    private readonly qualityService?: QualityService,
    private readonly telemetry?: TelemetryService
  ) {}

  async run(options: PipelineRunnerOptions): Promise<PipelineRunnerResult> {
    const start = Date.now();
    const name = options.pipelineName ?? 'pipeline-runner';
    const errors: Array<{ index: number; error: string }> = [];
    let read = 0;
    let written = 0;
    let failed = 0;
    let skipped = 0;
    const transformed: unknown[] = [];

    const telemetry = this.telemetry ?? TelemetryService.getInstance();
    const { traceId, rootSpanId } = telemetry.startTrace(name);

    await options.source.open();
    await options.sink.open();
    if (options.dlqSink) await options.dlqSink.open();

    try {
      for await (const record of options.source.read()) {
        read++;
        const index = read - 1;
        try {
          let output: unknown = record;

          if (options.pipeline) {
            if (!this.etlService) {
              throw new Error('ETLService is required when using a pipeline instance');
            }
            output = await this.etlService.execute(options.pipeline, record);
          } else if (options.transform) {
            output = await Promise.resolve(options.transform(record));
          }

          if ((output === null || output === undefined) && options.skipNull) {
            skipped++;
            continue;
          }

          // explode may return an array of rows
          const rows = Array.isArray(output) ? output : [output];
          for (const row of rows) {
            if (row === null || row === undefined) {
              skipped++;
              continue;
            }
            await options.sink.write(row);
            transformed.push(row);
            written++;
          }
        } catch (err) {
          failed++;
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ index, error: message });
          logger.warn(`PipelineRunner record ${index} failed: ${message}`);
          if (options.dlqSink) {
            try {
              await options.dlqSink.write({
                index,
                error: message,
                record,
                timestamp: new Date().toISOString(),
              });
            } catch (dlqErr) {
              logger.error(
                `DLQ write failed: ${dlqErr instanceof Error ? dlqErr.message : String(dlqErr)}`
              );
            }
          }
        }
      }

      let quality: DataQualityReport | undefined;
      const qualitySvc = options.quality ?? this.qualityService;
      if (qualitySvc && options.qualityDataset) {
        quality = await qualitySvc.runChecks(options.qualityDataset, transformed);
        if (options.failOnQuality && !quality.passed) {
          throw new Error(
            `Quality checks failed for dataset "${options.qualityDataset}" (score=${quality.score})`
          );
        }
      }

      const durationMs = Date.now() - start;
      await telemetry.recordMetric('pipeline_runner_records_written', written, {
        pipeline: name,
      });
      await telemetry.recordSpan({
        traceId,
        spanId: rootSpanId,
        pipeline: name,
        step: 0,
        stepName: 'run',
        startTime: start,
        endTime: Date.now(),
        durationMs,
        status: failed > 0 ? 'error' : 'ok',
        error: failed > 0 ? `${failed} records failed` : undefined,
        attributes: { read, written, failed, skipped },
      });

      return {
        read,
        written,
        failed,
        skipped,
        quality,
        errors,
        durationMs,
      };
    } finally {
      await options.source.close().catch(() => undefined);
      await options.sink.close().catch(() => undefined);
      if (options.dlqSink) await options.dlqSink.close().catch(() => undefined);
    }
  }
}
