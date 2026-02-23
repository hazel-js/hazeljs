import { Injectable } from '@hazeljs/core';
import { ModelMetadata, ModelVersion } from '../ml.types';
import logger from '@hazeljs/core';

export interface RegisteredModel {
  metadata: ModelMetadata;
  instance: object;
  trainMethod?: string;
  predictMethod?: string;
}

/**
 * Model Registry - Handles model versioning and storage
 * Integrates with TensorFlow.js, ONNX Runtime for model persistence
 */
@Injectable()
export class ModelRegistry {
  private models: Map<string, RegisteredModel> = new Map();
  private versions: Map<string, ModelVersion[]> = new Map();

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
    // Return latest version
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
}
