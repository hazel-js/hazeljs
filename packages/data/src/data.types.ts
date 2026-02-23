/**
 * @hazeljs/data - Type definitions for ETL and streaming
 */

export interface PipelineStepMetadata {
  step: number;
  name: string;
  type: 'transform' | 'validate';
  schema?: unknown;
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
