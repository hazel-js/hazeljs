import { ExperimentService } from '../experiment.service';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('ExperimentService', () => {
  let service: ExperimentService;
  const testStorageDir = join(__dirname, '__test_experiments__');

  beforeEach(() => {
    service = new ExperimentService();
  });

  afterEach(() => {
    if (existsSync(testStorageDir)) {
      rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('configure', () => {
    it('should configure with memory storage', () => {
      service.configure({ storage: 'memory' });
      expect(() => service.listExperiments()).not.toThrow();
    });

    it('should configure with file storage', () => {
      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });
      expect(() => service.listExperiments()).not.toThrow();
    });
  });

  describe('createExperiment', () => {
    it('should create experiment with name', () => {
      const exp = service.createExperiment('test-exp');

      expect(exp.id).toBeDefined();
      expect(exp.name).toBe('test-exp');
      expect(exp.createdAt).toBeInstanceOf(Date);
      expect(exp.updatedAt).toBeInstanceOf(Date);
    });

    it('should create experiment with description', () => {
      const exp = service.createExperiment('test-exp', {
        description: 'Test experiment',
      });

      expect(exp.description).toBe('Test experiment');
    });

    it('should create experiment with tags', () => {
      const exp = service.createExperiment('test-exp', {
        tags: ['ml', 'test'],
      });

      expect(exp.tags).toEqual(['ml', 'test']);
    });

    it('should create experiment without optional fields', () => {
      const exp = service.createExperiment('test-exp');

      expect(exp.description).toBeUndefined();
      expect(exp.tags).toBeUndefined();
    });
  });

  describe('getExperiment', () => {
    it('should return experiment by id', () => {
      const exp = service.createExperiment('test-exp');
      const retrieved = service.getExperiment(exp.id);

      expect(retrieved).toEqual(exp);
    });

    it('should return undefined for non-existent experiment', () => {
      expect(service.getExperiment('non-existent')).toBeUndefined();
    });
  });

  describe('listExperiments', () => {
    it('should return empty array when no experiments', () => {
      expect(service.listExperiments()).toEqual([]);
    });

    it('should list all experiments', () => {
      const exp1 = service.createExperiment('exp1');
      const exp2 = service.createExperiment('exp2');

      const experiments = service.listExperiments();

      expect(experiments).toHaveLength(2);
      expect(experiments).toContainEqual(exp1);
      expect(experiments).toContainEqual(exp2);
    });
  });

  describe('deleteExperiment', () => {
    it('should delete experiment', () => {
      const exp = service.createExperiment('test-exp');
      const deleted = service.deleteExperiment(exp.id);

      expect(deleted).toBe(true);
      expect(service.getExperiment(exp.id)).toBeUndefined();
    });

    it('should return false for non-existent experiment', () => {
      expect(service.deleteExperiment('non-existent')).toBe(false);
    });

    it('should delete associated runs when deleting experiment', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      service.deleteExperiment(exp.id);

      expect(service.getRun(run.id)).toBeUndefined();
    });
  });

  describe('startRun', () => {
    it('should start run for experiment', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      expect(run.id).toBeDefined();
      expect(run.experimentId).toBe(exp.id);
      expect(run.status).toBe('running');
      expect(run.startTime).toBeInstanceOf(Date);
      expect(run.params).toEqual({});
      expect(run.metrics).toEqual({});
      expect(run.artifacts).toEqual([]);
    });

    it('should start run with name', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id, { name: 'test-run' });

      expect(run.name).toBe('test-run');
    });

    it('should start run with params', () => {
      const exp = service.createExperiment('test-exp');
      const params = { lr: 0.001, epochs: 10 };
      const run = service.startRun(exp.id, { params });

      expect(run.params).toEqual(params);
    });

    it('should start run with tags', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id, { tags: ['baseline', 'v1'] });

      expect(run.tags).toEqual(['baseline', 'v1']);
    });
  });

  describe('endRun', () => {
    it('should end run with completed status', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const endedRun = service.endRun(run.id, 'completed');

      expect(endedRun.status).toBe('completed');
      expect(endedRun.endTime).toBeInstanceOf(Date);
      expect(endedRun.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should end run with failed status', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const endedRun = service.endRun(run.id, 'failed');

      expect(endedRun.status).toBe('failed');
    });

    it('should end run with aborted status', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const endedRun = service.endRun(run.id, 'aborted');

      expect(endedRun.status).toBe('aborted');
    });

    it('should default to completed status', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const endedRun = service.endRun(run.id);

      expect(endedRun.status).toBe('completed');
    });

    it('should throw error for non-existent run', () => {
      expect(() => service.endRun('non-existent')).toThrow('Run not found');
    });

    it('should calculate duration', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const endedRun = service.endRun(run.id);

      expect(endedRun.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRun', () => {
    it('should return run by id', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const retrieved = service.getRun(run.id);

      expect(retrieved).toEqual(run);
    });

    it('should return undefined for non-existent run', () => {
      expect(service.getRun('non-existent')).toBeUndefined();
    });
  });

  describe('listRuns', () => {
    it('should return empty array when no runs', () => {
      expect(service.listRuns()).toEqual([]);
    });

    it('should list all runs', () => {
      const exp = service.createExperiment('test-exp');
      const run1 = service.startRun(exp.id);
      const run2 = service.startRun(exp.id);

      const runs = service.listRuns();

      expect(runs).toHaveLength(2);
      expect(runs).toContainEqual(run1);
      expect(runs).toContainEqual(run2);
    });

    it('should filter runs by experiment id', () => {
      const exp1 = service.createExperiment('exp1');
      const exp2 = service.createExperiment('exp2');
      const run1 = service.startRun(exp1.id);
      const _run2 = service.startRun(exp2.id);

      const runs = service.listRuns(exp1.id);

      expect(runs).toHaveLength(1);
      expect(runs[0]).toEqual(run1);
    });
  });

  describe('deleteRun', () => {
    it('should delete run', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const deleted = service.deleteRun(run.id);

      expect(deleted).toBe(true);
      expect(service.getRun(run.id)).toBeUndefined();
    });

    it('should return false for non-existent run', () => {
      expect(service.deleteRun('non-existent')).toBe(false);
    });
  });

  describe('logMetric', () => {
    it('should log metric to run', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      service.logMetric(run.id, 'accuracy', 0.95);

      const updatedRun = service.getRun(run.id);
      expect(updatedRun?.metrics.accuracy).toBe(0.95);
    });

    it('should throw error for non-existent run', () => {
      expect(() => service.logMetric('non-existent', 'metric', 0.5)).toThrow('Run not found');
    });
  });

  describe('logArtifact', () => {
    it('should log artifact to run', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      const artifact = service.logArtifact(run.id, 'trained-model', 'model', 'model content');

      expect(artifact.name).toBe('trained-model');
      expect(artifact.type).toBe('model');

      const updatedRun = service.getRun(run.id);
      expect(updatedRun?.artifacts).toHaveLength(1);
      expect(updatedRun?.artifacts[0].name).toBe('trained-model');
      expect(updatedRun?.artifacts[0].type).toBe('model');
    });

    it('should throw error for non-existent run', () => {
      expect(() => service.logArtifact('non-existent', 'name', 'model', 'content')).toThrow(
        'Run not found'
      );
    });

    it('should support different artifact types', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      service.logArtifact(run.id, 'plot1', 'plot', 'plot data');
      service.logArtifact(run.id, 'log1', 'log', 'log data');
      service.logArtifact(run.id, 'data1', 'data', 'data content');
      service.logArtifact(run.id, 'other1', 'other', 'other content');

      const updatedRun = service.getRun(run.id);
      expect(updatedRun?.artifacts).toHaveLength(4);
    });
  });

  describe('compareRuns', () => {
    it('should compare two completed runs', () => {
      const exp = service.createExperiment('test-exp');
      const run1 = service.startRun(exp.id, { params: { lr: 0.001 } });
      const run2 = service.startRun(exp.id, { params: { lr: 0.01 } });

      service.logMetric(run1.id, 'accuracy', 0.9);
      service.logMetric(run2.id, 'accuracy', 0.95);

      service.endRun(run1.id, 'completed');
      service.endRun(run2.id, 'completed');

      const comparisons = service.compareRuns([run1.id, run2.id]);

      expect(comparisons).toHaveLength(2);
      expect(comparisons[0].runId).toBe(run1.id);
      expect(comparisons[0].params).toEqual({ lr: 0.001 });
      expect(comparisons[0].metrics.accuracy).toBe(0.9);
      expect(comparisons[1].runId).toBe(run2.id);
    });

    it('should handle empty run list', () => {
      const comparisons = service.compareRuns([]);

      expect(comparisons).toEqual([]);
    });

    it('should filter out non-completed runs', () => {
      const exp = service.createExperiment('test-exp');
      const run1 = service.startRun(exp.id);
      const run2 = service.startRun(exp.id);

      service.endRun(run1.id, 'completed');
      // run2 is still running

      const comparisons = service.compareRuns([run1.id, run2.id]);

      expect(comparisons).toHaveLength(1);
      expect(comparisons[0].runId).toBe(run1.id);
    });
  });

  describe('getBestRun', () => {
    it('should return run with highest metric value', () => {
      const exp = service.createExperiment('test-exp');
      const run1 = service.startRun(exp.id);
      const run2 = service.startRun(exp.id);

      service.logMetric(run1.id, 'accuracy', 0.9);
      service.logMetric(run2.id, 'accuracy', 0.95);

      const best = service.getBestRun(exp.id, 'accuracy', 'max');

      expect(best?.id).toBe(run2.id);
    });

    it('should return run with lowest metric value', () => {
      const exp = service.createExperiment('test-exp');
      const run1 = service.startRun(exp.id);
      const run2 = service.startRun(exp.id);

      service.logMetric(run1.id, 'loss', 0.5);
      service.logMetric(run2.id, 'loss', 0.3);

      const best = service.getBestRun(exp.id, 'loss', 'min');

      expect(best?.id).toBe(run2.id);
    });

    it('should return undefined when no runs have the metric', () => {
      const exp = service.createExperiment('test-exp');
      service.startRun(exp.id);

      const best = service.getBestRun(exp.id, 'accuracy', 'max');

      expect(best).toBeUndefined();
    });

    it('should return undefined for experiment with no runs', () => {
      const exp = service.createExperiment('test-exp');
      const best = service.getBestRun(exp.id, 'accuracy', 'max');

      expect(best).toBeUndefined();
    });
  });

  describe('logMetrics', () => {
    it('should log multiple metrics at once', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      service.logMetrics(run.id, {
        accuracy: 0.95,
        precision: 0.92,
        recall: 0.88,
      });

      const updatedRun = service.getRun(run.id);
      expect(updatedRun?.metrics.accuracy).toBe(0.95);
      expect(updatedRun?.metrics.precision).toBe(0.92);
      expect(updatedRun?.metrics.recall).toBe(0.88);
    });
  });

  describe('file storage', () => {
    it('should work with file storage configuration', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      const exp = service.createExperiment('file-test');
      const run = service.startRun(exp.id);
      service.logMetric(run.id, 'accuracy', 0.95);
      service.endRun(run.id);

      // Verify we can retrieve from file storage
      const retrieved = service.getExperiment(exp.id);
      expect(retrieved?.name).toBe('file-test');

      const retrievedRun = service.getRun(run.id);
      expect(retrievedRun?.metrics.accuracy).toBe(0.95);
    });

    it('should list experiments from file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      service.createExperiment('exp1');
      service.createExperiment('exp2');

      const experiments = service.listExperiments();
      expect(experiments.length).toBeGreaterThanOrEqual(2);
    });

    it('should list runs from file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      const exp = service.createExperiment('run-test');
      service.startRun(exp.id);
      service.startRun(exp.id);

      const runs = service.listRuns(exp.id);
      expect(runs.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete experiment with file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      const exp = service.createExperiment('delete-test');
      const run = service.startRun(exp.id);

      service.deleteExperiment(exp.id);

      expect(service.getExperiment(exp.id)).toBeUndefined();
      expect(service.getRun(run.id)).toBeUndefined();
    });

    it('should delete run with file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      const exp = service.createExperiment('run-delete-test');
      const run = service.startRun(exp.id);

      service.deleteRun(run.id);

      expect(service.getRun(run.id)).toBeUndefined();
    });

    it('should log artifact with file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      const exp = service.createExperiment('artifact-test');
      const run = service.startRun(exp.id);

      const artifact = service.logArtifact(run.id, 'model', 'model', 'model data');

      expect(artifact.path).toBeDefined();
      expect(artifact.size).toBeGreaterThan(0);
    });

    it('should handle non-existent experiment in file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      expect(service.getExperiment('non-existent')).toBeUndefined();
    });

    it('should handle non-existent run in file storage', () => {
      if (!existsSync(testStorageDir)) {
        mkdirSync(testStorageDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: testStorageDir },
      });

      expect(service.getRun('non-existent')).toBeUndefined();
    });

    it('should return empty array when no experiments in file storage', () => {
      const emptyDir = join(testStorageDir, 'empty');
      if (!existsSync(emptyDir)) {
        mkdirSync(emptyDir, { recursive: true });
      }

      service.configure({
        storage: 'file',
        file: { directory: emptyDir },
      });

      expect(service.listExperiments()).toEqual([]);
    });
  });

  describe('getArtifact', () => {
    it('should get artifact by id', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);
      const artifact = service.logArtifact(run.id, 'model', 'model', 'data');

      const retrieved = service.getArtifact(run.id, artifact.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(artifact.id);
    });

    it('should return undefined for non-existent artifact', () => {
      const exp = service.createExperiment('test-exp');
      const run = service.startRun(exp.id);

      expect(service.getArtifact(run.id, 'non-existent')).toBeUndefined();
    });

    it('should return undefined for non-existent run', () => {
      expect(service.getArtifact('non-existent', 'artifact-id')).toBeUndefined();
    });
  });
});
