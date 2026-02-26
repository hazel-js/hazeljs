import type { PipelineStep } from '../../pipelines/etl.service';

export type FlinkOperatorType = 'map' | 'filter' | 'flatMap' | 'window' | 'keyBy';

export interface FlinkOperator {
  type: FlinkOperatorType;
  step: number;
  name: string;
  function?: (value: unknown) => unknown | Promise<unknown>;
  predicate?: (value: unknown) => boolean;
  windowType?: 'tumbling' | 'sliding' | 'session';
  windowSize?: string;
  aggregator?: (value: unknown) => unknown;
}

/**
 * Maps HazelJS pipeline steps to Flink operators
 * Note: Actual function/predicate execution happens in deployed Flink job
 */
export function mapToFlinkOperator(step: PipelineStep): FlinkOperator {
  switch (step.type) {
    case 'transform':
      return {
        type: 'map',
        step: step.step,
        name: step.name,
        // Method name for job graph - actual handler in deployed job
      };
    case 'validate':
      return {
        type: 'filter',
        step: step.step,
        name: step.name,
        predicate: () => true,
      };
    default:
      return {
        type: 'map',
        step: step.step,
        name: step.name,
      };
  }
}

export function createFlinkJobGraph(
  steps: PipelineStep[],
  sourceConfig: { type: string; topic?: string; properties?: Record<string, string> },
  sinkConfig: { type: string; topic?: string; properties?: Record<string, string> }
): {
  source: typeof sourceConfig;
  transformations: Array<{ step: number; name: string; operator: FlinkOperator }>;
  sink: typeof sinkConfig;
} {
  return {
    source: sourceConfig,
    transformations: steps.map((step) => ({
      step: step.step,
      name: step.name,
      operator: mapToFlinkOperator(step),
    })),
    sink: sinkConfig,
  };
}
