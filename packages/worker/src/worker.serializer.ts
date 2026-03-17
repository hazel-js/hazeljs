import { WorkerSerializationError } from './worker.errors';

/**
 * JSON-based serializer for worker message payloads.
 * Uses JSON.stringify/parse for main thread <-> worker communication.
 */
export class WorkerSerializer {
  /**
   * Serialize payload for sending to worker
   */
  serialize(payload: unknown): string {
    try {
      return JSON.stringify(payload);
    } catch (err) {
      throw new WorkerSerializationError(
        `Failed to serialize payload: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * Deserialize payload received from worker
   */
  deserialize<T = unknown>(data: string): T {
    try {
      return JSON.parse(data) as T;
    } catch (err) {
      throw new WorkerSerializationError(
        `Failed to deserialize payload: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined
      );
    }
  }
}
