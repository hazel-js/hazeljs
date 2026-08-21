import { Service } from '@hazeljs/core';
import { ModelMetadata, ModelVersion } from '../ml.types';
import logger from '@hazeljs/core';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface RegisteredModel {
  metadata: ModelMetadata;
  instance: object;
  trainMethod?: string;
  predictMethod?: string;
}

export interface ArtifactPayload {
  metadata: ModelMetadata;
  artifact: unknown;
  metrics?: Record<string, number>;
  savedAt: string;
}

/**
 * Model Registry - in-memory model versioning with optional JSON artifact persistence.
 * Does not load TensorFlow.js / ONNX runtimes; consumers pass serializable artifacts via saveArtifact.
 */
@Service()
export class ModelRegistry {
  private models: Map<string, RegisteredModel> = new Map();
  private versions: Map<string, ModelVersion[]> = new Map();
  private artifactDir: string | null = null;

  /** Enable writing artifacts under directory (e.g. './models'). */
  configurePersistence(directory: string): void {
    this.artifactDir = directory;
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    logger.debug(`ModelRegistry persistence enabled at ${directory}`);
  }

  register(model: RegisteredModel): void {
    const key = `${model.metadata.name}@${model.metadata.version}`;
    this.models.set(key, model);

    const versions = this.versions.get(model.metadata.name) || [];
    versions.push({
      version: model.metadata.version,
      createdAt: new Date(),
    });
    this.versions.set(model.metadata.name, versions);

    logger.debug(`Registered model: ${key}`);
  }

  get(name: string, version?: string): RegisteredModel | undefined {
    if (version) {
      return this.models.get(`${name}@${version}`);
    }
    const versions = this.versions.get(name) || [];
    const latest = versions[versions.length - 1];
    return latest ? this.models.get(`${name}@${latest.version}`) : undefined;
  }

  list(): ModelMetadata[] {
    return Array.from(this.models.values()).map((m) => m.metadata);
  }

  getVersions(name: string): ModelVersion[] {
    return this.versions.get(name) || [];
  }

  unregister(name: string, version: string): boolean {
    const key = `${name}@${version}`;
    const deleted = this.models.delete(key);
    if (deleted) {
      const versions = this.versions.get(name) || [];
      const filtered = versions.filter((v) => v.version !== version);
      this.versions.set(name, filtered);
    }
    return deleted;
  }

  /**
   * Persist a serializable artifact (e.g. algorithm.toJSON()) to disk and update version path.
   */
  saveArtifact(
    name: string,
    version: string,
    artifact: unknown,
    metrics?: Record<string, number>
  ): string {
    if (!this.artifactDir) {
      throw new Error('Artifact persistence not configured. Call configurePersistence(dir) first.');
    }
    const filePath = join(this.artifactDir, name, `${version}.json`);
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const model = this.get(name, version);
    const payload: ArtifactPayload = {
      metadata: model?.metadata ?? { name, version, framework: 'custom' },
      artifact,
      metrics,
      savedAt: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    const versions = this.versions.get(name) || [];
    const entry = versions.find((v) => v.version === version);
    if (entry) {
      entry.path = filePath;
      entry.metrics = metrics;
    } else {
      versions.push({ version, createdAt: new Date(), path: filePath, metrics });
      this.versions.set(name, versions);
    }

    logger.debug(`Saved artifact: ${filePath}`);
    return filePath;
  }

  loadArtifact<T = unknown>(name: string, version: string): ArtifactPayload & { artifact: T } {
    const versions = this.versions.get(name) || [];
    const entry = versions.find((v) => v.version === version);
    const filePath =
      entry?.path ?? (this.artifactDir ? join(this.artifactDir, name, `${version}.json`) : null);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(`Artifact not found for ${name}@${version}`);
    }
    return JSON.parse(readFileSync(filePath, 'utf8')) as ArtifactPayload & { artifact: T };
  }
}
