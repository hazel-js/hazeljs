import { ETLService } from '../pipelines/etl.service';
import { getStreamMetadata } from '../decorators';
import type { FlinkJobConfig } from '../data.types';
import type { PipelineStep } from '../pipelines/etl.service';
import { createFlinkJobGraph } from './flink/flink.operators';

export interface StreamPipelineConfig {
  source: string;
  sink: string;
  parallelism?: number;
  steps: PipelineStep[];
}

/**
 * Stream Builder - Builds Flink job config from @Stream decorated pipeline
 */
export class StreamBuilder {
  constructor(private readonly etlService: ETLService) {}

  buildConfig(
    pipelineInstance: object,
    overrideConfig?: Partial<FlinkJobConfig>
  ): {
    jobConfig: FlinkJobConfig;
    jobGraph: ReturnType<typeof createFlinkJobGraph>;
  } {
    const metadata = getStreamMetadata(pipelineInstance.constructor);
    if (!metadata) {
      throw new Error('Pipeline must be decorated with @Stream');
    }

    const steps = this.etlService.extractSteps(pipelineInstance);

    const sourceTopic = metadata.source.replace('kafka://', '');
    const sinkTopic = metadata.sink.replace('kafka://', '');

    const jobConfig: FlinkJobConfig = {
      jobName: pipelineInstance.constructor.name,
      parallelism: metadata.parallelism ?? 4,
      checkpointInterval: 60000,
      restartStrategy: {
        type: 'fixed-delay',
        attempts: 3,
        delay: 10000,
      },
      ...overrideConfig,
    };

    const jobGraph = createFlinkJobGraph(
      steps,
      {
        type: 'kafka',
        topic: sourceTopic,
        properties: {
          'bootstrap.servers': process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:9092',
          'group.id': `hazeljs-${metadata.name}`,
          'auto.offset.reset': 'latest',
        },
      },
      {
        type: 'kafka',
        topic: sinkTopic,
        properties: {
          'bootstrap.servers': process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:9092',
        },
      }
    );

    return { jobConfig, jobGraph };
  }
}
