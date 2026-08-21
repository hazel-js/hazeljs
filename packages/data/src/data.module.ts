import { HazelModule, Injectable, Inject } from '@hazeljs/core';
import { SchemaValidator } from './validators/schema.validator';
import { ETLService } from './pipelines/etl.service';
import { PipelineBuilder } from './pipelines/pipeline.builder';
import { PipelineRunner } from './pipelines/pipeline.runner';
import { StreamService } from './pipelines/stream.service';
import { StreamBuilder } from './streaming/stream.builder';
import { StreamProcessor } from './streaming/stream.processor';
import { TransformerService } from './transformers/transformer.service';
import { QualityService } from './quality/quality.service';
import { FlinkService } from './flink.service';
import { ContractRegistry } from './contracts/contract-registry';
import { TelemetryService } from './telemetry/telemetry';
import type { FlinkClientConfig } from './streaming/flink/flink.client';

export const DATA_FLINK_CONFIG = Symbol('hazel:data:flink-config');
export const DATA_TELEMETRY_CONFIG = Symbol('hazel:data:telemetry-config');

export interface DataTelemetryOptions {
  enabled?: boolean;
  serviceName?: string;
  lineage?: boolean;
}

export interface DataModuleOptions {
  flink?: FlinkClientConfig;
  telemetry?: DataTelemetryOptions;
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

@Injectable()
class DataTelemetryBootstrap {
  constructor(
    private readonly telemetry: TelemetryService,
    @Inject(DATA_TELEMETRY_CONFIG) private readonly config: DataTelemetryOptions | null
  ) {
    if (config?.enabled !== false && config?.lineage) {
      this.telemetry.enableLineage();
    }
  }
}

@HazelModule({
  providers: [
    SchemaValidator,
    ETLService,
    PipelineBuilder,
    PipelineRunner,
    StreamService,
    StreamBuilder,
    StreamProcessor,
    TransformerService,
    QualityService,
    FlinkService,
    ContractRegistry,
    TelemetryService,
  ],
  exports: [
    SchemaValidator,
    ETLService,
    PipelineBuilder,
    PipelineRunner,
    StreamService,
    StreamBuilder,
    StreamProcessor,
    TransformerService,
    QualityService,
    FlinkService,
    ContractRegistry,
    TelemetryService,
  ],
})
export class DataModule {
  private static options: DataModuleOptions = {};

  /**
   * Configure DataModule with optional Flink and telemetry
   *
   * @example
   * ```typescript
   * imports: [
   *   DataModule.forRoot({
   *     flink: {
   *       url: process.env.FLINK_REST_URL || 'http://localhost:8081',
   *       timeout: 30000,
   *     },
   *     telemetry: { enabled: true, serviceName: 'orders', lineage: true },
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

    const telemetryOpts = options.telemetry ?? { enabled: true };
    const telemetryInstance = TelemetryService.getInstance({
      serviceName: telemetryOpts.serviceName,
    });
    if (telemetryOpts.lineage) {
      telemetryInstance.enableLineage();
    }

    const providers: unknown[] = [
      SchemaValidator,
      ETLService,
      PipelineBuilder,
      PipelineRunner,
      StreamService,
      StreamBuilder,
      StreamProcessor,
      TransformerService,
      QualityService,
      FlinkService,
      ContractRegistry,
      { provide: TelemetryService, useValue: telemetryInstance },
      { provide: DATA_FLINK_CONFIG, useValue: options.flink ?? null },
      { provide: DATA_TELEMETRY_CONFIG, useValue: telemetryOpts },
      DataFlinkBootstrap,
      DataTelemetryBootstrap,
    ];

    return {
      module: DataModule,
      providers,
      exports: [
        SchemaValidator,
        ETLService,
        PipelineBuilder,
        PipelineRunner,
        StreamService,
        StreamBuilder,
        StreamProcessor,
        TransformerService,
        QualityService,
        FlinkService,
        ContractRegistry,
        TelemetryService,
      ],
    };
  }

  static getOptions(): DataModuleOptions {
    return DataModule.options;
  }
}
