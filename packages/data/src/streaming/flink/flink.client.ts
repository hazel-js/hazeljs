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
   * Upload a JAR file to the Flink cluster.
   * @param jarPath Local filesystem path to the JAR file
   * @returns The Flink JAR ID for subsequent run calls
   */
  async uploadJar(jarPath: string): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(jarPath)) {
      throw new Error(`JAR file not found: ${jarPath}`);
    }

    const url = `${this.url}/jars/upload`;
    const fileName = path.basename(jarPath);
    const fileBuffer = fs.readFileSync(jarPath);

    const headers: Record<string, string> = {};
    if (this.config.auth?.type === 'basic' && this.config.auth.username) {
      headers['Authorization'] = `Basic ${Buffer.from(`${this.config.auth.username}:${this.config.auth.password ?? ''}`).toString('base64')}`;
    } else if (this.config.auth?.type === 'token' && this.config.auth.token) {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
    }

    const boundary = `----HazelJSFormBoundary${Date.now()}`;
    const bodyParts: Buffer[] = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="jarfile"; filename="${fileName}"\r\nContent-Type: application/java-archive\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ];
    const body = Buffer.concat(bodyParts);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Flink JAR upload failed ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as { filename?: string };
      const filename = result.filename ?? '';
      const match = /\/jars\/([^/]+)$/.exec(filename);
      if (!match) throw new Error(`Could not extract JAR ID from Flink response: ${filename}`);
      return match[1];
    } catch (error) {
      clearTimeout(timeoutId);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Run a previously uploaded JAR as a Flink job.
   * @param jarId   The JAR ID returned by uploadJar()
   * @param request Optional run parameters (entry class, parallelism, args, etc.)
   * @returns The Flink job ID
   */
  async runJar(jarId: string, request: FlinkJobSubmitRequest = {}): Promise<string> {
    const body: Record<string, unknown> = {};
    if (request.jobName) body['job-name'] = request.jobName;
    if (request.parallelism) body['parallelism'] = request.parallelism;
    if (request.entryClass) body['entry-class'] = request.entryClass;
    if (request.programArgs) body['program-args'] = request.programArgs;
    if (request.savepointPath) body['savepointPath'] = request.savepointPath;
    if (request.allowNonRestoredState) body['allowNonRestoredState'] = request.allowNonRestoredState;

    const result = await this.request<{ jobid: string }>('POST', `/jars/${jarId}/run`, body);
    if (!result.jobid) throw new Error('Flink did not return a job ID');
    return result.jobid;
  }

  /**
   * Submit a SQL statement to the Flink SQL Gateway.
   * Requires Flink SQL Gateway to be running.
   * @param sql       The SQL statement to execute (CREATE TABLE, INSERT INTO, etc.)
   * @param sessionId An existing Flink SQL Gateway session ID
   */
  async submitSql(sql: string, sessionId: string): Promise<string> {
    const result = await this.request<{ operationHandle?: { identifier: string } }>(
      'POST',
      `/sessions/${sessionId}/statements`,
      { statement: sql }
    );
    const id = result.operationHandle?.identifier;
    if (!id) throw new Error('Flink SQL Gateway did not return an operation handle');
    return id;
  }

  /**
   * Create a new SQL Gateway session.
   * @returns The session ID
   */
  async createSqlSession(properties?: Record<string, string>): Promise<string> {
    const result = await this.request<{ sessionHandle?: { identifier: string } }>(
      'POST',
      '/sessions',
      { properties: properties ?? {} }
    );
    const id = result.sessionHandle?.identifier;
    if (!id) throw new Error('Flink SQL Gateway did not return a session handle');
    return id;
  }

  /**
   * Submit a job to Flink cluster.
   * Requires `jarFile` path in the jobConfig or uses FlinkJobSubmitRequest.jarFile.
   *
   * Workflow: upload JAR → run JAR → return job ID.
   */
  async submitJob(jobConfig: FlinkJobConfig, request: FlinkJobSubmitRequest = {}): Promise<string> {
    const jarFile = request.jarFile;
    if (!jarFile) {
      throw new Error(
        'submitJob requires a JAR file path. Set request.jarFile to the path of your pipeline JAR, ' +
        'or use submitSql() for Flink SQL-based pipelines.'
      );
    }

    const jarId = await this.uploadJar(jarFile);
    return this.runJar(jarId, {
      jobName: request.jobName ?? jobConfig.jobName,
      parallelism: request.parallelism ?? jobConfig.parallelism,
      entryClass: request.entryClass,
      programArgs: request.programArgs,
      savepointPath: request.savepointPath,
      allowNonRestoredState: request.allowNonRestoredState,
    });
  }

  /**
   * List uploaded JARs on the cluster.
   */
  async listJars(): Promise<Array<{ id: string; name: string; uploaded: number }>> {
    const result = await this.request<{ files?: Array<{ id: string; name: string; uploaded: number }> }>('GET', '/jars');
    return result.files ?? [];
  }

  /**
   * Delete an uploaded JAR from the cluster.
   */
  async deleteJar(jarId: string): Promise<void> {
    await this.request('DELETE', `/jars/${jarId}`);
  }
}
