/**
 * Sanitize marketplace package names for filesystem paths.
 * `@hazeljs/foo-agent` → `hazeljs__foo-agent`
 */

export function sanitizePackageName(name: string): string {
  return name
    .replace(/^@/, '')
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Parse `name@version` or bare `name` (version defaults to latest). */
export function parsePackageSpec(spec: string): { name: string; version?: string } {
  const at = spec.lastIndexOf('@');
  if (at <= 0) {
    return { name: spec };
  }
  // Scoped: @scope/name@version  or  @scope/name
  if (spec.startsWith('@')) {
    const afterScope = spec.indexOf('/', 1);
    if (afterScope === -1) {
      return { name: spec };
    }
    const versionAt = spec.indexOf('@', afterScope + 1);
    if (versionAt === -1) {
      return { name: spec };
    }
    return {
      name: spec.slice(0, versionAt),
      version: spec.slice(versionAt + 1) || undefined,
    };
  }
  return {
    name: spec.slice(0, at),
    version: spec.slice(at + 1) || undefined,
  };
}
