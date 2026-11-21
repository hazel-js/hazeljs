/**
 * HazelJS project agent — loaded by hazeld via loadProjectAgent(projectRoot).
 * Handlers live on @Tool methods; DNA/catalog is applied separately.
 */
import * as fs from 'fs';
import { Agent, Tool } from '@hazeljs/agent';

export const AGENT_NAME = 'refund-conformance';

function cfg() {
  return {
    fakeBaseUrl: process.env.FAKE_BASE_URL ?? '',
    authHeader: process.env.AUTH_HEADER ?? '',
    orderId: process.env.ORDER_ID ?? '',
    amountMinor: Number(process.env.AMOUNT_MINOR ?? '2599'),
    operationKey: process.env.OPERATION_KEY ?? '',
  };
}

function allowRefund(): boolean {
  const policyPath = process.env.POLICY_PATH;
  if (policyPath) {
    try {
      return JSON.parse(fs.readFileSync(policyPath, 'utf8')).allowRefund !== false;
    } catch {
      return true;
    }
  }
  return process.env.ALLOW_REFUND !== 'false';
}

@Agent({
  name: AGENT_NAME,
  description: 'Read an order, then propose a bounded refund (HITL).',
  systemPrompt:
    'Read the order, then propose a bounded refund when asked. Refunds require approval.',
})
export class RefundConformanceAgent {
  @Tool({
    name: 'read_order',
    description: 'Read an order',
    parameters: [{ name: 'orderId', type: 'string', description: 'Order id', required: true }],
  })
  async read_order(input: { orderId?: string }) {
    const { fakeBaseUrl, authHeader, orderId } = cfg();
    const id = String(input.orderId ?? orderId);
    const res = await fetch(`${fakeBaseUrl}/orders/${encodeURIComponent(id)}`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) throw new Error(`read_order ${res.status}`);
    return res.json();
  }

  @Tool({
    name: 'refund',
    description: 'Issue a bounded refund',
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string', description: 'Order id', required: true },
      {
        name: 'amountMinor',
        type: 'number',
        description: 'Refund amount in minor units',
        required: true,
      },
      { name: 'currency', type: 'string', description: 'Currency code', required: false },
      { name: 'reason', type: 'string', description: 'Refund reason', required: false },
    ],
  })
  async refund(input: {
    orderId?: string;
    amountMinor?: number;
    currency?: string;
    reason?: string;
  }) {
    if (!allowRefund()) {
      throw new Error('refund_denied_by_policy');
    }
    const { fakeBaseUrl, authHeader, orderId, amountMinor, operationKey } = cfg();
    const body = {
      orderId: String(input.orderId ?? orderId),
      amountMinor: Number(input.amountMinor ?? amountMinor),
      currency: String(input.currency ?? 'USD'),
      reason: String(input.reason ?? 'conformance_synthetic_refund'),
      idempotencyKey: operationKey,
    };

    const lookup = await fetch(
      `${fakeBaseUrl}/refunds/by-key/${encodeURIComponent(operationKey)}`,
      { headers: { Authorization: authHeader } }
    );
    if (lookup.status === 200) return { reconciled: true, refund: await lookup.json() };
    if (lookup.status === 503) {
      return { status: 'pending_reconciliation', operationKey };
    }

    const res = await fetch(`${fakeBaseUrl}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'Idempotency-Key': operationKey,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`refund ${res.status} ${text}`);
    return { committed: true, refund: text ? JSON.parse(text) : null };
  }
}
