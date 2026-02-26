/**
 * In-memory KYC store for dev/testing
 */

import type { KycStore, KycSession } from './store';
import { nowISO } from '../../utils/time';

export class MemoryKycStore implements KycStore {
  private sessions = new Map<string, KycSession>();

  async create(tenantId?: string): Promise<KycSession> {
    const id = `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = nowISO();
    const session: KycSession = {
      id,
      tenantId,
      createdAt: now,
      updatedAt: now,
      answers: {},
      documents: {},
      raw: {},
      normalized: {},
      checks: {},
    };
    this.sessions.set(id, session);
    return session;
  }

  async get(id: string): Promise<KycSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async update(id: string, updates: Partial<KycSession>): Promise<KycSession | null> {
    const sess = this.sessions.get(id);
    if (!sess) return null;
    const updated: KycSession = {
      ...sess,
      ...updates,
      updatedAt: nowISO(),
    };
    this.sessions.set(id, updated);
    return updated;
  }
}
