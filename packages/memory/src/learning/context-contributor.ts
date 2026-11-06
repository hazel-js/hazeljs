/**
 * Duck-typed contributor for @hazeljs/context.
 * Never substitutes tenantId for userId/subjectId.
 */

import type { GovernedMemoryService } from './service';
import type { MemoryAuthContext } from './types';

/** Minimal shape matching @hazeljs/context ContextContributor without a hard dependency. */
export interface GovernedMemoryContextContributor {
  readonly kind: 'memory';
  contribute(request: {
    query: string;
    tenantId: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ text: string; evidence?: unknown[] }>;
}

export function createGovernedMemoryContributor(
  service: GovernedMemoryService,
  options: {
    /** Build auth from the request. Must pass actor and tenant separately. */
    resolveAuth: (request: {
      tenantId: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }) => MemoryAuthContext;
  }
): GovernedMemoryContextContributor {
  return {
    kind: 'memory',
    async contribute(request) {
      const auth = options.resolveAuth(request);
      // Never fall back from actor to tenant.
      if (!request.userId && !auth.actorId) {
        return { text: '', evidence: [] };
      }
      const subjectId = request.userId ?? auth.actorId;
      const rows = await service.retrieve({
        auth,
        subjectId,
        text: request.query,
        limit: 10,
        tokenBudget:
          typeof request.metadata?.tokenBudget === 'number'
            ? request.metadata.tokenBudget
            : undefined,
      });
      const parts = rows
        .map((r) => {
          if (!r.content) return '';
          return `[${r.type}/${r.scope}] ${r.content}`;
        })
        .filter(Boolean);
      return {
        text: parts.join('\n'),
        evidence: rows.map((r) => ({
          id: r.id,
          provenance: r.provenance,
          version: r.version,
          status: r.status,
        })),
      };
    },
  };
}
