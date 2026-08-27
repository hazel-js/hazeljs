const APPROVAL_KEY = Symbol('hazel:agent:approval');

export interface ApprovalOptions {
  /** Queue / topic name for pending approvals (integrate with @hazeljs/queue). */
  queueName?: string;
  /** Optional WebSocket room for UI approvals. */
  roomId?: string;
}

/**
 * Marks a tool method as requiring human approval before execution.
 * Your {@link AgentRuntime} or custom middleware should check metadata and pause until approved.
 */
export function RequiresApproval(options: ApprovalOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(APPROVAL_KEY, options, target, propertyKey);
    return descriptor;
  };
}

export function getApprovalMetadata(
  target: object,
  propertyKey: string | symbol
): ApprovalOptions | undefined {
  return Reflect.getMetadata(APPROVAL_KEY, target, propertyKey);
}
