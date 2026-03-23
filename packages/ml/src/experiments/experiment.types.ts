/**
 * @hazeljs/ml - Experiment Tracking Types
 */

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Run {
  id: string;
  experimentId: string;
  name?: string;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  params: Record<string, unknown>;
  metrics: Record<string, number>;
  artifacts: Artifact[];
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  tags?: string[];
}

export interface Artifact {
  id: string;
  runId: string;
  name: string;
  type: 'model' | 'plot' | 'log' | 'data' | 'other';
  path: string;
  size?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ExperimentConfig {
  storage: 'file' | 'postgres' | 'memory';
  file?: {
    directory: string;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export interface ExperimentQuery {
  name?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface RunComparison {
  runId: string;
  params: Record<string, unknown>;
  metrics: Record<string, number>;
  durationMs: number;
}
