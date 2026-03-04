/**
 * Describes which roles a given role "inherits".
 *
 * Example: `{ superadmin: ['admin'], admin: ['manager'], manager: ['user'] }`
 * means superadmin implicitly satisfies any check for admin, manager, or user.
 */
export type RoleHierarchyMap = Record<string, string[]>;

/**
 * A sensible default hierarchy for most applications.
 * Override by passing your own map to RoleHierarchy or to RoleGuard.
 *
 *   superadmin → admin → manager → user
 */
export const DEFAULT_ROLE_HIERARCHY: RoleHierarchyMap = {
  superadmin: ['admin'],
  admin: ['manager'],
  manager: ['user'],
  user: [],
};

/**
 * Resolves inherited roles so that a higher-level role implicitly satisfies
 * requirements for any role it inherits.
 *
 * @example
 * ```ts
 * const h = new RoleHierarchy({ admin: ['editor'], editor: ['viewer'] });
 *
 * h.satisfies('admin', 'viewer')  // true  — admin → editor → viewer
 * h.satisfies('editor', 'admin')  // false — editor does not inherit admin
 * h.resolve('admin')              // Set { 'admin', 'editor', 'viewer' }
 * ```
 */
export class RoleHierarchy {
  constructor(private readonly map: RoleHierarchyMap = DEFAULT_ROLE_HIERARCHY) {}

  /**
   * Returns true if `userRole` satisfies the `requiredRole` check, either
   * directly (same role) or via inheritance.
   */
  satisfies(userRole: string, requiredRole: string): boolean {
    return this.resolve(userRole).has(requiredRole);
  }

  /**
   * Returns the complete set of roles that `role` covers (itself plus all
   * transitively inherited roles).
   */
  resolve(role: string): Set<string> {
    const visited = new Set<string>();
    const queue: string[] = [role];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        (this.map[current] ?? []).forEach((child) => queue.push(child));
      }
    }

    return visited;
  }
}
