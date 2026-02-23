import { HazelModule, Injectable, Inject } from '@hazeljs/core';
import { SchemaValidator } from './validators/schema.validator';
import { ETLService } from './pipelines/etl.service';
import { PipelineBuilder } from './pipelines/pipeline.builder';
import { StreamService } from './pipelines/stream.service';
import { StreamBuilder } from './streaming/stream.builder';
import { StreamProcessor } from './streaming/stream.processor';
import { TransformerService } from './transformers/transformer.service';
import { QualityService } from './quality/quality.service';
import { FlinkService } from './flink.service';
import type { FlinkClientConfig } from './streaming/flink/flink.client';

export const DATA_FLINK_CONFIG = Symbol('hazel:data:flink-config');

export interface DataModuleOptions {
  flink?: FlinkClientConfig;
}

@Injectable()
class DataFlinkBootstrap {
  constructor(
    private readonly flinkService: FlinkService,
    @Inject(DATA_FLINK_CONFIG) private readonly config: FlinkClientConfig | null
  ) {
    if (this.config) {
      this.flinkService.configure(this.config);
    }
  }
}

@HazelModule({
  providers: [
    SchemaValidator,
    ETLService,
    PipelineBuilder,
    StreamService,
    StreamBuilder,
    StreamProcessor,
    TransformerService,
    QualityService,
    FlinkService,
  ],
  exports: [
    SchemaValidator,
    ETLService,
    PipelineBuilder,
    StreamService,
    StreamBuilder,
    StreamProcessor,
    TransformerService,
    QualityService,
    FlinkService,
  ],
})
export class DataModule {
  private static options: DataModuleOptions = {};

  /**
   * Configure DataModule with optional Flink connection
   *
   * @example
   * ```typescript
   * imports: [
   *   DataModule.forRoot({
   *     flink: {
   *       url: process.env.FLINK_REST_URL || 'http://localhost:8081',
   *       timeout: 30000,
   *     },
   *   }),
   * ]
   * ```
   */
  static forRoot(options: DataModuleOptions = {}): {
    module: typeof DataModule;
    providers: unknown[];
    exports: unknown[];
  } {
    DataModule.options = options;

    const providers: unknown[] = [
      SchemaValidator,
      ETLService,
      PipelineBuilder,
      StreamService,
      StreamBuilder,
      StreamProcessor,
      TransformerService,
      QualityService,
      FlinkService,
      { provide: DATA_FLINK_CONFIG, useValue: options.flink ?? null },
      DataFlinkBootstrap,
    ];

    return {
      module: DataModule,
      providers,
      exports: [
        SchemaValidator,
        ETLService,
        PipelineBuilder,
        StreamService,
        StreamBuilder,
        StreamProcessor,
        TransformerService,
        QualityService,
        FlinkService,
      ],
    };
  }

  static getOptions(): DataModuleOptions {
    return DataModule.options;
  }
}
