/**
 * File-backed order/refund store — independent of Agent OS so hazeld SIGKILL
 * leaves external effects intact.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Service,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  HttpError,
} from '@hazeljs/core';

export type OrdersState = {
  orders: any[];
  refunds: any[];
  log: any[];
  holdAfterCommit: boolean;
  reconciliationUnavailable: boolean;
  disableDedup: boolean;
  held: Set<string>;
};

/** Active data file for this process (set by startFakeOrders). */
let dataPath = '';

export function setOrdersDataPath(p: string): void {
  dataPath = p;
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function emptyState(): OrdersState {
  return {
    orders: [],
    refunds: [],
    log: [],
    holdAfterCommit: false,
    reconciliationUnavailable: false,
    disableDedup: false,
    held: new Set(),
  };
}

function load(): OrdersState {
  if (!dataPath || !fs.existsSync(dataPath)) return emptyState();
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return { ...emptyState(), ...raw, held: new Set(raw.held ?? []) };
}

function save(state: OrdersState): void {
  const tmp = `${dataPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...state, held: [...state.held] }, null, 2));
  fs.renameSync(tmp, dataPath);
}

export function parseTenant(authorization?: string): string {
  const h = authorization ?? '';
  if (!h.startsWith('Bearer tenant:')) {
    throw new UnauthorizedException('unauthorized');
  }
  return h.slice('Bearer tenant:'.length);
}

@Service()
export class OrdersService {
  stats() {
    const state = load();
    return {
      refundCount: state.refunds.length,
      postAttempts: state.log.filter((l) => l.path === '/refunds' && l.method === 'POST').length,
      refunds: state.refunds,
      held: [...state.held],
    };
  }

  configure(flags: Record<string, unknown>): void {
    const state = load();
    Object.assign(state, flags);
    save(state);
  }

  release(): void {
    const state = load();
    state.held.clear();
    save(state);
  }

  seed(tenantId: string, body: Record<string, unknown>): void {
    const state = load();
    const orderId = String(body.orderId);
    state.orders = state.orders.filter((o) => !(o.tenantId === tenantId && o.orderId === orderId));
    state.orders.push({ tenantId, ...body, status: 'paid' });
    save(state);
  }

  getOrder(tenantId: string, orderId: string) {
    const state = load();
    state.log.push({ method: 'GET', path: `/orders/${orderId}`, tenantId });
    save(state);
    const order = state.orders.find((o) => o.tenantId === tenantId && o.orderId === orderId);
    if (!order) throw new NotFoundException('not_found');
    return order;
  }

  getRefundByKey(tenantId: string, key: string) {
    const state = load();
    state.log.push({ method: 'GET', path: `/refunds/by-key/${key}`, tenantId, key });
    save(state);
    if (state.reconciliationUnavailable) {
      throw new HttpError(503, 'unavailable');
    }
    const refund = state.refunds.find((r) => r.tenantId === tenantId && r.idempotencyKey === key);
    if (!refund) throw new NotFoundException('not_found');
    return refund;
  }

  async createRefund(tenantId: string, body: Record<string, unknown>, idempotencyHeader?: string) {
    let state = load();
    const key = String(body.idempotencyKey || idempotencyHeader || '');
    const fp = JSON.stringify({
      orderId: body.orderId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      reason: body.reason,
    });
    state.log.push({ method: 'POST', path: '/refunds', tenantId, key, committed: false });

    const existing = state.refunds.find((r) => r.tenantId === tenantId && r.idempotencyKey === key);
    if (existing && !state.disableDedup) {
      if (existing.fingerprint !== fp) {
        throw new ConflictException('fingerprint_mismatch');
      }
      save(state);
      return { status: 200, body: { ...existing, replayed: true } };
    }

    const refund = {
      refundId: `ref_${crypto.randomUUID()}`,
      tenantId,
      orderId: body.orderId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      reason: body.reason,
      idempotencyKey: key,
      fingerprint: fp,
    };
    state.refunds.push(refund);
    state.log[state.log.length - 1].committed = true;
    save(state);

    if (state.holdAfterCommit) {
      state.held.add(key);
      save(state);
      while (load().held.has(key)) {
        await new Promise((r) => setTimeout(r, 25));
      }
    }

    return { status: 201, body: refund };
  }
}
