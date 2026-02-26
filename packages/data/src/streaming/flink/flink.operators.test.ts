import { mapToFlinkOperator, createFlinkJobGraph } from './flink.operators';
import type { PipelineStep } from '../../pipelines/etl.service';

describe('flink operators', () => {
  describe('mapToFlinkOperator', () => {
    it('maps transform step to map operator', () => {
      const step: PipelineStep = {
        step: 1,
        name: 'parse',
        type: 'transform',
        method: 'parse',
      };
      const op = mapToFlinkOperator(step);
      expect(op.type).toBe('map');
      expect(op.step).toBe(1);
      expect(op.name).toBe('parse');
    });

    it('maps validate step to filter operator', () => {
      const step: PipelineStep = {
        step: 2,
        name: 'validate',
        type: 'validate',
        method: 'validate',
      };
      const op = mapToFlinkOperator(step);
      expect(op.type).toBe('filter');
    });
  });

  describe('createFlinkJobGraph', () => {
    it('creates job graph with source, sink, transformations', () => {
      const steps: PipelineStep[] = [{ step: 1, name: 't1', type: 'transform', method: 't1' }];
      const graph = createFlinkJobGraph(
        steps,
        { type: 'kafka', topic: 'in', properties: {} },
        { type: 'kafka', topic: 'out', properties: {} }
      );
      expect(graph.source.topic).toBe('in');
      expect(graph.sink.topic).toBe('out');
      expect(graph.transformations).toHaveLength(1);
    });
  });
});
