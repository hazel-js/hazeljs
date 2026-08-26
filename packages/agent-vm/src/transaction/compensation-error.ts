/**
 * Compensation failure error.
 */

export class CompensationError extends Error {
  readonly code = 'COMPENSATION_FAILED';

  constructor(
    message: string,
    public readonly entryId: string,
    public readonly toolName: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CompensationError';
  }
}
