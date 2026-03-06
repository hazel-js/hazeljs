import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@hazeljs/core';

interface TenantStore {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Provides request-scoped tenant context via AsyncLocalStorage.
 *
 * ─── Why two layers? ──────────────────────────────────────────────────────────
 * TenantGuard enforces isolation at the HTTP layer — it rejects requests where
 * the JWT tenant doesn't match the route tenant.  That's necessary but not
 * sufficient: a bug in service code could still query another tenant's rows if
 * the guard is misconfigured or skipped.
 *
 * TenantContext closes that gap at the DATA layer.  After the guard validates
 * the request, it calls TenantContext.enterWith(tenantId) which seeds an
 * AsyncLocalStorage store for the remainder of the request's async call chain.
 * Every repository/service that injects TenantContext can then call
 * requireId() without receiving tenantId as a function parameter.
 *
 * ─── Usage in a repository ───────────────────────────────────────────────────
 * ```ts
 * @Service()
 * export class OrdersRepository {
 *   constructor(private readonly tenantCtx: TenantContext) {}
 *
 *   findAll() {
 *     const tenantId = this.tenantCtx.requireId();
 *     return db.query('SELECT * FROM orders WHERE tenant_id = $1', [tenantId]);
 *   }
 *
 *   findById(id: string) {
 *     const tenantId = this.tenantCtx.requireId();
 *     // Even a direct ID lookup is scoped — prevents horizontal privilege escalation
 *     return db.query(
 *       'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
 *       [id, tenantId]
 *     );
 *   }
 * }
 * ```
 *
 * ─── How it propagates ────────────────────────────────────────────────────────
 * Node.js AsyncLocalStorage propagates through the async call graph.
 * TenantGuard calls enterWith() during guard execution; because the route
 * handler is called afterwards in the same async chain, it (and everything
 * it awaits) automatically has access to the stored tenant ID.
 */
@Injectable()
export class TenantContext {
  /**
   * Returns the current tenant ID, or `undefined` if called outside a
   * request context (e.g. during startup or in a background job).
   */
  getId(): string | undefined {
    return storage.getStore()?.tenantId;
  }

  /**
   * Returns the current tenant ID and throws if it is not set.
   *
   * Use this in any repository or service method that must never run without
   * a tenant — it acts as a last-resort safety net even if the guard was
   * accidentally omitted on a route.
   */
  requireId(): string {
    const id = this.getId();
    if (!id) {
      throw Object.assign(
        new Error(
          'TenantContext: no tenant ID found. ' + 'Ensure TenantGuard is applied to the route.'
        ),
        { status: 500 }
      );
    }
    return id;
  }

  /**
   * Seeds the current async context with the given tenant ID.
   *
   * Called internally by TenantGuard after it validates the request.
   * Unlike `run()`, `enterWith` propagates through the rest of the current
   * async execution chain without requiring a wrapping callback — which
   * makes it the right tool for seeding from within a guard.
   */
  static enterWith(tenantId: string): void {
    storage.enterWith({ tenantId });
  }

  /**
   * Wraps a callback so that everything inside it (and all async operations
   * it spawns) runs with the given tenant ID in context.
   *
   * Use this when you need explicit scoping, e.g. in background jobs or tests:
   *
   * ```ts
   * await TenantContext.run('acme', async () => {
   *   await ordersService.processPendingOrders();
   * });
   * ```
   */
  static run<T>(tenantId: string, fn: () => T): T {
    return storage.run({ tenantId }, fn);
  }
}
