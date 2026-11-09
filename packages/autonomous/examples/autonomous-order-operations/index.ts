/**
 * Reference: autonomous order operations — carrier failure → decide → approve → switch.
 *
 * Run: npm run example:order-ops --workspace=@hazeljs/autonomous
 *
 * Typecheck via examples/tsconfig.json (`experimentalDecorators: true`).
 */
import 'reflect-metadata';
import {
  Injectable,
  Autonomous,
  Observe,
  Capability,
  clearAutonomousRegistry,
} from '@hazeljs/core';
import { AutonomousRuntime, MemoryAutonomousRunStore } from '../../src';

const ALLOWED_FALLBACKS = ['carrier-b', 'carrier-c'] as const;
const MAX_ADDITIONAL_COST = 5;
const APPROVAL_COST_THRESHOLD = 2;

const FIXTURE_ORDERS: Record<string, { orderId: string; carrier: string; fallbackCost: number }> = {
  'ORD-1001': { orderId: 'ORD-1001', carrier: 'carrier-a', fallbackCost: 3 },
  'ORD-1002': { orderId: 'ORD-1002', carrier: 'carrier-a', fallbackCost: 1 },
};

@Injectable()
@Autonomous({
  id: 'order-operations',
  objective: 'Maintain reliable order processing when primary carrier fails',
  mode: 'approval-required',
  capabilities: ['shipping.inspect', 'shipping.switch'],
  policies: ['never-exceed-order-budget', 'allowed-fallback-carriers'],
  limits: { maxConcurrentRuns: 5, maxDecisionsPerHour: 100 },
  loopProtection: { maxDepth: 5, cooldownMs: 1000, maxActionsPerRun: 10 },
  recovery: { retry: { attempts: 2, backoff: 'exponential' } },
})
class OrderOperationsService {
  @Observe('carrier.failed')
  onCarrierFailure(event: { orderId: string; carrier: string }) {
    const order = FIXTURE_ORDERS[event.orderId] ?? {
      orderId: event.orderId,
      carrier: event.carrier,
      fallbackCost: 3,
    };
    return {
      orderId: order.orderId,
      failedCarrier: event.carrier,
      additionalCost: order.fallbackCost,
      candidate: ALLOWED_FALLBACKS[0],
    };
  }

  @Capability({
    id: 'shipping.inspect',
    effect: 'read-only',
    approval: 'auto',
  })
  inspect(input: { orderId: string }) {
    return FIXTURE_ORDERS[input.orderId] ?? null;
  }

  @Capability({
    id: 'shipping.switch',
    effect: 'idempotent',
    approval: 'auto',
    idempotencyKey: true,
  })
  switchCarrier(input: { orderId: string; candidate?: string; additionalCost?: number }) {
    const candidate = input.candidate ?? ALLOWED_FALLBACKS[0];
    const cost = input.additionalCost ?? 0;
    if (!ALLOWED_FALLBACKS.includes(candidate as (typeof ALLOWED_FALLBACKS)[number])) {
      throw new Error(`Carrier ${candidate} not allowed`);
    }
    if (cost > MAX_ADDITIONAL_COST) {
      throw new Error(`Additional cost ${cost} exceeds budget ${MAX_ADDITIONAL_COST}`);
    }
    return {
      orderId: input.orderId,
      newCarrier: candidate,
      additionalCost: cost,
      switched: true,
    };
  }
}

async function main(): Promise<void> {
  clearAutonomousRegistry();

  const runtime = new AutonomousRuntime({
    storage: new MemoryAutonomousRunStore(),
    autoDiscover: false,
    services: [OrderOperationsService],
    decisionEngine: {
      async evaluate(ctx) {
        const payload = ctx.observation.payload as {
          orderId: string;
          additionalCost?: number;
          candidate?: string;
        };
        const cost = payload.additionalCost ?? 0;
        if (cost > MAX_ADDITIONAL_COST) {
          return { type: 'no-action', reason: 'Exceeds maximumAdditionalShippingCost' };
        }
        if (!ALLOWED_FALLBACKS.includes((payload.candidate ?? '') as 'carrier-b')) {
          // still propose default fallback
        }
        const args = {
          orderId: payload.orderId,
          candidate: payload.candidate ?? 'carrier-b',
          additionalCost: cost,
        };
        if (cost > APPROVAL_COST_THRESHOLD || ctx.mode === 'approval-required') {
          return {
            type: 'request-approval',
            capabilityId: 'shipping.switch',
            arguments: args,
            reason: `Fallback carrier within policy; approval required (cost=${cost})`,
          };
        }
        return {
          type: 'execute',
          capabilityId: 'shipping.switch',
          arguments: args,
          reason: 'Fallback within auto threshold',
        };
      },
    },
  });

  const service = new OrderOperationsService();
  runtime.bindInstance(OrderOperationsService, service);
  await runtime.start();

  console.log('Observation:\nPrimary carrier unavailable\n');

  const [runId] = await runtime.emit(
    'carrier.failed',
    { orderId: 'ORD-1001', carrier: 'carrier-a' },
    { tenantId: 'merchant-1', source: 'demo' }
  );

  let run = await runtime.inspect(runId!);
  console.log('Decision:\nFallback carrier identified\n');
  console.log('Policy:\nAllowed within cost constraints\n');
  console.log(`Approval:\nRequired (phase=${run?.metadata.phase})\n`);

  await runtime.resume(runId!, { approved: true, actor: 'ops-lead' });
  run = await runtime.inspect(runId!);

  console.log('Approval result:\nApproved\n');
  console.log('Execution:\nCarrier switch completed\n');
  console.log('Recovery:\nDurable state committed\n');
  console.log('Audit:\nRun timeline available\n');
  console.log(
    JSON.stringify(
      { runId, status: run?.status, output: run?.output, timeline: run?.metadata.timeline },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
