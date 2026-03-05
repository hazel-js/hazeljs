/**
 * @hazeljs/data - Type definitions for ETL and streaming
 */

export interface RetryConfig {
  attempts: number;
  delay?: number;
  backoff?: 'fixed' | 'exponential';
}

export interface DLQConfig {
  handler: (item: unknown, error: Error, stepName: string) => void | Promise<void>;
}

export interface PipelineStepMetadata {
  step: number;
  name: string;
  type: 'transform' | 'validate';
  schema?: unknown;
  /** Run step only when predicate returns true */
  when?: (data: unknown) => boolean;
  /** Retry configuration for this step */
  retry?: RetryConfig;
  /** Per-step timeout in milliseconds */
  timeoutMs?: number;
  /** Dead letter queue handler - called instead of throwing on failure */
  dlq?: DLQConfig;
}

export interface StreamMetadata {
  name: string;
  source: string;
  sink: string;
  parallelism?: number;
}

export interface FlinkJobConfig {
  jobName?: string;
  parallelism?: number;
  checkpointInterval?: number;
  restartStrategy?: {
    type: string;
    attempts?: number;
    delay?: number;
  };
  resources?: {
    taskManagerMemory?: string;
    jobManagerMemory?: string;
    cpuCores?: number;
  };
  stateBackend?: {
    type: string;
    checkpointPath?: string;
    savepointPath?: string;
  };
  highAvailability?: {
    type: string;
    zookeeperQuorum?: string;
    clusterId?: string;
  };
  metrics?: {
    reporters?: string[];
    interval?: number;
  };
}

export interface FlinkAuthConfig {
  type: 'basic' | 'token' | 'oauth';
  username?: string;
  password?: string;
  token?: string;
}
