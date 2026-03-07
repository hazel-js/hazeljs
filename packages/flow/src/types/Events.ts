/**
 * Flow run event types for audit timeline
 */

export type FlowEventType =
  | 'RUN_STARTED'
  | 'NODE_STARTED'
  | 'NODE_FINISHED'
  | 'NODE_FAILED'
  | 'RUN_WAITING'
  | 'RUN_COMPLETED'
  | 'RUN_ABORTED';

export interface FlowRunEventPayload {
  nodeId?: string;
  attempt?: number;
  cached?: boolean;
  error?: { code: string; message: string };
  reason?: string;
  until?: string;
  [key: string]: unknown;
}
