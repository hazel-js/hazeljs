import { Injectable } from '@hazeljs/core';
import { FlinkClient } from './streaming/flink/flink.client';
import { StreamBuilder } from './streaming/stream.builder';
import { ETLService } from './pipelines/etl.service';
import type { FlinkJobConfig } from './data.types';
import type { FlinkClientConfig } from './streaming/flink/flink.client';

export interface DeployStreamResult {
  jobId?: string;
  status: string;
  webUI?: string;
  jobConfig: FlinkJobConfig;
  jobGraph: unknown;
}

/**
 * Flink Service - Deploy stream pipelines to Flink cluster
 * Wraps FlinkClient and StreamBuilder for pipeline deployment
 */
@Injectable()
export class FlinkService {
  private flinkClient: FlinkClient | null = null;

  constructor(
    private readonly etlService: ETLService,
    private readonly streamBuilder: StreamBuilder
  ) {}

  configure(config: FlinkClientConfig): void {
    this.flinkClient = new FlinkClient(config);
  }

  getClient(): FlinkClient {
    if (!this.flinkClient) {
      throw new Error(
        'FlinkService not configured. Call configure() or use DataModule.forRoot() with flink options.'
      );
    }
    return this.flinkClient;
  }

  async deployStream(
    pipeline: object,
    config?: Partial<FlinkJobConfig>
  ): Promise<DeployStreamResult> {
    const { jobConfig, jobGraph } = this.streamBuilder.buildConfig(pipeline, config);

    const client = this.getClient();

    try {
      const jobId = await client.submitJob(jobConfig, jobGraph);
      return {
        jobId,
        status: 'submitted',
        webUI: `${client.url}/#/job/${jobId}`,
        jobConfig,
        jobGraph,
      };
    } catch {
      // submitJob throws - return config for manual deployment
      return {
        status: 'config_generated',
        jobConfig,
        jobGraph,
        webUI: client.url,
      };
    }
  }

  async getJobStatus(
    jobId: string
  ): Promise<{ state: string; startTime?: number; duration?: number }> {
    return this.getClient().getJobStatus(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    return this.getClient().cancelJob(jobId);
  }

  async createSavepoint(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    return this.getClient().createSavepoint(jobId, savepointPath);
  }

  async stopJob(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    return this.getClient().stopJob(jobId, savepointPath);
  }

  async getClusterInfo(): Promise<{ taskmanagers?: number; 'slots-total'?: number }> {
    return this.getClient().getClusterInfo();
  }

  async getTaskManagers(): Promise<unknown[]> {
    return this.getClient().getTaskManagers();
  }

  async listJobs(): Promise<
    { id: string; status: string; startTime?: number; endTime?: number; duration?: number }[]
  > {
    return this.getClient().listJobs();
  }
}
