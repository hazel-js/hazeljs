/**
 * Optional FlowEngine peer bridge for durable HITL (ADR-003).
 * Soft dependency — only used when a FlowEngine-like object is injected.
 */

export interface FlowEngineLike {
  registerDefinition(def: {
    flowId: string;
    version: string;
    entry: string;
    nodes: Record<
      string,
      {
        id: string;
        handler: (ctx: {
          state: Record<string, unknown>;
        }) => Promise<
          | { status: 'ok'; output?: unknown; patch?: Record<string, unknown> }
          | { status: 'wait'; reason?: string; until?: string }
        >;
      }
    >;
    edges: Array<{ from: string; to: string }>;
  }): Promise<void>;
  startRun(args: { flowId: string; version: string; input?: unknown }): Promise<{ runId: string }>;
  tick(runId: string): Promise<{ status: string }>;
  resumeRun(runId: string, payload?: unknown): Promise<{ status: string }>;
  getRun(runId: string): Promise<{ status: string } | null>;
}

const FLOW_ID = 'agent-hitl';
const FLOW_VERSION = '1.0.0';

let definitionRegistered = false;

function buildHitlDefinition(): Parameters<FlowEngineLike['registerDefinition']>[0] {
  return {
    flowId: FLOW_ID,
    version: FLOW_VERSION,
    entry: 'await_approval',
    nodes: {
      await_approval: {
        id: 'await_approval',
        handler: async (ctx: {
          state: Record<string, unknown>;
        }): Promise<
          | { status: 'ok'; output?: unknown; patch?: Record<string, unknown> }
          | { status: 'wait'; reason?: string; until?: string }
        > => {
          if (ctx.state._resumePayload) {
            return {
              status: 'ok',
              output: ctx.state._resumePayload,
              patch: { resolved: true },
            };
          }
          return { status: 'wait', reason: 'tool_approval', until: 'manual' };
        },
      },
      done: {
        id: 'done',
        handler: async (): Promise<{ status: 'ok'; output?: unknown }> => ({
          status: 'ok',
          output: { done: true },
        }),
      },
    },
    edges: [{ from: 'await_approval', to: 'done' }],
  };
}

/**
 * Start a flow WAITING run that mirrors agent HITL. Returns flow run id.
 */
export async function startFlowHitlWait(
  engine: FlowEngineLike,
  meta?: { agentRunId?: string; requestId?: string }
): Promise<string> {
  if (!definitionRegistered) {
    await engine.registerDefinition(buildHitlDefinition());
    definitionRegistered = true;
  }
  const { runId } = await engine.startRun({
    flowId: FLOW_ID,
    version: FLOW_VERSION,
    input: meta ?? {},
  });
  let run = await engine.getRun(runId);
  let guard = 0;
  while (run?.status === 'RUNNING' && guard < 10) {
    run = await engine.tick(runId);
    guard += 1;
  }
  return runId;
}

/**
 * Resume the mirrored flow wait with an approval decision.
 */
export async function resumeFlowHitlWait(
  engine: FlowEngineLike,
  flowRunId: string,
  payload: { approved: boolean; requestId?: string; approvedBy?: string }
): Promise<void> {
  let run = await engine.resumeRun(flowRunId, payload);
  let guard = 0;
  while (run?.status === 'RUNNING' && guard < 10) {
    run = await engine.tick(flowRunId);
    guard += 1;
  }
}

/** Reset registration flag (tests). */
export function resetFlowHitlBridgeForTests(): void {
  definitionRegistered = false;
}
