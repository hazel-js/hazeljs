import { Injectable } from '@hazeljs/core';
import type { WorkerTaskDefinition } from './worker.types';
import { WorkerTaskNotFoundError } from './worker.errors';
import path from 'path';

/**
 * Registry mapping task names to handler paths and options.
 * Populated at bootstrap from WorkerModuleOptions and discovery.
 */
@Injectable()
export class WorkerRegistry {
  private tasks = new Map<string, WorkerTaskDefinition>();

  /**
   * Register a task definition
   */
  register(definition: WorkerTaskDefinition): void {
    this.tasks.set(definition.name, definition);
  }

  /**
   * Register multiple tasks from an explicit map (taskName -> handlerPath)
   */
  registerFromMap(
    taskRegistry: Record<string, string>,
    defaults?: { timeout?: number; maxConcurrency?: number }
  ): void {
    for (const [name, handlerPath] of Object.entries(taskRegistry)) {
      const resolvedPath = path.isAbsolute(handlerPath) ? handlerPath : path.resolve(handlerPath);
      this.register({
        name,
        handlerPath: resolvedPath,
        timeout: defaults?.timeout,
        maxConcurrency: defaults?.maxConcurrency,
      });
    }
  }

  /**
   * Register tasks from a directory by convention: taskDirectory + taskName + extension (resolved at runtime).
   */
  registerFromDirectory(
    taskDirectory: string,
    taskNames: string[],
    defaults?: { timeout?: number; maxConcurrency?: number; taskFileExtension?: string }
  ): void {
    const resolvedDir = path.isAbsolute(taskDirectory)
      ? taskDirectory
      : path.resolve(taskDirectory);
    const ext = defaults?.taskFileExtension ?? '.js';
    const suffix = ext.startsWith('.') ? ext : `.${ext}`;
    for (const name of taskNames) {
      const handlerPath = path.join(resolvedDir, `${name}${suffix}`);
      this.register({
        name,
        handlerPath,
        timeout: defaults?.timeout,
        maxConcurrency: defaults?.maxConcurrency,
      });
    }
  }

  /**
   * Get task definition by name
   */
  get(taskName: string): WorkerTaskDefinition {
    const definition = this.tasks.get(taskName);
    if (!definition) {
      throw new WorkerTaskNotFoundError(taskName);
    }
    return definition;
  }

  /**
   * Check if a task is registered
   */
  has(taskName: string): boolean {
    return this.tasks.has(taskName);
  }

  /**
   * Get all registered task names
   */
  getTaskNames(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get all task definitions (for Inspector, etc.)
   */
  getAll(): WorkerTaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Build task registry map for passing to workers (name -> absolute path)
   */
  toWorkerData(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, def] of this.tasks) {
      result[name] = def.handlerPath;
    }
    return result;
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.tasks.clear();
  }
}
