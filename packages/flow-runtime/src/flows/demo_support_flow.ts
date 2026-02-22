/**
 * Demo support flow - WAIT + resume example
 */
import { Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';

@Flow('demo-support', '1.0.0')
class DemoSupportFlow {
  @Entry()
  @Node('create')
  @Edge('notify')
  async create(ctx: FlowContext): Promise<NodeResult> {
    const payload = (ctx.state as { _resumePayload?: { ticketId: string } })._resumePayload;
    if (payload) {
      return { status: 'ok', output: { ticketId: payload.ticketId }, patch: { ticketId: payload.ticketId } };
    }
    return { status: 'wait', reason: 'awaiting_ticket_creation', until: 'manual' };
  }

  @Node('notify')
  async notify(ctx: FlowContext): Promise<NodeResult> {
    return {
      status: 'ok',
      output: { notified: true, ticketId: ctx.outputs.create },
    };
  }
}

export const demoSupportFlow = buildFlowDefinition(DemoSupportFlow);
