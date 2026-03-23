/**
 * Experiment Service - ML experiment tracking and management
 */

import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type {
  Experiment,
  Run,
  Artifact,
  ExperimentConfig,
  RunComparison,
} from './experiment.types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

@Service()
export class ExperimentService {
  private experiments: Map<string, Experiment> = new Map();
  private runs: Map<string, Run> = new Map();
  private config: ExperimentConfig = { storage: 'memory' };
  private storageDir: string = './experiments';

  configure(config: ExperimentConfig): void {
    this.config = config;
    if (config.file) {
      this.storageDir = config.file.directory;
    }
    logger.debug('ExperimentService configured', { storage: config.storage });
  }

  // ─── Experiments ───────────────────────────────────────────────────────────

  createExperiment(
    name: string,
    options: { description?: string; tags?: string[] } = {}
  ): Experiment {
    const experiment: Experiment = {
      id: generateId(),
      name,
      description: options.description,
      tags: options.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experiment.id, experiment);

    if (this.config.storage === 'file') {
      this.saveExperimentToFile(experiment);
    }

    logger.debug(`Created experiment: ${name} (${experiment.id})`);
    return experiment;
  }

  getExperiment(id: string): Experiment | undefined {
    if (this.config.storage === 'file') {
      return this.loadExperimentFromFile(id);
    }
    return this.experiments.get(id);
  }

  listExperiments(): Experiment[] {
    if (this.config.storage === 'file') {
      return this.loadAllExperimentsFromFile();
    }
    return Array.from(this.experiments.values());
  }

  deleteExperiment(id: string): boolean {
    // Delete associated runs first
    const runsToDelete = Array.from(this.runs.values()).filter((r) => r.experimentId === id);
    for (const run of runsToDelete) {
      this.deleteRun(run.id);
    }

    const deleted = this.experiments.delete(id);

    if (deleted && this.config.storage === 'file') {
      const expDir = join(this.storageDir, id);
      if (existsSync(expDir)) {
        // Delete all files in experiment directory
        const files = readdirSync(expDir);
        for (const file of files) {
          unlinkSync(join(expDir, file));
        }
      }
    }

    logger.debug(`Deleted experiment: ${id}`);
    return deleted;
  }

  // ─── Runs ──────────────────────────────────────────────────────────────────

  startRun(
    experimentId: string,
    options: { name?: string; params?: Record<string, unknown>; tags?: string[] } = {}
  ): Run {
    const run: Run = {
      id: generateId(),
      experimentId,
      name: options.name,
      status: 'running',
      params: options.params ?? {},
      metrics: {},
      artifacts: [],
      startTime: new Date(),
      tags: options.tags,
    };

    this.runs.set(run.id, run);

    if (this.config.storage === 'file') {
      this.saveRunToFile(run);
    }

    logger.debug(`Started run: ${run.id} for experiment: ${experimentId}`);
    return run;
  }

  endRun(runId: string, status: 'completed' | 'failed' | 'aborted' = 'completed'): Run {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.status = status;
    run.endTime = new Date();
    run.durationMs = run.endTime.getTime() - run.startTime.getTime();

    if (this.config.storage === 'file') {
      this.saveRunToFile(run);
    }

    logger.debug(`Ended run: ${runId} with status: ${status}`);
    return run;
  }

  getRun(id: string): Run | undefined {
    if (this.config.storage === 'file') {
      return this.loadRunFromFile(id);
    }
    return this.runs.get(id);
  }

  listRuns(experimentId?: string): Run[] {
    if (this.config.storage === 'file') {
      const all = this.loadAllRunsFromFile();
      if (experimentId) {
        return all.filter((r) => r.experimentId === experimentId);
      }
      return all;
    }

    const runs = Array.from(this.runs.values());
    if (experimentId) {
      return runs.filter((r) => r.experimentId === experimentId);
    }
    return runs;
  }

  deleteRun(id: string): boolean {
    const run = this.runs.get(id);
    if (!run) return false;

    // Delete artifacts
    for (const artifact of run.artifacts) {
      this.deleteArtifactFile(artifact);
    }

    const deleted = this.runs.delete(id);

    if (deleted && this.config.storage === 'file') {
      const runPath = join(this.storageDir, run.experimentId, `run-${id}.json`);
      if (existsSync(runPath)) {
        unlinkSync(runPath);
      }
    }

    return deleted;
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  logMetric(runId: string, key: string, value: number): void {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    run.metrics[key] = value;

    if (this.config.storage === 'file') {
      this.saveRunToFile(run);
    }

    logger.debug(`Logged metric: ${key}=${value} for run: ${runId}`);
  }

  logMetrics(runId: string, metrics: Record<string, number>): void {
    for (const [key, value] of Object.entries(metrics)) {
      this.logMetric(runId, key, value);
    }
  }

  getBestRun(experimentId: string, metric: string, mode: 'min' | 'max' = 'max'): Run | undefined {
    const runs = this.listRuns(experimentId).filter((r) => r.metrics[metric] !== undefined);
    if (runs.length === 0) return undefined;

    return runs.reduce((best, current) => {
      const bestValue = best.metrics[metric];
      const currentValue = current.metrics[metric];

      if (mode === 'max') {
        return currentValue > bestValue ? current : best;
      } else {
        return currentValue < bestValue ? current : best;
      }
    });
  }

  // ─── Artifacts ───────────────────────────────────────────────────────────────

  logArtifact(
    runId: string,
    name: string,
    type: Artifact['type'],
    content: string | Buffer,
    metadata?: Record<string, unknown>
  ): Artifact {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const artifact: Artifact = {
      id: generateId(),
      runId,
      name,
      type,
      path: '', // Will be set based on storage
      size: Buffer.byteLength(content),
      metadata,
      createdAt: new Date(),
    };

    if (this.config.storage === 'file') {
      const artifactPath = join(
        this.storageDir,
        run.experimentId,
        runId,
        `${name}.${this.getArtifactExtension(type)}`
      );
      artifact.path = artifactPath;

      // Ensure directory exists
      const dir = join(this.storageDir, run.experimentId, runId);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(artifactPath, content);
    } else {
      // In-memory: store content in metadata (not ideal for large files)
      artifact.path = `memory://${artifact.id}`;
      artifact.metadata = { ...artifact.metadata, _content: content.toString('base64') };
    }

    run.artifacts.push(artifact);

    if (this.config.storage === 'file') {
      this.saveRunToFile(run);
    }

    logger.debug(`Logged artifact: ${name} for run: ${runId}`);
    return artifact;
  }

  getArtifact(runId: string, artifactId: string): Artifact | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;

    return run.artifacts.find((a) => a.id === artifactId);
  }

  // ─── Comparison ─────────────────────────────────────────────────────────────

  compareRuns(runIds: string[]): RunComparison[] {
    return runIds
      .map((id) => this.getRun(id))
      .filter((run): run is Run => run !== undefined && run.status === 'completed')
      .map((run) => ({
        runId: run.id,
        params: run.params,
        metrics: run.metrics,
        durationMs: run.durationMs ?? 0,
      }));
  }

  // ─── File Storage Helpers ────────────────────────────────────────────────────

  private saveExperimentToFile(experiment: Experiment): void {
    const expDir = join(this.storageDir, experiment.id);
    if (!existsSync(expDir)) {
      mkdirSync(expDir, { recursive: true });
    }
    const path = join(expDir, 'experiment.json');
    writeFileSync(path, JSON.stringify(experiment, null, 2));
  }

  private loadExperimentFromFile(id: string): Experiment | undefined {
    const path = join(this.storageDir, id, 'experiment.json');
    if (!existsSync(path)) return undefined;

    const content = readFileSync(path, 'utf-8');
    const exp = JSON.parse(content) as Experiment;
    exp.createdAt = new Date(exp.createdAt);
    exp.updatedAt = new Date(exp.updatedAt);
    return exp;
  }

  private loadAllExperimentsFromFile(): Experiment[] {
    if (!existsSync(this.storageDir)) return [];

    const experiments: Experiment[] = [];
    const dirs = readdirSync(this.storageDir, { withFileTypes: true });

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const exp = this.loadExperimentFromFile(dir.name);
        if (exp) experiments.push(exp);
      }
    }

    return experiments;
  }

  private saveRunToFile(run: Run): void {
    const expDir = join(this.storageDir, run.experimentId);
    if (!existsSync(expDir)) {
      mkdirSync(expDir, { recursive: true });
    }
    const path = join(expDir, `run-${run.id}.json`);
    writeFileSync(path, JSON.stringify(run, null, 2));
  }

  private loadRunFromFile(id: string): Run | undefined {
    // Find the run file in any experiment directory
    if (!existsSync(this.storageDir)) return undefined;

    const dirs = readdirSync(this.storageDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const path = join(this.storageDir, dir.name, `run-${id}.json`);
        if (existsSync(path)) {
          const content = readFileSync(path, 'utf-8');
          const run = JSON.parse(content) as Run;
          run.startTime = new Date(run.startTime);
          if (run.endTime) run.endTime = new Date(run.endTime);
          for (const artifact of run.artifacts) {
            artifact.createdAt = new Date(artifact.createdAt);
          }
          return run;
        }
      }
    }
    return undefined;
  }

  private loadAllRunsFromFile(): Run[] {
    if (!existsSync(this.storageDir)) return [];

    const runs: Run[] = [];
    const dirs = readdirSync(this.storageDir, { withFileTypes: true });

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const expDir = join(this.storageDir, dir.name);
        const files = readdirSync(expDir);
        for (const file of files) {
          if (file.startsWith('run-') && file.endsWith('.json')) {
            const runId = file.replace('run-', '').replace('.json', '');
            const run = this.loadRunFromFile(runId);
            if (run) runs.push(run);
          }
        }
      }
    }

    return runs;
  }

  private deleteArtifactFile(artifact: Artifact): void {
    if (artifact.path.startsWith('file://') || !artifact.path.startsWith('memory://')) {
      if (existsSync(artifact.path)) {
        unlinkSync(artifact.path);
      }
    }
  }

  private getArtifactExtension(type: Artifact['type']): string {
    switch (type) {
      case 'model':
        return 'bin';
      case 'plot':
        return 'png';
      case 'log':
        return 'log';
      case 'data':
        return 'json';
      default:
        return 'txt';
    }
  }
}
