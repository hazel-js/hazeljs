import type { FlinkAuthConfig, FlinkJobConfig } from '../../data.types';

export interface FlinkClientConfig {
  url: string;
  auth?: FlinkAuthConfig;
  timeout?: number;
  retries?: number;
}

export interface FlinkJobInfo {
  id: string;
  status: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface FlinkJobSubmitRequest {
  jobName?: string;
  parallelism?: number;
  savepointPath?: string;
  allowNonRestoredState?: boolean;
  programArgs?: string;
  entryClass?: string;
  jarFile?: string;
}

/**
 * Flink Client - REST API client for Apache Flink clusters
 * Interacts with Flink JobManager REST API
 */
export class FlinkClient {
  public readonly url: string;
  private readonly config: FlinkClientConfig;

  constructor(config: FlinkClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
    };
    this.url = this.config.url.replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.url}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth?.type === 'basic' && this.config.auth.username) {
      const credentials = Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password || ''}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (this.config.auth?.type === 'token' && this.config.auth.token) {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Flink API error ${response.status}: ${text}`);
      }

      const text = await response.text();
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        throw new Error(`Flink request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async listJobs(): Promise<FlinkJobInfo[]> {
    const result = await this.request<{
      jobs?: {
        id: string;
        status: string;
        'start-time'?: number;
        'end-time'?: number;
        duration?: number;
      }[];
    }>('GET', '/jobs/overview');
    const jobs =
      (
        result as {
          jobs?: Array<{
            id: string;
            status: string;
            'start-time'?: number;
            'end-time'?: number;
            duration?: number;
          }>;
        }
      ).jobs ?? [];
    return jobs.map((j) => ({
      id: j.id,
      status: j.status,
      startTime: j['start-time'],
      endTime: j['end-time'],
      duration: j.duration,
    }));
  }

  async getJobStatus(
    jobId: string
  ): Promise<{ state: string; startTime?: number; duration?: number }> {
    const result = await this.request<{ state: string; 'start-time'?: number; duration?: number }>(
      'GET',
      `/jobs/${jobId}`
    );
    return {
      state: result.state,
      startTime: result['start-time'],
      duration: result.duration,
    };
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.request('PATCH', `/jobs/${jobId}?mode=cancel`);
  }

  async stopJob(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    const body = savepointPath ? { targetDirectory: savepointPath } : {};
    return this.request('PATCH', `/jobs/${jobId}?mode=stop`, body);
  }

  async createSavepoint(jobId: string, savepointPath?: string): Promise<{ 'request-id': string }> {
    const body = savepointPath ? { targetDirectory: savepointPath } : {};
    return this.request('POST', `/jobs/${jobId}/savepoints`, body);
  }

  async getClusterInfo(): Promise<{ taskmanagers?: number; 'slots-total'?: number }> {
    return this.request('GET', '/overview');
  }

  async getTaskManagers(): Promise<unknown[]> {
    const result = await this.request<{ taskmanagers?: unknown[] }>('GET', '/taskmanagers');
    return result.taskmanagers ?? [];
  }

  /**
   * Submit a job to Flink cluster.
   * Note: Actual JAR submission requires Flink's /jars endpoint.
   * This provides the interface; implementation depends on deployment setup.
   */
  async submitJob(_jobConfig: FlinkJobConfig, _jobGraph?: unknown): Promise<string> {
    // Flink REST API submits jobs via JAR upload and run
    // For now return a placeholder - full implementation would:
    // 1. Upload JAR to /jars
    // 2. Create job from JAR via /jars/:jarid/run
    throw new Error(
      'submitJob: Full Flink deployment requires JAR submission. Use FlinkService.deployStream() for pipeline-to-job conversion.'
    );
  }
}
