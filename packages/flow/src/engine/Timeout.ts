/**
 * Per-node timeout via Promise.race
 */

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly nodeId: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
    (this as unknown as { code: string }).code = 'TIMEOUT';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  nodeId: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(`Node ${nodeId} timed out after ${timeoutMs}ms`, nodeId, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}
