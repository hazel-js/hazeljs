export enum SagaStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  FAILED = 'FAILED',
  ABORTED = 'ABORTED',
}

export interface SagaOptions {
  name: string;
  type?: 'orchestration' | 'choreography';
}

export interface SagaStepOptions {
  compensate?: string;
  timeout?: number;
  order?: number;
}

export interface SagaContext<T = unknown> {
  id: string;
  name: string;
  status: SagaStatus;
  data: T;
  steps: SagaStepExecution[];
  error?: unknown;
}

export interface SagaStepExecution {
  stepName: string;
  status: 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  result?: unknown;
  error?: unknown;
  timestamp: number;
}

export interface ISagaCoordinator {
  start<T>(name: string, data: T): Promise<SagaContext<T>>;
}
