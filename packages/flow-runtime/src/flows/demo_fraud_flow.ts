/**
 * Demo fraud detection flow - branching example
 */
import { Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';

@Flow('demo-fraud', '1.0.0')
class DemoFraudFlow {
  @Entry()
  @Node('score')
  @Edge('approve', (ctx: FlowContext) => (ctx.state.riskScore as number) < 30, 1)
  @Edge('review', (ctx: FlowContext) => {
    const s = ctx.state.riskScore as number;
    return s >= 30 && s < 70;
  }, 1)
  @Edge('reject', (ctx: FlowContext) => (ctx.state.riskScore as number) >= 70, 1)
  async score(ctx: FlowContext): Promise<NodeResult> {
    const input = ctx.input as { amount: number; userId: string };
    const riskScore = input.amount > 1000 ? 80 : 20;
    return { status: 'ok', output: { riskScore }, patch: { riskScore } };
  }

  @Node('approve')
  async approve(): Promise<NodeResult> {
    return { status: 'ok', output: { decision: 'approved' } };
  }

  @Node('review')
  async review(): Promise<NodeResult> {
    return { status: 'ok', output: { decision: 'manual_review' } };
  }

  @Node('reject')
  async reject(): Promise<NodeResult> {
    return { status: 'ok', output: { decision: 'rejected' } };
  }
}

export const demoFraudFlow = buildFlowDefinition(DemoFraudFlow);
