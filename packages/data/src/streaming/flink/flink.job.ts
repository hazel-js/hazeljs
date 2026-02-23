import { FlinkClient } from './flink.client';
import type { FlinkJobConfig } from '../../data.types';

export interface FlinkJobResult {
  jobId: string;
  status: string;
  webUI?: string;
}

/**
 * Flink Job - Job management operations
 */
export class FlinkJob {
  constructor(private readonly client: FlinkClient) {}

  async getStatus(
    jobId: string
  ): Promise<{ state: string; startTime?: number; duration?: number }> {
    return this.client.getJobStatus(jobId);
  }

  async cancel(jobId: string): Promise<void> {
    return this.client.cancelJob(jobId);
  }

  async createSavepoint(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    return this.client.createSavepoint(jobId, savepointPath);
  }

  async stop(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    return this.client.stopJob(jobId, savepointPath);
  }

  async submit(config: FlinkJobConfig, jobGraph?: unknown): Promise<string> {
    return this.client.submitJob(config, jobGraph);
  }
}
